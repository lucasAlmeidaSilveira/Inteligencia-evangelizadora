-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security — Inteligência Evangelizadora
--
-- Arquivo idempotente: reaplicado a cada `pnpm db:migrate`. Toda função usa
-- CREATE OR REPLACE e toda policy é derrubada antes de ser recriada.
--
-- Contexto: usando Firebase Auth, o Postgres não conhece o usuário final.
-- Quem informa é a aplicação, via `set_config('app.*', ..., true)` no início
-- de cada transação (ver src/server/db/escopo.ts). Como o escopo é local à
-- transação, ele nunca sobrevive para a próxima requisição que reutilizar a
-- mesma conexão do pool.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Leitura do escopo da requisição ───────────────────────────────────────

create or replace function ie.usuario_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

create or replace function ie.firebase_uid() returns text
  language sql stable
  as $$ select nullif(current_setting('app.firebase_uid', true), '') $$;

create or replace function ie.eh_admin() returns boolean
  language sql stable
  as $$ select coalesce(current_setting('app.eh_admin', true), 'off') = 'on' $$;

-- Sem escopo definido não existe usuário: nega tudo por omissão.
create or replace function ie.autenticado() returns boolean
  language sql stable
  as $$ select ie.usuario_id() is not null $$;

/*
 * Admin enxerga qualquer missão; os demais, apenas as vinculadas a si.
 * Consulta `usuario_missoes`, cuja policy depende somente das funções acima —
 * a cadeia é de mão única, então não há recursão de policies.
 */
create or replace function ie.tem_acesso_missao(alvo uuid) returns boolean
  language sql stable
  as $$
    select ie.eh_admin() or exists (
      select 1 from ie.usuario_missoes um
      where um.missao_id = alvo
        and um.usuario_id = ie.usuario_id()
    )
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
 * FORCE é indispensável aqui. O Render entrega um usuário que é dono das
 * tabelas, e o dono ignora RLS por padrão — sem FORCE, todas as policies
 * abaixo seriam decorativas.
 */
do $$
declare t text;
begin
  foreach t in array array[
    'usuarios', 'usuario_missoes', 'missoes', 'missao_indicadores',
    'grupos_oracao', 'grupo_responsaveis', 'tipos_evento',
    'categorias_financeiras', 'eventos', 'evento_lancamentos',
    'evento_documentos', 'evento_links'
  ] loop
    execute format('alter table ie.%I enable row level security', t);
    execute format('alter table ie.%I force row level security', t);
  end loop;
end $$;

-- ─── Identidade ────────────────────────────────────────────────────────────

drop policy if exists usuarios_leitura on ie.usuarios;
create policy usuarios_leitura on ie.usuarios for select
  using (firebase_uid = ie.firebase_uid() or ie.eh_admin());

drop policy if exists usuarios_admin on ie.usuarios;
create policy usuarios_admin on ie.usuarios for all
  using (ie.eh_admin()) with check (ie.eh_admin());

/*
 * Aceita também a identificação pelo firebase_uid. Sem isso, carregar o
 * usuário exigiria duas idas ao banco: uma para descobrir o id e outra,
 * depois de reaplicar o escopo, para ler os vínculos. Com o banco distante,
 * cada ida a menos vale mais que a consulta em si.
 *
 * A subconsulta em `usuarios` não gera recursão: a policy de `usuarios`
 * depende apenas das funções de escopo, nunca de `usuario_missoes`.
 */
drop policy if exists usuario_missoes_leitura on ie.usuario_missoes;
create policy usuario_missoes_leitura on ie.usuario_missoes for select
  using (
    ie.eh_admin()
    or usuario_id = ie.usuario_id()
    or usuario_id = (
      select u.id from ie.usuarios u where u.firebase_uid = ie.firebase_uid()
    )
  );

drop policy if exists usuario_missoes_admin on ie.usuario_missoes;
create policy usuario_missoes_admin on ie.usuario_missoes for all
  using (ie.eh_admin()) with check (ie.eh_admin());

-- ─── Missões ───────────────────────────────────────────────────────────────

drop policy if exists missoes_leitura on ie.missoes;
create policy missoes_leitura on ie.missoes for select
  using (ie.tem_acesso_missao(id));

-- Criar e apagar missão é ato de admin; editar a própria, não.
drop policy if exists missoes_criar on ie.missoes;
create policy missoes_criar on ie.missoes for insert
  with check (ie.eh_admin());

drop policy if exists missoes_editar on ie.missoes;
create policy missoes_editar on ie.missoes for update
  using (ie.tem_acesso_missao(id)) with check (ie.tem_acesso_missao(id));

drop policy if exists missoes_apagar on ie.missoes;
create policy missoes_apagar on ie.missoes for delete
  using (ie.eh_admin());

-- ─── Tudo que pertence a uma missão ────────────────────────────────────────

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

-- ─── Configuração: todos leem, só admin altera ─────────────────────────────

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
