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
 * SECURITY DEFINER de propósito, e é a única do arquivo.
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
    'usuarios', 'missoes', 'missao_indicadores', 'grupos_oracao',
    'tipos_evento', 'categorias_financeiras', 'eventos', 'evento_lancamentos'
  ] loop
    execute format('drop trigger if exists trg_%1$s_atualizado_em on ie.%1$I', t);
    execute format(
      'create trigger trg_%1$s_atualizado_em before update on ie.%1$I
       for each row execute function ie.tocar_atualizado_em()', t);
  end loop;
end $$;

-- ─── Habilitar RLS ─────────────────────────────────────────────────────────
/*
 * FORCE cobre o caso de a aplicação conectar como dona das tabelas. Não
 * substitui o cuidado com BYPASSRLS, que é mais forte e ignora até o FORCE.
 */
do $$
declare t text;
begin
  foreach t in array array[
    'usuarios', 'missoes', 'missao_indicadores',
    'grupos_oracao', 'grupo_responsaveis', 'tipos_evento',
    'categorias_financeiras', 'eventos', 'evento_lancamentos',
    'evento_documentos', 'evento_links'
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
