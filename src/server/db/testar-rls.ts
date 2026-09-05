import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool, type PoolClient } from "pg";

/**
 * Prova, contra o banco real, que um responsável não alcança dados de outra
 * missão — nem lendo, nem escrevendo.
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
  valores: { usuarioId?: string; ehAdmin?: boolean },
) {
  await c.query(
    "select set_config('app.usuario_id', $1, true), set_config('app.eh_admin', $2, true)",
    [valores.usuarioId ?? "", valores.ehAdmin ? "on" : "off"],
  );
}

async function principal() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    options: `-c search_path=${process.env.DB_SCHEMA ?? "ie"},public`,
  });

  const c = await pool.connect();

  try {
    await c.query("begin");
    await escopo(c, { ehAdmin: true });

    // ─── Cenário ────────────────────────────────────────────────────────────
    const { rows: missoes } = await c.query<{ id: string }>(
      `insert into missoes (nome, slug) values
         ('Missão Teste Norte', 'teste-norte'),
         ('Missão Teste Sul',   'teste-sul')
       returning id`,
    );
    const [norte, sul] = missoes.map((m) => m.id);

    const { rows: pessoas } = await c.query<{ id: string }>(
      `insert into usuarios (firebase_uid, nome, email, papel) values
         ('teste-ana',  'Ana Teste',  'ana@teste.local',  'responsavel'),
         ('teste-bruno','Bruno Teste','bruno@teste.local','responsavel')
       returning id`,
    );
    const [ana, bruno] = pessoas.map((p) => p.id);

    await c.query(
      `insert into usuario_missoes (usuario_id, missao_id)
       values ($1, $2), ($3, $4)`,
      [ana, norte, bruno, sul],
    );

    const { rows: tipos } = await c.query<{ id: string }>(
      "select id from tipos_evento limit 1",
    );

    await c.query(
      `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
       values ($1, $2, 'Evento do Norte', now(), now() + interval '2 hours'),
              ($3, $2, 'Evento do Sul',   now(), now() + interval '2 hours')`,
      [norte, tipos[0].id, sul],
    );

    // ─── Ana: responsável apenas pela Missão Norte ──────────────────────────
    console.log("\nAna (responsável — Missão Norte)");
    await escopo(c, { usuarioId: ana });

    const vistas = await c.query("select nome from missoes order by nome");
    conferir(
      `enxerga 1 missão, a sua (viu ${vistas.rowCount})`,
      vistas.rowCount === 1 && vistas.rows[0].nome === "Missão Teste Norte",
    );

    const eventos = await c.query("select titulo from eventos");
    conferir(
      `enxerga 1 evento, o da sua missão (viu ${eventos.rowCount})`,
      eventos.rowCount === 1 && eventos.rows[0].titulo === "Evento do Norte",
    );

    const porId = await c.query("select 1 from missoes where id = $1", [sul]);
    conferir(
      "não alcança a Missão Sul nem pedindo pelo ID direto",
      porId.rowCount === 0,
    );

    const alterar = await c.query(
      "update missoes set membros_total = 999 where id = $1",
      [sul],
    );
    conferir(
      "não consegue alterar a Missão Sul (0 linhas afetadas)",
      alterar.rowCount === 0,
    );

    let bloqueou = false;
    try {
      await c.query("savepoint tentativa");
      await c.query(
        `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
         values ($1, $2, 'Invasão', now(), now() + interval '1 hour')`,
        [sul, tipos[0].id],
      );
      await c.query("release savepoint tentativa");
    } catch {
      bloqueou = true;
      await c.query("rollback to savepoint tentativa");
    }
    conferir("não consegue criar evento na Missão Sul", bloqueou);

    let criouMissao = false;
    try {
      await c.query("savepoint tentativa2");
      await c.query(
        "insert into missoes (nome, slug) values ('Pirata', 'pirata')",
      );
      criouMissao = true;
      await c.query("release savepoint tentativa2");
    } catch {
      await c.query("rollback to savepoint tentativa2");
    }
    conferir("não consegue criar missão nova (é ato de admin)", !criouMissao);

    // ─── Bruno: o espelho ───────────────────────────────────────────────────
    console.log("\nBruno (responsável — Missão Sul)");
    await escopo(c, { usuarioId: bruno });

    const dele = await c.query("select nome from missoes");
    conferir(
      "enxerga apenas a Missão Sul",
      dele.rowCount === 1 && dele.rows[0].nome === "Missão Teste Sul",
    );

    // ─── Admin ──────────────────────────────────────────────────────────────
    console.log("\nAdministrador");
    await escopo(c, { ehAdmin: true });

    const todas = await c.query("select id from missoes where id in ($1, $2)", [
      norte,
      sul,
    ]);
    conferir("enxerga as duas missões", todas.rowCount === 2);

    const todosEventos = await c.query(
      "select id from eventos where missao_id in ($1, $2)",
      [norte, sul],
    );
    conferir("enxerga os dois eventos", todosEventos.rowCount === 2);

    // ─── Sem escopo: ninguém ────────────────────────────────────────────────
    console.log("\nSem sessão (escopo vazio)");
    await escopo(c, {});

    const anonimo = await c.query("select id from missoes");
    conferir("não enxerga missão alguma", anonimo.rowCount === 0);

    const config = await c.query("select id from tipos_evento");
    conferir(
      "não enxerga nem as tabelas de configuração",
      config.rowCount === 0,
    );
  } finally {
    // Nada do teste permanece no banco.
    await c.query("rollback").catch(() => undefined);
    c.release();
    await pool.end();
  }

  if (falhas) {
    console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
    process.exit(1);
  }
  console.log("\n✓ Isolamento entre missões confirmado.\n");
}

principal().catch((erro) => {
  console.error("\n✗ Erro:", erro?.message ?? erro);
  process.exit(1);
});
