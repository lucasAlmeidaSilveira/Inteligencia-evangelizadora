-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security — Inteligência Evangelizadora
--
-- Arquivo idempotente: reaplicado a cada `pnpm db:migrate`.
--
-- Contexto: usando Firebase Auth, o Postgres não conhece o usuário final.
-- Quem informa é a aplicação, via `set_config('app.*', ..., true)` no início
-- de cada transação (ver src/server/db/escopo.ts). Como o escopo é local à
-- transação, ele nunca sobrevive para a próxima requisição que reutilizar a
-- mesma conexão do pool.
--
-- IMPORTANTE: a aplicação conecta como `ie_app`, papel sem BYPASSRLS. Um papel
-- com esse atributo ignora todas as políticas abaixo — mais forte até que
-- FORCE ROW LEVEL SECURITY. `pnpm db:testar-rls` verifica isso antes de tudo.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Leitura do escopo da requisição ───────────────────────────────────────

create or replace function ie.usuario_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

create or replace function ie.firebase_uid() returns text
  language sql stable
  as $$ select nullif(current_setting('app.firebase_uid', true), '') $$;

create or replace function ie.papel() returns text
  language sql stable
  as $$ select nullif(current_setting('app.papel', true), '') $$;

/* Token da pesquisa pública. Só `comPesquisa()` o define, e só com
   `app.papel = 'pesquisa'`; em toda requisição de pessoa vem vazio. */
create or replace function ie.pesquisa_token() returns text
  language sql stable
  as $$ select nullif(current_setting('app.pesquisa_token', true), '') $$;

/*
 * Missão a que a pessoa pertence. Nula para o admin, que não pertence a
 * nenhuma — e por isso enxerga todas.
 *
 * O segundo termo do coalesce resolve o ovo e a galinha do carregamento da
 * sessão: nesse instante só o firebase_uid é conhecido, e sem ele o JOIN com
 * `missoes` viria vazio pelo próprio RLS — a sessão seria descartada e a
 * pessoa ficaria trancada fora do sistema. O COALESCE do Postgres não avalia
 * os argumentos à direita do primeiro não-nulo, então a subconsulta custa
 * zero no caminho normal, em que o escopo já está definido.
 */
/*
 * SECURITY DEFINER de propósito. É uma das quatro do arquivo — as outras são
 * ie.registrar_acesso(), logo abaixo, e as duas da pesquisa pública, mais
 * adiante; cada uma existe por um motivo diferente, e todas têm o EXECUTE
 * revogado de PUBLIC no fim do arquivo.
 *
 * Sem isso há recursão: a policy de `usuarios` chama `missao_do_usuario()`,
 * que consultaria `usuarios`, disparando a policy de novo — o Postgres estoura
 * a pilha. Rodando como dona, a função lê a tabela sem passar pelo RLS.
 *
 * A superfície é mínima: não aceita parâmetro e só devolve a missão da linha
 * cujo firebase_uid veio do escopo — que por sua vez veio de um cookie de
 * sessão verificado no servidor. Não há como perguntar pela missão de outra
 * pessoa. O `search_path` é fixado porque uma função SECURITY DEFINER com
 * search_path aberto pode ser induzida a chamar objetos plantados por quem a
 * invoca.
 */
create or replace function ie.missao_pelo_token() returns uuid
  language sql stable security definer
  set search_path = ie, pg_temp
  as $$
    select u.missao_id from ie.usuarios u
     where u.firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  $$;

create or replace function ie.missao_do_usuario() returns uuid
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('app.missao_id', true), '')::uuid,
      ie.missao_pelo_token()
    )
  $$;

create or replace function ie.eh_admin() returns boolean
  language sql stable
  as $$ select ie.papel() = 'admin' $$;

create or replace function ie.eh_responsavel() returns boolean
  language sql stable
  as $$ select ie.papel() = 'responsavel' $$;

-- Sem escopo definido não existe usuário: nega tudo por omissão.
create or replace function ie.autenticado() returns boolean
  language sql stable
  as $$ select ie.usuario_id() is not null $$;

/* Ver e registrar dados de uma missão: admin em qualquer uma; responsável e
   auxiliar apenas na sua. */
create or replace function ie.tem_acesso_missao(alvo uuid) returns boolean
  language sql stable
  as $$ select ie.eh_admin() or (alvo is not null and alvo = ie.missao_do_usuario()) $$;

/* Alterar o cadastro da própria missão é do responsável, não do auxiliar. */
create or replace function ie.pode_editar_missao(alvo uuid) returns boolean
  language sql stable
  as $$
    select ie.eh_admin()
        or (ie.eh_responsavel() and alvo is not null and alvo = ie.missao_do_usuario())
  $$;

-- ─── Último acesso ─────────────────────────────────────────────────────────

/*
 * Carimba `ultimo_acesso_em` na linha de quem está na requisição.
 *
 * SECURITY DEFINER, e a alternativa descartada explica por quê: uma policy
 * `for update using (firebase_uid = ie.firebase_uid())` resolveria a escrita,
 * mas policy de UPDATE autoriza a *linha*, não a coluna — a mesma regra que
 * libera o carimbo liberaria `set papel = 'admin'` a qualquer caminho de
 * código que surgisse depois. Aqui a única coluna que muda está escrita dentro
 * da função, e nada mais sai daqui.
 *
 * Sem parâmetro, como ie.missao_pelo_token(): o alvo é sempre a linha do
 * firebase_uid que a aplicação pôs no escopo, que por sua vez veio de um
 * cookie de sessão verificado no servidor — não há como carimbar a linha de
 * outra pessoa. O `search_path` é fixado pelo mesmo motivo de lá.
 *
 * A janela de 15 minutos existe porque isto roda em toda navegação: sem ela,
 * cada página seria um UPDATE e um registro de WAL para mexer num "há 2 horas"
 * que não muda. Dentro da janela o comando casa zero linhas e não escreve.
 * O trigger de `atualizado_em` dispara junto — `usuarios.atualizado_em` não é
 * lido em tela alguma, então não vale abrir exceção no loop logo abaixo.
 *
 * `and ativo` mantém a coluna honesta: quem foi desativado tem a sessão
 * recusada em `carregarPorFirebaseUid` e não acessou coisa alguma.
 */
create or replace function ie.registrar_acesso() returns void
  language sql security definer
  set search_path = ie, pg_temp
  as $$
    update ie.usuarios
       set ultimo_acesso_em = now()
     where firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
       and ativo
       and (ultimo_acesso_em is null
            or ultimo_acesso_em < now() - interval '15 minutes')
  $$;

-- ─── Pesquisa pública ──────────────────────────────────────────────────────

/*
 * A pesquisa de satisfação é a primeira porta do sistema sem login. O papel
 * `pesquisa` que a atende não tem policy em tabela alguma — todo SELECT,
 * INSERT, UPDATE e DELETE que ele tente devolve zero linhas ou é recusado — e
 * só consegue o que estas duas funções entregam. A alternativa descartada,
 * policies "for select/insert" condicionadas ao token, exporia a linha inteira
 * de `eventos` e de `evento_pesquisas` ao escopo público: um SELECT a mais no
 * código, e o token de outra pesquisa ou o orçamento da ação sairiam pela
 * porta. Aqui o que sai está escrito dentro da função.
 *
 * As duas exigem papel `pesquisa` E escopo sem pessoa (usuario_id e
 * firebase_uid vazios): escopo de pesquisa nunca coexiste com uma sessão, e
 * um usuário logado que chamasse a função — ie_app tem EXECUTE em tudo — não
 * obtém nada. O `search_path` é fixado pelo mesmo motivo das funções acima.
 *
 * Sob FORCE ROW LEVEL SECURITY, o INSERT dentro de ie.responder_pesquisa()
 * só acontece porque a dona do schema ignora o RLS (BYPASSRLS em produção,
 * superusuário na demo) — a mesma dependência, invisível, de
 * ie.registrar_acesso(). É o cenário "Pesquisa pública" de `pnpm db:testar-rls`
 * que a torna visível em qualquer ambiente.
 */
create or replace function ie.escopo_de_pesquisa() returns boolean
  language sql stable
  as $$
    select ie.papel() = 'pesquisa'
       and ie.pesquisa_token() is not null
       and ie.usuario_id() is null
       and ie.firebase_uid() is null
       and nullif(current_setting('app.missao_id', true), '') is null
  $$;

/* O que a página pública precisa saber, e nada além: o título da ação e se a
   pesquisa ainda aceita respostas — decidido aqui, com o mesmo `now()` que
   ie.responder_pesquisa() usa para recusar, para a página e a função nunca
   discordarem. Nenhum id sai daqui. */
drop function if exists ie.pesquisa_do_token();
create function ie.pesquisa_do_token()
  returns table (titulo text, aceita boolean)
  language sql stable security definer
  set search_path = ie, pg_temp
  as $$
    select e.titulo, (p.aberta and p.encerra_em > now()) as aceita
      from ie.evento_pesquisas p
      join ie.eventos e on e.id = p.evento_id
     where ie.escopo_de_pesquisa()
       and p.token = ie.pesquisa_token()
  $$;

/*
 * A única porta de entrada de uma resposta. Devolve o id da ação para a
 * aplicação expirar o cache daquela ação — e só daquela.
 *
 * Cada recusa nomeia a causa em `constraint`, não no texto: é esse nome que
 * `traduzirErroDeBanco` transforma em frase, e o token nunca aparece em
 * mensagem nenhuma.
 *
 * `for update` na linha da pesquisa serializa as respostas de uma mesma
 * pesquisa, e é isso que torna o limite por minuto exato sob carga em vez de
 * aproximado. Os limites são contra inundação (um robô batendo no link), não
 * contra a mesma pessoa responder duas vezes, que é aceito — e 120 por minuto
 * é o que um salão inteiro apontando o celular para o QR projetado consegue
 * produzir sem ser barrado; um robô produz isso em dois segundos.
 */
create or replace function ie.responder_pesquisa(
  nota_informada int,
  comentario_informado text
) returns uuid
  language plpgsql security definer
  set search_path = ie, pg_temp
  as $$
  declare
    pesquisa ie.evento_pesquisas%rowtype;
    recentes int;
    total int;
  begin
    if not ie.escopo_de_pesquisa() then
      raise exception 'Pesquisa não encontrada.'
        using errcode = 'P0001', constraint = 'pesquisa_inexistente';
    end if;

    select * into pesquisa
      from ie.evento_pesquisas
     where token = ie.pesquisa_token()
       for update;

    if not found then
      raise exception 'Pesquisa não encontrada.'
        using errcode = 'P0001', constraint = 'pesquisa_inexistente';
    end if;

    if not pesquisa.aberta or pesquisa.encerra_em <= now() then
      raise exception 'Pesquisa encerrada.'
        using errcode = 'P0001', constraint = 'pesquisa_encerrada';
    end if;

    -- `limit 121` em vez de contar tudo: o índice (pesquisa_id, respondida_em)
    -- responde sem varrer as respostas antigas.
    select count(*) into recentes from (
      select 1 from ie.evento_respostas
       where pesquisa_id = pesquisa.id
         and respondida_em > now() - interval '60 seconds'
       limit 121
    ) janela;
    if recentes >= 120 then
      raise exception 'Muitas respostas em pouco tempo.'
        using errcode = 'P0001', constraint = 'pesquisa_muitas_respostas';
    end if;

    select count(*) into total from (
      select 1 from ie.evento_respostas
       where pesquisa_id = pesquisa.id
       limit 10001
    ) todas;
    if total >= 10000 then
      raise exception 'Limite de respostas atingido.'
        using errcode = 'P0001', constraint = 'pesquisa_lotada';
    end if;

    insert into ie.evento_respostas (pesquisa_id, evento_id, nota, comentario)
    values (
      pesquisa.id,
      pesquisa.evento_id,
      nota_informada,
      nullif(btrim(comentario_informado), '')
    );

    return pesquisa.evento_id;
  end
  $$;

/*
 * CREATE FUNCTION concede EXECUTE a PUBLIC por padrão, e esta instância é
 * compartilhada com outro sistema. As quatro SECURITY DEFINER ficam só com o
 * papel da aplicação. `grant` idempotente; `revoke` sem efeito se já revogado.
 */
revoke all on function ie.missao_pelo_token() from public;
revoke all on function ie.registrar_acesso() from public;
revoke all on function ie.pesquisa_do_token() from public;
revoke all on function ie.responder_pesquisa(int, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ie_app') then
    grant execute on function ie.missao_pelo_token() to ie_app;
    grant execute on function ie.registrar_acesso() to ie_app;
    grant execute on function ie.pesquisa_do_token() to ie_app;
    grant execute on function ie.responder_pesquisa(int, text) to ie_app;
  end if;
end $$;

-- ─── atualizado_em automático ──────────────────────────────────────────────

create or replace function ie.tocar_atualizado_em() returns trigger
  language plpgsql
  as $$
  begin
    new.atualizado_em = now();
    return new;
  end
  $$;

do $$
declare t text;
begin
  foreach t in array array[
    'usuarios', 'missoes', 'missao_indicadores', 'centros_evangelizacao',
    'grupos_oracao', 'tipos_evento', 'categorias_financeiras', 'eventos',
    'evento_lancamentos', 'evento_pesquisas'
  ] loop
    execute format('drop trigger if exists trg_%1$s_atualizado_em on ie.%1$I', t);
    execute format(
      'create trigger trg_%1$s_atualizado_em before update on ie.%1$I
       for each row execute function ie.tocar_atualizado_em()', t);
  end loop;
end $$;

-- ─── Histórico da ação ─────────────────────────────────────────────────────

/*
 * Tudo que acontece com uma ação apostólica vira uma linha em
 * `evento_historico` — e quem escreve são estas triggers, não a aplicação.
 *
 * A alternativa descartada era cada Server Action montar o diff e inserir.
 * Custaria um SELECT a mais por edição para conhecer o valor anterior e, pior,
 * dependeria de ninguém esquecer: um caminho de escrita novo sem a chamada
 * abriria um buraco no histórico sem erro nenhum. Aqui o `OLD` vem de graça e
 * não existe UPDATE em `eventos` que passe por fora.
 *
 * Nenhuma delas é SECURITY DEFINER: rodam como `ie_app`, dentro do escopo da
 * requisição, e o INSERT em `evento_historico` passa pela policy da tabela —
 * que herda o acesso da ação, exatamente como os outros filhos. Quem está no
 * escopo é lido por ie.usuario_id(); o nome vem da própria linha em
 * `usuarios`, que todo mundo enxerga de si mesmo (policy `usuarios_leitura`).
 *
 * Cada trigger de filho confere se a ação ainda existe antes de gravar. Sem
 * isso, apagar uma ação falharia: o ON DELETE CASCADE remove lançamentos,
 * documentos e links depois da própria ação, as triggers tentariam registrar
 * "lançamento excluído" apontando para uma ação que já se foi, e o FK
 * recusaria a exclusão inteira.
 */

/* Nome de quem está no escopo. Nulo sem pessoa — semeadura, correção via SQL. */
create or replace function ie.usuario_nome() returns text
  language sql stable
  as $$ select u.nome from ie.usuarios u where u.id = ie.usuario_id() $$;

/*
 * O histórico guarda o *nome* do tipo, do centro e da missão, não o id: "de
 * Retiro para SVES" é o que se lê, e é o nome que valia naquele momento — um
 * tipo renomeado depois não reescreve o passado. Se o nome não está ao alcance
 * (centro de outra missão, para um admin que moveu a ação), fica o id, que é
 * melhor que nada.
 */
create or replace function ie.nome_no_historico(coluna text, valor jsonb) returns jsonb
  language sql stable
  as $$
    select case
      when valor is null or jsonb_typeof(valor) = 'null' then valor
      else to_jsonb(coalesce(
        case coluna
          when 'tipo_evento_id' then (select nome from ie.tipos_evento where id = (valor #>> '{}')::uuid)
          when 'centro_id'      then (select nome from ie.centros_evangelizacao where id = (valor #>> '{}')::uuid)
          when 'missao_id'      then (select nome from ie.missoes where id = (valor #>> '{}')::uuid)
        end,
        valor #>> '{}'))
    end
  $$;

/*
 * A própria ação: criação e cada edição, campo a campo.
 *
 * O diff sai de `to_jsonb(OLD)` contra `to_jsonb(NEW)`, sem lista de colunas
 * escrita à mão — uma coluna nova em `eventos` entra no histórico sozinha.
 * Ficam de fora `atualizado_em` (muda em toda edição, não diz nada) e o que
 * não muda nunca (`id`, `criado_em`, `criado_por`). Edição que não alterou
 * valor algum — salvar o formulário sem mexer em nada — não vira linha.
 */
create or replace function ie.registrar_historico_evento() returns trigger
  language plpgsql
  as $$
  declare
    antes jsonb;
    depois jsonb;
    chave text;
    de jsonb;
    para jsonb;
    alteracoes jsonb := '[]'::jsonb;
  begin
    if tg_op = 'INSERT' then
      insert into ie.evento_historico (evento_id, tipo, usuario_id, usuario_nome)
      values (new.id, 'acao_criada', ie.usuario_id(), ie.usuario_nome());
      return null;
    end if;

    antes  := to_jsonb(old) - array['id', 'criado_em', 'criado_por', 'atualizado_em'];
    depois := to_jsonb(new) - array['id', 'criado_em', 'criado_por', 'atualizado_em'];

    for chave in select jsonb_object_keys(depois) order by 1 loop
      de   := antes -> chave;
      para := depois -> chave;
      if de is distinct from para then
        if chave in ('tipo_evento_id', 'centro_id', 'missao_id') then
          de   := ie.nome_no_historico(chave, de);
          para := ie.nome_no_historico(chave, para);
        end if;
        alteracoes := alteracoes
          || jsonb_build_object('campo', chave, 'de', de, 'para', para);
      end if;
    end loop;

    if alteracoes = '[]'::jsonb then
      return null;
    end if;

    insert into ie.evento_historico (evento_id, tipo, usuario_id, usuario_nome, detalhes)
    values (
      new.id, 'acao_alterada', ie.usuario_id(), ie.usuario_nome(),
      jsonb_build_object('alteracoes', alteracoes)
    );
    return null;
  end
  $$;

/* Lançamentos, documentos e links: entrou ou saiu. Uma função para os três,
   decidindo pelo nome da tabela — o que muda é só o que vale guardar de cada
   um para a frase da tela. */
create or replace function ie.registrar_historico_filho() returns trigger
  language plpgsql
  as $$
  declare
    linha record;
    evento uuid;
    tipo ie.tipo_historico;
    detalhes jsonb;
  begin
    if tg_op = 'DELETE' then linha := old; else linha := new; end if;
    evento := linha.evento_id;

    -- Cascata da exclusão da ação: a ação já não existe, nada a registrar.
    if not exists (select 1 from ie.eventos e where e.id = evento) then
      return null;
    end if;

    case tg_table_name
      when 'evento_lancamentos' then
        tipo := case tg_op when 'INSERT' then 'lancamento_adicionado' else 'lancamento_excluido' end;
        detalhes := jsonb_build_object(
          'descricao', linha.descricao,
          'tipo', linha.tipo::text,
          -- Como texto, não número: dinheiro atravessa JSON sem perder centavos.
          'valor', linha.valor::text,
          'data', linha.data::text);
      when 'evento_documentos' then
        tipo := case tg_op when 'INSERT' then 'documento_adicionado' else 'documento_excluido' end;
        detalhes := jsonb_build_object('nome', linha.nome);
      when 'evento_links' then
        tipo := case tg_op when 'INSERT' then 'link_adicionado' else 'link_excluido' end;
        detalhes := jsonb_build_object('titulo', linha.titulo, 'url', linha.url);
    end case;

    insert into ie.evento_historico (evento_id, tipo, usuario_id, usuario_nome, detalhes)
    values (evento, tipo, ie.usuario_id(), ie.usuario_nome(), detalhes);
    return null;
  end
  $$;

/*
 * A pesquisa: aberta, encerrada, reaberta ou com link novo. Só o prazo
 * mudando (reabrir já grava o prazo junto) não é acontecimento próprio.
 * Reiniciar a pesquisa aparece como "link renovado" mais "N respostas
 * excluídas", abaixo — duas linhas que contam a história inteira.
 */
create or replace function ie.registrar_historico_pesquisa() returns trigger
  language plpgsql
  as $$
  declare
    tipo ie.tipo_historico;
  begin
    if tg_op = 'INSERT' then
      tipo := 'pesquisa_aberta';
    elsif old.aberta is distinct from new.aberta then
      tipo := case when new.aberta then 'pesquisa_reaberta' else 'pesquisa_encerrada' end;
    elsif old.token is distinct from new.token then
      tipo := 'pesquisa_link_renovado';
    else
      return null;
    end if;

    insert into ie.evento_historico (evento_id, tipo, usuario_id, usuario_nome, detalhes)
    values (
      new.evento_id, tipo, ie.usuario_id(), ie.usuario_nome(),
      jsonb_build_object('encerra_em', to_jsonb(new.encerra_em))
    );
    return null;
  end
  $$;

/*
 * Respostas só saem — moderação de uma, ou todas no reinício. Trigger por
 * comando, não por linha: reiniciar uma pesquisa com trezentas respostas vira
 * "300 respostas excluídas", não trezentas linhas iguais.
 */
create or replace function ie.registrar_historico_respostas() returns trigger
  language plpgsql
  as $$
  begin
    insert into ie.evento_historico (evento_id, tipo, usuario_id, usuario_nome, detalhes)
    select r.evento_id, 'respostas_excluidas', ie.usuario_id(), ie.usuario_nome(),
           jsonb_build_object('quantidade', count(*))
      from removidas r
     where exists (select 1 from ie.eventos e where e.id = r.evento_id)
     group by r.evento_id;
    return null;
  end
  $$;

drop trigger if exists trg_eventos_historico on ie.eventos;
create trigger trg_eventos_historico
  after insert or update on ie.eventos
  for each row execute function ie.registrar_historico_evento();

do $$
declare t text;
begin
  foreach t in array array['evento_lancamentos', 'evento_documentos', 'evento_links'] loop
    execute format('drop trigger if exists trg_%1$s_historico on ie.%1$I', t);
    execute format(
      'create trigger trg_%1$s_historico after insert or delete on ie.%1$I
       for each row execute function ie.registrar_historico_filho()', t);
  end loop;
end $$;

drop trigger if exists trg_evento_pesquisas_historico on ie.evento_pesquisas;
create trigger trg_evento_pesquisas_historico
  after insert or update on ie.evento_pesquisas
  for each row execute function ie.registrar_historico_pesquisa();

drop trigger if exists trg_evento_respostas_historico on ie.evento_respostas;
create trigger trg_evento_respostas_historico
  after delete on ie.evento_respostas
  referencing old table as removidas
  for each statement execute function ie.registrar_historico_respostas();

-- ─── Habilitar RLS ─────────────────────────────────────────────────────────
/*
 * FORCE cobre o caso de a aplicação conectar como dona das tabelas. Não
 * substitui o cuidado com BYPASSRLS, que é mais forte e ignora até o FORCE.
 */
do $$
declare t text;
begin
  foreach t in array array[
    'usuarios', 'missoes', 'missao_indicadores', 'centros_evangelizacao',
    'grupos_oracao', 'grupo_responsaveis', 'grupo_contagens',
    'lembretes_contagem', 'notificacoes', 'tipos_evento',
    'categorias_financeiras', 'eventos', 'evento_lancamentos',
    'evento_documentos', 'evento_links', 'evento_pesquisas', 'evento_respostas',
    'evento_historico'
  ] loop
    execute format('alter table ie.%I enable row level security', t);
    execute format('alter table ie.%I force row level security', t);
  end loop;
end $$;

-- ─── Usuários ──────────────────────────────────────────────────────────────

/*
 * Cada um vê a si mesmo sempre — inclusive antes de o escopo completo existir,
 * no momento em que a sessão é carregada pelo firebase_uid.
 * Além disso, quem pertence a uma missão vê os colegas dela: saber quem mais
 * tem acesso aos dados da própria missão é legítimo e evita duplicidade de
 * convites.
 */
drop policy if exists usuarios_leitura on ie.usuarios;
create policy usuarios_leitura on ie.usuarios for select
  using (
    firebase_uid = ie.firebase_uid()
    or ie.eh_admin()
    or (missao_id is not null and missao_id = ie.missao_do_usuario())
  );

drop policy if exists usuarios_admin on ie.usuarios;
create policy usuarios_admin on ie.usuarios for all
  using (ie.eh_admin()) with check (ie.eh_admin());

/*
 * O responsável administra apenas auxiliares da própria missão.
 *
 * USING vale para a linha antes da alteração e WITH CHECK para a depois — as
 * duas precisam passar. É isso que impede, com uma regra só, promover um
 * auxiliar a responsável ou transferi-lo para outra missão.
 */
drop policy if exists usuarios_do_responsavel on ie.usuarios;
create policy usuarios_do_responsavel on ie.usuarios for all
  using (
    ie.eh_responsavel()
    and papel = 'auxiliar'
    and missao_id = ie.missao_do_usuario()
  )
  with check (
    ie.eh_responsavel()
    and papel = 'auxiliar'
    and missao_id = ie.missao_do_usuario()
  );

-- ─── Missões ───────────────────────────────────────────────────────────────

drop policy if exists missoes_leitura on ie.missoes;
create policy missoes_leitura on ie.missoes for select
  using (ie.tem_acesso_missao(id));

-- Criar e apagar missão é ato do administrador master.
drop policy if exists missoes_criar on ie.missoes;
create policy missoes_criar on ie.missoes for insert
  with check (ie.eh_admin());

drop policy if exists missoes_apagar on ie.missoes;
create policy missoes_apagar on ie.missoes for delete
  using (ie.eh_admin());

-- Editar o cadastro é do responsável; o auxiliar registra, mas não altera.
drop policy if exists missoes_editar on ie.missoes;
create policy missoes_editar on ie.missoes for update
  using (ie.pode_editar_missao(id)) with check (ie.pode_editar_missao(id));

-- ─── Tudo que pertence a uma missão ────────────────────────────────────────
-- Responsável e auxiliar registram igualmente: é o trabalho do dia a dia.

drop policy if exists missao_indicadores_escopo on ie.missao_indicadores;
create policy missao_indicadores_escopo on ie.missao_indicadores for all
  using (ie.tem_acesso_missao(missao_id))
  with check (ie.tem_acesso_missao(missao_id));

/* O centro é estrutura da missão, mas quem a monta é quem está lá dentro: o
   auxiliar abre uma irradiação nova como abre um grupo de oração. O que ele
   não faz — alterar o cadastro da própria missão — continua fora. */
drop policy if exists centros_evangelizacao_escopo on ie.centros_evangelizacao;
create policy centros_evangelizacao_escopo on ie.centros_evangelizacao for all
  using (ie.tem_acesso_missao(missao_id))
  with check (ie.tem_acesso_missao(missao_id));

/* Grupos e ações não ganham policy por causa do centro: continuam filtrados
   por `missao_id`, e o FK composto (centro_id, missao_id) impede que apontem
   para um centro de outra missão. */
drop policy if exists grupos_oracao_escopo on ie.grupos_oracao;
create policy grupos_oracao_escopo on ie.grupos_oracao for all
  using (ie.tem_acesso_missao(missao_id))
  with check (ie.tem_acesso_missao(missao_id));

drop policy if exists eventos_escopo on ie.eventos;
create policy eventos_escopo on ie.eventos for all
  using (ie.tem_acesso_missao(missao_id))
  with check (ie.tem_acesso_missao(missao_id));

-- ─── Filhos: herdam o acesso do pai ────────────────────────────────────────

drop policy if exists grupo_responsaveis_escopo on ie.grupo_responsaveis;
drop policy if exists grupo_pastores_escopo on ie.grupo_responsaveis;
create policy grupo_pastores_escopo on ie.grupo_responsaveis for all
  using (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)))
  with check (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)));

/* Histórico de contagens e registro de lembretes: herdam o acesso do grupo,
   como os pastores. Quem vê o grupo vê quando ele foi contado e avisado. */
drop policy if exists grupo_contagens_escopo on ie.grupo_contagens;
create policy grupo_contagens_escopo on ie.grupo_contagens for all
  using (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)))
  with check (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)));

drop policy if exists lembretes_contagem_escopo on ie.lembretes_contagem;
create policy lembretes_contagem_escopo on ie.lembretes_contagem for all
  using (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)))
  with check (exists (
    select 1 from ie.grupos_oracao g
    where g.id = grupo_id and ie.tem_acesso_missao(g.missao_id)));

drop policy if exists evento_lancamentos_escopo on ie.evento_lancamentos;
create policy evento_lancamentos_escopo on ie.evento_lancamentos for all
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)))
  with check (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

drop policy if exists evento_documentos_escopo on ie.evento_documentos;
create policy evento_documentos_escopo on ie.evento_documentos for all
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)))
  with check (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

drop policy if exists evento_links_escopo on ie.evento_links;
create policy evento_links_escopo on ie.evento_links for all
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)))
  with check (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

/* A pesquisa é da ação: quem registra a ação abre, encerra e troca o link. O
   papel `pesquisa` não aparece aqui de propósito — ver "Pesquisa pública". */
drop policy if exists evento_pesquisas_escopo on ie.evento_pesquisas;
create policy evento_pesquisas_escopo on ie.evento_pesquisas for all
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)))
  with check (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

/* Respostas: quem vê a ação lê e modera (apaga um comentário ofensivo).
   Ninguém logado insere nem edita — não há policy de INSERT nem de UPDATE, e
   a única porta de entrada é ie.responder_pesquisa(). Editar a nota de um
   participante seria adulterar a pesquisa. */
drop policy if exists evento_respostas_leitura on ie.evento_respostas;
create policy evento_respostas_leitura on ie.evento_respostas for select
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

drop policy if exists evento_respostas_moderar on ie.evento_respostas;
create policy evento_respostas_moderar on ie.evento_respostas for delete
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

/*
 * Histórico: quem vê a ação lê o que aconteceu com ela. Só a trigger insere —
 * e insere no escopo de quem editou, então a policy de INSERT herda o acesso
 * da ação como os demais filhos. Não há policy de UPDATE nem de DELETE:
 * histórico que se edita não é histórico. As linhas só saem em cascata com a
 * ação.
 */
drop policy if exists evento_historico_leitura on ie.evento_historico;
create policy evento_historico_leitura on ie.evento_historico for select
  using (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

drop policy if exists evento_historico_registrar on ie.evento_historico;
create policy evento_historico_registrar on ie.evento_historico for insert
  with check (exists (
    select 1 from ie.eventos e
    where e.id = evento_id and ie.tem_acesso_missao(e.missao_id)));

-- ─── Notificações: cada um lê e marca as suas ───────────────────────────────

/*
 * A notificação é da pessoa, não da missão: o recorte é `usuario_id`, e nem o
 * responsável enxerga as dos auxiliares. Ler e marcar como lida é de quem
 * recebeu.
 *
 * Inserir é do escopo do sistema — a rotina de lembretes roda com
 * `app.papel = 'admin'` (ver src/server/sistema.ts) — ou de alguém escrevendo
 * para si mesmo. Não há caminho para um usuário criar notificação para outro.
 */
drop policy if exists notificacoes_proprias on ie.notificacoes;
create policy notificacoes_proprias on ie.notificacoes for select
  using (usuario_id = ie.usuario_id());

drop policy if exists notificacoes_marcar on ie.notificacoes;
create policy notificacoes_marcar on ie.notificacoes for update
  using (usuario_id = ie.usuario_id())
  with check (usuario_id = ie.usuario_id());

drop policy if exists notificacoes_apagar on ie.notificacoes;
create policy notificacoes_apagar on ie.notificacoes for delete
  using (usuario_id = ie.usuario_id());

drop policy if exists notificacoes_criar on ie.notificacoes;
create policy notificacoes_criar on ie.notificacoes for insert
  with check (ie.eh_admin() or usuario_id = ie.usuario_id());

-- ─── Configuração: todos leem, só o admin master altera ────────────────────

drop policy if exists tipos_evento_leitura on ie.tipos_evento;
create policy tipos_evento_leitura on ie.tipos_evento for select
  using (ie.autenticado());

drop policy if exists tipos_evento_admin on ie.tipos_evento;
create policy tipos_evento_admin on ie.tipos_evento for all
  using (ie.eh_admin()) with check (ie.eh_admin());

drop policy if exists categorias_leitura on ie.categorias_financeiras;
create policy categorias_leitura on ie.categorias_financeiras for select
  using (ie.autenticado());

drop policy if exists categorias_admin on ie.categorias_financeiras;
create policy categorias_admin on ie.categorias_financeiras for all
  using (ie.eh_admin()) with check (ie.eh_admin());
