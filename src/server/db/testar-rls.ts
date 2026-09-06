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
  valores: { usuarioId?: string; papel?: string; missaoId?: string },
) {
  await c.query(
    `select set_config('app.usuario_id', $1, true),
            set_config('app.papel', $2, true),
            set_config('app.missao_id', $3, true)`,
    [valores.usuarioId ?? "", valores.papel ?? "", valores.missaoId ?? ""],
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

    await c.query(
      `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
       values ($1, $2, 'Evento do Norte', now(), now() + interval '2 hours'),
              ($3, $2, 'Evento do Sul',   now(), now() + interval '2 hours')`,
      [norte, tipos[0].id, sul],
    );

    const { rows: centros } = await c.query<{ id: string }>(
      `insert into centros_evangelizacao (missao_id, nome, tipo) values
         ($1, 'Centro do Norte', 'centro_evangelizacao'),
         ($2, 'Centro do Sul',   'irradiacao')
       returning id`,
      [norte, sul],
    );
    const [, centroSul] = centros.map((x) => x.id);

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
        "insert into grupos_oracao (missao_id, nome) values ($1, 'Grupo do Bruno')",
        [norte],
      )),
    );

    conferir(
      "registra ação apostólica",
      !(await deveRejeitar(
        c,
        `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
         values ($1, $2, 'Ação do Bruno', now(), now() + interval '1 hour')`,
        [norte, tipos[0].id],
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
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
    await pool.end();
  }

  if (falhas) {
    console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
    process.exit(1);
  }
  console.log("\n✓ Três níveis de acesso confirmados no banco.\n");
}

principal().catch((erro) => {
  console.error("\n✗ Erro:", erro?.message ?? erro);
  process.exit(1);
});
