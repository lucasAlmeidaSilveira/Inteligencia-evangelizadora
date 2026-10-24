import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool, type PoolClient } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlDaAplicacao,
} from "./conexao";

/**
 * Prova, contra o banco real, que os três níveis de acesso valem no Postgres —
 * não apenas na interface.
 *
 *   pnpm db:testar-rls
 *
 * Roda inteiro dentro de uma transação que termina em ROLLBACK: nada dos
 * dados de teste sobrevive. Vale reexecutar após qualquer mudança em
 * `politicas.sql` ou no schema.
 */
let falhas = 0;

function conferir(descricao: string, condicao: boolean) {
  console.log(`${condicao ? "  ✓" : "  ✗"} ${descricao}`);
  if (!condicao) falhas++;
}

async function escopo(
  c: PoolClient,
  valores: {
    usuarioId?: string;
    papel?: string;
    missaoId?: string;
    /* Só o bloco do último acesso precisa: `ie.registrar_acesso()` encontra a
       pessoa por aqui, não pelo usuario_id. */
    firebaseUid?: string;
    /** Só o bloco da pesquisa pública: é a credencial do papel `pesquisa`. */
    pesquisaToken?: string;
  },
) {
  await c.query(
    `select set_config('app.usuario_id', $1, true),
            set_config('app.papel', $2, true),
            set_config('app.missao_id', $3, true),
            set_config('app.firebase_uid', $4, true),
            set_config('app.pesquisa_token', $5, true)`,
    [
      valores.usuarioId ?? "",
      valores.papel ?? "",
      valores.missaoId ?? "",
      valores.firebaseUid ?? "",
      valores.pesquisaToken ?? "",
    ],
  );
}

/** Executa algo que deve ser rejeitado e diz se foi mesmo. */
async function deveRejeitar(c: PoolClient, sql: string, valores: unknown[] = []) {
  await c.query("savepoint tentativa");
  try {
    await c.query(sql, valores);
    await c.query("release savepoint tentativa");
    return false;
  } catch {
    await c.query("rollback to savepoint tentativa");
    return true;
  }
}

async function principal() {
  const pool = new Pool({ ...configuracaoDeConexao(urlDaAplicacao()), max: 1 });
  const c = await pool.connect();

  try {
    await c.query("begin");
    await c.query(DEFINIR_SEARCH_PATH);

    /*
     * Antes de qualquer coisa: confirmar que este papel está mesmo sujeito ao
     * RLS. Um papel com BYPASSRLS ignora todas as políticas — mais forte até
     * que FORCE ROW LEVEL SECURITY — e faria todas as verificações abaixo
     * passarem por engano, dando um atestado de segurança falso.
     */
    const { rows: papelDb } = await c.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
    }>(`select current_user, rolbypassrls, rolsuper
          from pg_roles where rolname = current_user`);

    console.log(`\nConexão (papel: ${papelDb[0].current_user})`);
    conferir(
      "o papel da aplicação NÃO ignora o RLS",
      !papelDb[0].rolbypassrls && !papelDb[0].rolsuper,
    );

    if (papelDb[0].rolbypassrls || papelDb[0].rolsuper) {
      console.error(
        "\n✗ Este papel ignora as políticas. Rode `pnpm db:criar-papel` e use\n" +
          "  a DATABASE_URL que ele gera.\n",
      );
      process.exit(1);
    }

    /*
     * Toda tabela do schema precisa estar na lista de FORCE de politicas.sql.
     * Uma tabela nova fora dela nasce sem RLS nenhuma — ie_app já tem todos
     * os verbos por default privileges — e nenhuma verificação abaixo pegaria,
     * porque todas olham tabelas que já estão na lista. Esta pega a classe
     * inteira do esquecimento.
     */
    const { rows: semForce } = await c.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'ie' and c.relkind = 'r'
          and c.relname <> '__migrations'
          and not c.relforcerowsecurity
        order by 1`,
    );
    conferir(
      `toda tabela do schema tem RLS forçado${
        semForce.length ? ` (faltam: ${semForce.map((r) => r.relname).join(", ")})` : ""
      }`,
      semForce.length === 0,
    );

    /*
     * As SECURITY DEFINER são as únicas portas que ignoram as policies.
     * Precisam ter o search_path fixo e não podem estar executáveis por
     * PUBLIC — esta instância é compartilhada com outro sistema. A consulta
     * pega **todas** as definer do schema, não uma lista: uma função nova
     * esquecida no bloco de `revoke` apareceria aqui.
     *
     * `proacl is null` é o padrão do Postgres — e o padrão é PUBLIC poder
     * executar. Por isso nulo conta como público.
     */
    const { rows: definer } = await c.query<{
      proname: string;
      search_path_fixo: boolean;
      publico: boolean;
      dona_ignora_rls: boolean;
    }>(
      `select p.proname,
              coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false) as search_path_fixo,
              (p.proacl is null
               or exists (select 1 from unnest(p.proacl) a where a::text like '=X/%')) as publico,
              (r.rolbypassrls or r.rolsuper) as dona_ignora_rls
         from pg_proc p
         join pg_roles r on r.oid = p.proowner
        where p.pronamespace = 'ie'::regnamespace and p.prosecdef
        order by 1`,
    );
    conferir(
      `as quatro funções SECURITY DEFINER existem (${definer.map((f) => f.proname).join(", ")})`,
      definer.length === 4,
    );
    conferir(
      "todas têm search_path fixo",
      definer.every((f) => f.search_path_fixo),
    );
    conferir(
      "nenhuma delas é executável por PUBLIC",
      definer.every((f) => !f.publico),
    );
    /* Sob FORCE RLS a função só lê e escreve nas tabelas porque a dona ignora
       o RLS. Se um dia o schema for criado por um papel comum, a pesquisa
       pública para de gravar em silêncio — esta linha é o que avisa. */
    conferir(
      "a dona das funções ignora RLS (é o que as faz atravessar o FORCE)",
      definer.every((f) => f.dona_ignora_rls),
    );

    // ─── Cenário ────────────────────────────────────────────────────────────
    await escopo(c, { papel: "admin" });

    const { rows: missoesCriadas } = await c.query<{ id: string }>(
      `insert into missoes (nome, slug) values
         ('Missão Teste Norte', 'teste-norte'),
         ('Missão Teste Sul',   'teste-sul')
       returning id`,
    );
    const [norte, sul] = missoesCriadas.map((m) => m.id);

    const { rows: pessoas } = await c.query<{ id: string }>(
      `insert into usuarios (firebase_uid, nome, email, papel, missao_id) values
         ('teste-ana',   'Ana Responsável',   'ana@teste.local',   'responsavel', $1),
         ('teste-bruno', 'Bruno Auxiliar',    'bruno@teste.local', 'auxiliar',    $1),
         ('teste-carla', 'Carla Responsável', 'carla@teste.local', 'responsavel', $2)
       returning id`,
      [norte, sul],
    );
    const [ana, bruno, carla] = pessoas.map((p) => p.id);

    const { rows: tipos } = await c.query<{ id: string }>(
      "select id from tipos_evento limit 1",
    );

    /* Toda missão nasce com um centro principal — no sistema é `criarMissao`
       que o cria; aqui, que insere direto no banco, é este bloco. Sem ele os
       inserts de grupo e ação abaixo não teriam centro para apontar. */
    const { rows: centros } = await c.query<{ id: string }>(
      `insert into centros_evangelizacao (missao_id, nome, tipo, principal) values
         ($1, 'Centro do Norte', 'centro_evangelizacao', true),
         ($2, 'Centro do Sul',   'centro_evangelizacao', true)
       returning id`,
      [norte, sul],
    );
    const [centroNorte, centroSul] = centros.map((x) => x.id);

    const { rows: eventosCriados } = await c.query<{ id: string }>(
      `insert into eventos (missao_id, centro_id, tipo_evento_id, titulo, data_inicio, data_fim)
       values ($1, $4, $2, 'Evento do Norte', now(), now() + interval '2 hours'),
              ($3, $5, $2, 'Evento do Sul',   now(), now() + interval '2 hours')
       returning id`,
      [norte, tipos[0].id, sul, centroNorte, centroSul],
    );
    const [eventoNorte, eventoSul] = eventosCriados.map((e) => e.id);

    // ─── Estrutura: um responsável por missão ───────────────────────────────
    console.log("\nEstrutura de papéis");
    conferir(
      "recusa um segundo responsável na mesma missão",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-dup', 'Duplicado', 'dup@teste.local', 'responsavel', $1)`,
        [norte],
      ),
    );
    conferir(
      "recusa administrador vinculado a uma missão",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-adm', 'Admin', 'adm@teste.local', 'admin', $1)`,
        [norte],
      ),
    );
    conferir(
      "recusa auxiliar sem missão",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-solto', 'Solto', 'solto@teste.local', 'auxiliar', null)`,
      ),
    );

    // ─── Ana: responsável pelo Norte ────────────────────────────────────────
    console.log("\nAna (responsável — Missão Norte)");
    await escopo(c, { usuarioId: ana, papel: "responsavel", missaoId: norte });

    const vistas = await c.query("select nome from missoes");
    conferir(
      `enxerga só a sua missão (viu ${vistas.rowCount})`,
      vistas.rowCount === 1 && vistas.rows[0].nome === "Missão Teste Norte",
    );

    const eventos = await c.query("select titulo from eventos");
    conferir("enxerga só os eventos da sua missão", eventos.rowCount === 1);

    const centrosVistos = await c.query("select nome from centros_evangelizacao");
    conferir(
      "enxerga só os centros da sua missão",
      centrosVistos.rowCount === 1 &&
        centrosVistos.rows[0].nome === "Centro do Norte",
    );

    /*
     * A prova da chave composta (centro_id, missao_id).
     *
     * O RLS sozinho não pegaria isto: a linha inserida é da missão da Ana, e
     * passa nas policies. O que barra é o par não existir em
     * `centros_evangelizacao` — sem ele, um grupo do Norte passaria a apontar
     * para um centro do Sul, e dado de outra missão entraria pela porta dos
     * fundos, sem erro nenhum.
     */
    conferir(
      "não vincula grupo da sua missão a centro de outra",
      await deveRejeitar(
        c,
        `insert into grupos_oracao (missao_id, centro_id, nome)
         values ($1, $2, 'Grupo com Centro Alheio')`,
        [norte, centroSul],
      ),
    );

    conferir(
      "não vincula ação da sua missão a centro de outra",
      await deveRejeitar(
        c,
        `insert into eventos (missao_id, centro_id, tipo_evento_id, titulo, data_inicio, data_fim)
         values ($1, $2, $3, 'Ação com Centro Alheio', now(), now() + interval '1 hour')`,
        [norte, centroSul, tipos[0].id],
      ),
    );

    conferir(
      "não cadastra centro na missão alheia",
      await deveRejeitar(
        c,
        `insert into centros_evangelizacao (missao_id, nome, tipo)
         values ($1, 'Centro Invasor', 'irradiacao')`,
        [sul],
      ),
    );

    conferir(
      "edita o cadastro da própria missão",
      (await c.query("update missoes set membros_total = 50 where id = $1", [norte]))
        .rowCount === 1,
    );

    conferir(
      "não altera a missão alheia",
      (await c.query("update missoes set membros_total = 999 where id = $1", [sul]))
        .rowCount === 0,
    );

    conferir(
      "não cria missão nova",
      await deveRejeitar(
        c,
        "insert into missoes (nome, slug) values ('Pirata', 'pirata')",
      ),
    );

    conferir(
      "convida auxiliar para a própria missão",
      !(await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-novo', 'Novo Auxiliar', 'novo@teste.local', 'auxiliar', $1)`,
        [norte],
      )),
    );

    conferir(
      "não cria outro responsável",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-r2', 'Outro', 'outro@teste.local', 'responsavel', $1)`,
        [sul],
      ),
    );

    conferir(
      "não cria administrador",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-a2', 'Falso Admin', 'falso@teste.local', 'admin', null)`,
      ),
    );

    conferir(
      "não convida para outra missão",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-x', 'Invasor', 'invasor@teste.local', 'auxiliar', $1)`,
        [sul],
      ),
    );

    // A linha antiga passa no USING (auxiliar da mesma missão), mas a nova
    // reprova no WITH CHECK. Nesse caso o Postgres lança erro em vez de
    // afetar zero linhas — mais explícito, e é o que se espera aqui.
    conferir(
      "não promove o próprio auxiliar a responsável",
      await deveRejeitar(
        c,
        "update usuarios set papel = 'responsavel' where id = $1",
        [bruno],
      ),
    );

    conferir(
      "não enxerga usuários de outra missão",
      (await c.query("select 1 from usuarios where id = $1", [carla])).rowCount === 0,
    );

    // ─── Último acesso ──────────────────────────────────────────────────────
    /*
     * `ultimo_acesso_em` é escrito por `ie.registrar_acesso()`, e não por um
     * UPDATE da aplicação, porque não existe — nem deve existir — policy que
     * deixe alguém alterar a própria linha de `usuarios`: policy autoriza a
     * linha inteira, e liberaria junto o `set papel = 'admin'`.
     *
     * As verificações seguram as duas pontas: o caminho direto continua
     * fechado, e o caminho pela função só alcança a linha de quem está no
     * escopo.
     */
    console.log("\nÚltimo acesso");
    const comoAna = () =>
      escopo(c, {
        usuarioId: ana,
        papel: "responsavel",
        missaoId: norte,
        firebaseUid: "teste-ana",
      });

    const carimboDaAna = async () =>
      (
        await c.query<{ ultimo_acesso_em: Date | null }>(
          "select ultimo_acesso_em from usuarios where id = $1",
          [ana],
        )
      ).rows[0].ultimo_acesso_em;

    await comoAna();

    conferir(
      "UPDATE direto de ultimo_acesso_em na própria linha não afeta nada",
      (
        await c.query(
          "update usuarios set ultimo_acesso_em = now() where id = $1",
          [ana],
        )
      ).rowCount === 0,
    );

    conferir(
      "nem na linha de quem é de outra missão",
      (
        await c.query(
          "update usuarios set ultimo_acesso_em = now() where id = $1",
          [carla],
        )
      ).rowCount === 0,
    );

    await c.query("select ie.registrar_acesso()");

    conferir(
      "a função carimba a linha de quem está no escopo",
      (await carimboDaAna()) !== null,
    );

    conferir(
      "e não encosta na de mais ninguém",
      (
        await c.query(
          `select 1 from usuarios
            where ultimo_acesso_em is not null and id in ($1, $2)`,
          [bruno, carla],
        )
      ).rowCount === 0,
    );

    /*
     * A janela de 15 minutos. `now()` é o instante de início da transação e
     * não avança durante o teste, então quem envelhece o carimbo é o admin —
     * que tem policy para isso — e a função decide escrever a partir dele.
     */
    await escopo(c, { papel: "admin" });
    await c.query(
      "update usuarios set ultimo_acesso_em = now() - interval '1 hour' where id = $1",
      [ana],
    );
    const antigo = await carimboDaAna();
    await comoAna();
    await c.query("select ie.registrar_acesso()");

    conferir(
      "fora da janela, atualiza o carimbo",
      (await carimboDaAna())!.getTime() > antigo!.getTime(),
    );

    await escopo(c, { papel: "admin" });
    await c.query(
      "update usuarios set ultimo_acesso_em = now() - interval '1 minute' where id = $1",
      [ana],
    );
    const recente = await carimboDaAna();
    await comoAna();
    await c.query("select ie.registrar_acesso()");

    conferir(
      "dentro da janela, não escreve de novo",
      (await carimboDaAna())!.getTime() === recente!.getTime(),
    );

    // Sem firebase_uid no escopo o UPDATE não encontra linha alguma: nenhum
    // carimbo cai numa pessoa arbitrária.
    await escopo(c, {});
    await c.query("select ie.registrar_acesso()");
    await escopo(c, { papel: "admin" });

    conferir(
      "escopo vazio não carimba ninguém",
      (
        await c.query(
          `select 1 from usuarios
            where ultimo_acesso_em is not null and id in ($1, $2)`,
          [bruno, carla],
        )
      ).rowCount === 0,
    );

    // ─── Bruno: auxiliar do Norte ───────────────────────────────────────────
    console.log("\nBruno (auxiliar — Missão Norte)");
    await escopo(c, { usuarioId: bruno, papel: "auxiliar", missaoId: norte });

    conferir(
      "enxerga a sua missão",
      (await c.query("select 1 from missoes")).rowCount === 1,
    );

    conferir(
      "registra grupo de oração",
      !(await deveRejeitar(
        c,
        `insert into grupos_oracao (missao_id, centro_id, nome)
         values ($1, $2, 'Grupo do Bruno')`,
        [norte, centroNorte],
      )),
    );

    conferir(
      "registra ação apostólica",
      !(await deveRejeitar(
        c,
        `insert into eventos (missao_id, centro_id, tipo_evento_id, titulo, data_inicio, data_fim)
         values ($1, $3, $2, 'Ação do Bruno', now(), now() + interval '1 hour')`,
        [norte, tipos[0].id, centroNorte],
      )),
    );

    // Abrir uma frente nova é trabalho de quem está na missão, como cadastrar
    // grupo. O que o auxiliar não faz é alterar o cadastro da missão — logo
    // abaixo.
    conferir(
      "abre irradiação na própria missão",
      !(await deveRejeitar(
        c,
        `insert into centros_evangelizacao (missao_id, nome, tipo)
         values ($1, 'Irradiação do Bruno', 'irradiacao')`,
        [norte],
      )),
    );

    conferir(
      "NÃO altera o cadastro da missão",
      (await c.query("update missoes set nome = 'Renomeada' where id = $1", [norte]))
        .rowCount === 0,
    );

    conferir(
      "NÃO convida ninguém",
      await deveRejeitar(
        c,
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
         values ('teste-b1', 'Convidado', 'conv@teste.local', 'auxiliar', $1)`,
        [norte],
      ),
    );

    // ─── Carla: responsável pelo Sul ────────────────────────────────────────
    console.log("\nCarla (responsável — Missão Sul)");
    await escopo(c, { usuarioId: carla, papel: "responsavel", missaoId: sul });
    conferir(
      "enxerga apenas a Missão Sul",
      (await c.query("select nome from missoes")).rows[0]?.nome ===
        "Missão Teste Sul",
    );

    // ─── Administrador master ───────────────────────────────────────────────
    console.log("\nAdministrador master");
    await escopo(c, { papel: "admin" });
    conferir(
      "enxerga as duas missões",
      (await c.query("select 1 from missoes where id in ($1,$2)", [norte, sul]))
        .rowCount === 2,
    );
    conferir(
      "enxerga todos os usuários criados",
      (await c.query("select 1 from usuarios where id in ($1,$2,$3)", [ana, bruno, carla]))
        .rowCount === 3,
    );

    /*
     * Apagar missão com as duas cascatas ativas — centros e grupos — depende
     * de o FK composto ser `no action`, conferido no fim do comando. Com
     * `restrict` ele dispararia no meio da cascata e recusaria a exclusão da
     * missão inteira, o que só apareceria em produção.
     *
     * Roda num savepoint: o cenário acima continua de pé para o resto.
     */
    await c.query("savepoint apagar_missao");
    await c.query("delete from usuarios where missao_id = $1", [sul]);
    conferir(
      "apaga missão com centros e grupos, sem travar no FK composto",
      !(await deveRejeitar(c, "delete from missoes where id = $1", [sul])),
    );
    await c.query("rollback to savepoint apagar_missao");

    // ─── Sem sessão ─────────────────────────────────────────────────────────
    console.log("\nSem sessão (escopo vazio)");
    await escopo(c, {});
    conferir(
      "não enxerga missão alguma",
      (await c.query("select id from missoes")).rowCount === 0,
    );
    conferir(
      "não enxerga centro de evangelização algum",
      (await c.query("select id from centros_evangelizacao")).rowCount === 0,
    );
    conferir(
      "não enxerga nem as tabelas de configuração",
      (await c.query("select id from tipos_evento")).rowCount === 0,
    );

    // ─── Pesquisa pública ───────────────────────────────────────────────────
    /*
     * O papel `pesquisa` é o único sem sessão que chega ao banco. Ele não tem
     * policy em tabela alguma: o que alcança são duas funções SECURITY
     * DEFINER, e é isso que se prova aqui — pelos dois lados. As tabelas
     * continuam fechadas, e as funções só respondem ao token certo, aberto e
     * no prazo.
     */
    console.log("\nPesquisa pública (papel pesquisa)");
    const TOKEN_NORTE = "a".repeat(43);
    const TOKEN_SUL = "b".repeat(43);
    const TOKEN_ERRADO = "c".repeat(43);

    await escopo(c, { papel: "admin" });
    const { rows: pesquisas } = await c.query<{ id: string }>(
      `insert into evento_pesquisas (evento_id, token, aberta, encerra_em) values
         ($1, $3, true,  now() + interval '14 days'),
         ($2, $4, false, now() + interval '14 days')
       returning id`,
      [eventoNorte, eventoSul, TOKEN_NORTE, TOKEN_SUL],
    );
    const pesquisaNorte = pesquisas[0].id;
    const pesquisaSul = pesquisas[1].id;

    /* Com ids literais, de propósito: um `insert … select` de uma tabela que
       o papel não enxerga insere zero linhas e "passa" sem o RLS ser sequer
       consultado. A prova precisa de uma linha concreta sendo recusada. */
    const INSERIR_RESPOSTA = `insert into evento_respostas (pesquisa_id, evento_id, nota)
                              values ($1, $2, 10)`;

    await escopo(c, { papel: "pesquisa", pesquisaToken: TOKEN_NORTE });

    for (const tabela of [
      "eventos",
      "evento_pesquisas",
      "evento_respostas",
      "usuarios",
      "missoes",
      "tipos_evento",
    ]) {
      conferir(
        `não enxerga linha alguma de ${tabela}`,
        (await c.query(`select 1 from ${tabela}`)).rowCount === 0,
      );
    }

    conferir(
      "não insere resposta direto na tabela",
      await deveRejeitar(c, INSERIR_RESPOSTA, [pesquisaNorte, eventoNorte]),
    );
    conferir(
      "não altera a pesquisa",
      (await c.query("update evento_pesquisas set aberta = false")).rowCount ===
        0,
    );
    conferir(
      "não apaga pesquisa nem resposta",
      (await c.query("delete from evento_pesquisas")).rowCount === 0 &&
        (await c.query("delete from evento_respostas")).rowCount === 0,
    );

    const publica = await c.query<{ titulo: string; aceita: boolean }>(
      "select * from ie.pesquisa_do_token()",
    );
    conferir(
      "pesquisa_do_token() devolve só título e se aceita — e nada mais",
      publica.rowCount === 1 &&
        publica.rows[0].titulo === "Evento do Norte" &&
        publica.rows[0].aceita === true &&
        Object.keys(publica.rows[0]).sort().join(",") === "aceita,titulo",
    );

    const respondida = await c.query<{ evento_id: string }>(
      "select ie.responder_pesquisa(9, 'Ótima ação') as evento_id",
    );
    conferir(
      "responder_pesquisa() grava e devolve a ação do token",
      respondida.rows[0]?.evento_id === eventoNorte,
    );
    await c.query("select ie.responder_pesquisa(8, '   ')");
    conferir(
      "nota fora da escala é recusada",
      await deveRejeitar(c, "select ie.responder_pesquisa(11, null)"),
    );
    conferir(
      "comentário acima de 500 caracteres é recusado",
      await deveRejeitar(c, "select ie.responder_pesquisa(8, $1)", [
        "x".repeat(501),
      ]),
    );

    /* `now()` é fixo dentro da transação: todas as respostas caem na mesma
       janela de 60 segundos, e a 120ª chamada total (2 já gravadas + 118)
       passa, a 121ª não. */
    let aceitas = 2;
    let recusouNaSeguinte = false;
    for (let i = 0; i < 125; i++) {
      const rejeitou = await deveRejeitar(
        c,
        "select ie.responder_pesquisa(7, null)",
      );
      if (!rejeitou) aceitas++;
      else {
        recusouNaSeguinte = aceitas === 120;
        break;
      }
    }
    conferir(
      `limite de 120 respostas por minuto (aceitou ${aceitas})`,
      aceitas === 120 && recusouNaSeguinte,
    );

    await escopo(c, { papel: "pesquisa", pesquisaToken: TOKEN_ERRADO });
    conferir(
      "token desconhecido não vê pesquisa",
      (await c.query("select 1 from ie.pesquisa_do_token()")).rowCount === 0,
    );
    conferir(
      "token desconhecido não responde",
      await deveRejeitar(c, "select ie.responder_pesquisa(10, null)"),
    );

    await escopo(c, { papel: "pesquisa", pesquisaToken: TOKEN_SUL });
    const encerrada = await c.query<{ aceita: boolean }>(
      "select aceita from ie.pesquisa_do_token()",
    );
    conferir(
      "pesquisa encerrada ainda se identifica, como 'não aceita'",
      encerrada.rowCount === 1 && encerrada.rows[0].aceita === false,
    );
    conferir(
      "mas não aceita resposta",
      await deveRejeitar(c, "select ie.responder_pesquisa(10, null)"),
    );

    // Aberta, mas com o prazo vencido: o `aberta = true` sozinho não basta.
    await escopo(c, { papel: "admin" });
    await c.query(
      "update evento_pesquisas set aberta = true, encerra_em = now() - interval '1 second' where id = $1",
      [pesquisaSul],
    );
    await escopo(c, { papel: "pesquisa", pesquisaToken: TOKEN_SUL });
    conferir(
      "aberta mas vencida também não aceita",
      (await c.query<{ aceita: boolean }>("select aceita from ie.pesquisa_do_token()"))
        .rows[0]?.aceita === false &&
        (await deveRejeitar(c, "select ie.responder_pesquisa(10, null)")),
    );

    // Token certo com pessoa no escopo, ou papel de pessoa com token: nada.
    await escopo(c, {
      usuarioId: ana,
      papel: "responsavel",
      missaoId: norte,
      pesquisaToken: TOKEN_NORTE,
    });
    conferir(
      "responsável com token no escopo não responde pela função",
      await deveRejeitar(c, "select ie.responder_pesquisa(10, null)"),
    );
    await escopo(c, {
      usuarioId: ana,
      papel: "pesquisa",
      pesquisaToken: TOKEN_NORTE,
    });
    conferir(
      "papel pesquisa com usuário no escopo não responde",
      await deveRejeitar(c, "select ie.responder_pesquisa(10, null)"),
    );

    // ─── Coordenadores e as respostas ───────────────────────────────────────
    console.log("\nCoordenadores e a pesquisa");
    await escopo(c, { usuarioId: carla, papel: "responsavel", missaoId: sul });
    conferir(
      "Carla (Sul) não vê respostas do Norte",
      (await c.query("select 1 from evento_respostas")).rowCount === 0,
    );
    conferir(
      "Carla não vê o token da pesquisa do Norte",
      (
        await c.query("select 1 from evento_pesquisas where token = $1", [
          TOKEN_NORTE,
        ])
      ).rowCount === 0,
    );

    await escopo(c, { usuarioId: ana, papel: "responsavel", missaoId: norte });
    conferir(
      `Ana (Norte) vê as respostas da sua ação (${aceitas})`,
      (await c.query("select 1 from evento_respostas")).rowCount === aceitas,
    );
    conferir(
      "comentário só de espaços foi gravado como nulo",
      (
        await c.query(
          "select 1 from evento_respostas where nota = 8 and comentario is null",
        )
      ).rowCount === 1,
    );
    conferir(
      "Ana não insere resposta à mão",
      await deveRejeitar(c, INSERIR_RESPOSTA, [pesquisaNorte, eventoNorte]),
    );
    conferir(
      "Ana não altera uma resposta",
      (await c.query("update evento_respostas set nota = 10")).rowCount === 0,
    );
    conferir(
      "Ana modera: apaga uma resposta",
      (
        await c.query(
          `delete from evento_respostas where id = (
             select id from evento_respostas limit 1)`,
        )
      ).rowCount === 1,
    );

    await escopo(c, { usuarioId: bruno, papel: "auxiliar", missaoId: norte });
    conferir(
      "Bruno (auxiliar) não abre pesquisa para ação de outra missão",
      await deveRejeitar(
        c,
        `insert into evento_pesquisas (evento_id, token, encerra_em)
         values ($1, $2, now() + interval '7 days')`,
        [eventoSul, "d".repeat(43)],
      ),
    );
    conferir(
      "Bruno troca o link da pesquisa da própria missão",
      (
        await c.query(
          "update evento_pesquisas set token = $1 where evento_id = $2",
          ["e".repeat(43), eventoNorte],
        )
      ).rowCount === 1,
    );

    // ─── Histórico da ação ──────────────────────────────────────────────────
    /*
     * As triggers de `politicas.sql` escrevem em `evento_historico` no escopo
     * de quem editou. O que se prova: a linha nasce com o nome certo e o diff
     * certo; herda o acesso da ação (Carla não vê); ninguém edita nem apaga;
     * e apagar a ação não tropeça nas triggers dos filhos durante a cascata —
     * que é a falha que só apareceria em produção, ao excluir uma ação com
     * lançamentos.
     */
    console.log("\nHistórico da ação");
    await escopo(c, { usuarioId: bruno, papel: "auxiliar", missaoId: norte });

    await c.query(
      "update eventos set titulo = 'Evento do Norte, revisto', local = 'Salão' where id = $1",
      [eventoNorte],
    );
    const { rows: historico } = await c.query<{
      tipo: string;
      usuario_nome: string | null;
      detalhes: { alteracoes?: { campo: string; de: unknown; para: unknown }[] };
    }>(
      `select tipo, usuario_nome, detalhes from evento_historico
        where evento_id = $1 and tipo = 'acao_alterada'
        order by registrado_em desc limit 1`,
      [eventoNorte],
    );
    const campos = historico[0]?.detalhes.alteracoes?.map((a) => a.campo).sort();
    conferir(
      "edição de Bruno vira linha com o nome dele e os dois campos alterados",
      historico[0]?.usuario_nome === "Bruno Auxiliar" &&
        campos?.join(",") === "local,titulo",
    );

    const antes = (
      await c.query("select count(*)::int as n from evento_historico where evento_id = $1", [eventoNorte])
    ).rows[0].n as number;
    await c.query("update eventos set titulo = 'Evento do Norte, revisto' where id = $1", [eventoNorte]);
    conferir(
      "salvar sem mudar nada não gera linha",
      (
        await c.query("select count(*)::int as n from evento_historico where evento_id = $1", [eventoNorte])
      ).rows[0].n === antes,
    );

    conferir(
      "Bruno não edita o histórico",
      (
        await c.query(
          "update evento_historico set usuario_nome = 'Forjado' where evento_id = $1",
          [eventoNorte],
        )
      ).rowCount === 0,
    );
    conferir(
      "nem apaga",
      (
        await c.query("delete from evento_historico where evento_id = $1", [eventoNorte])
      ).rowCount === 0,
    );

    await escopo(c, { usuarioId: carla, papel: "responsavel", missaoId: sul });
    conferir(
      "Carla (Sul) não vê o histórico do Norte",
      (
        await c.query("select 1 from evento_historico where evento_id = $1", [eventoNorte])
      ).rowCount === 0,
    );

    /* A cascata: ação com lançamento, link e pesquisa — cada filho tem trigger
       de DELETE que tentaria registrar numa ação que já se foi. Num savepoint,
       para o rollback final continuar encontrando o cenário. */
    await escopo(c, { usuarioId: ana, papel: "responsavel", missaoId: norte });
    await c.query("savepoint apagar_acao");
    await c.query(
      `insert into evento_lancamentos (evento_id, tipo, descricao, valor, data)
       values ($1, 'despesa', 'Som', 100, current_date)`,
      [eventoNorte],
    );
    await c.query(
      "insert into evento_links (evento_id, titulo, url) values ($1, 'Fotos', 'https://exemplo.local')",
      [eventoNorte],
    );
    conferir(
      "apaga ação com lançamento, link, pesquisa e histórico, sem travar nas triggers",
      !(await deveRejeitar(c, "delete from eventos where id = $1", [eventoNorte])),
    );
    await c.query("rollback to savepoint apagar_acao");
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
    await pool.end();
  }

  if (falhas) {
    console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
    process.exit(1);
  }
  console.log(
    "\n✓ Três níveis de acesso e o escopo da pesquisa pública confirmados no banco.\n",
  );
}

principal().catch((erro) => {
  console.error("\n✗ Erro:", erro?.message ?? erro);
  process.exit(1);
});
