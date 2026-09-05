import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool, type PoolClient } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlDaAplicacao,
} from "./conexao";

/**
 * Confere que as regras de domínio são impostas pelo banco, não só pela
 * interface — o que importa, porque um bug no front, um script ou um acesso
 * direto ao Postgres passariam por cima da validação da tela.
 *
 *   pnpm db:testar-regras
 *
 * Roda em transação revertida: não deixa resíduo.
 */
let falhas = 0;

function ok(descricao: string, condicao: boolean) {
  console.log(`${condicao ? "  ✓" : "  ✗"} ${descricao}`);
  if (!condicao) falhas++;
}

/** Executa algo que deve ser rejeitado pelo banco e diz se foi mesmo. */
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
  const pool = new Pool({
    ...configuracaoDeConexao(urlDaAplicacao()),
    max: 1,
  });

  const c = await pool.connect();

  try {
    await c.query("begin");
    // O pooler do Neon recusa `options` na conexão: o schema é definido aqui.
    await c.query(DEFINIR_SEARCH_PATH);
    await c.query("select set_config('app.papel', 'admin', true)");

    const { rows: m } = await c.query<{ id: string }>(
      "insert into missoes (nome, slug) values ('Regras', 'regras-teste') returning id",
    );
    const missao = m[0].id;

    const { rows: t } = await c.query<{ id: string }>(
      "select id from tipos_evento limit 1",
    );
    const tipo = t[0].id;

    // ─── Grupos: no máximo 3 responsáveis ──────────────────────────────────
    console.log("\nGrupos de oração");
    const { rows: g } = await c.query<{ id: string }>(
      "insert into grupos_oracao (missao_id, nome) values ($1, 'Grupo Teste') returning id",
      [missao],
    );
    const grupo = g[0].id;

    await c.query(
      `insert into grupo_responsaveis (grupo_id, nome, ordem) values
         ($1, 'Primeiro', 1), ($1, 'Segundo', 2), ($1, 'Terceiro', 3)`,
      [grupo],
    );
    ok("aceita 3 pastores", true);

    ok(
      "rejeita o 4º pastor (ordem fora de 1..3)",
      await deveRejeitar(
        c,
        "insert into grupo_responsaveis (grupo_id, nome, ordem) values ($1, 'Quarto', 4)",
        [grupo],
      ),
    );

    ok(
      "rejeita dois pastores na mesma posição",
      await deveRejeitar(
        c,
        "insert into grupo_responsaveis (grupo_id, nome, ordem) values ($1, 'Repetido', 2)",
        [grupo],
      ),
    );

    ok(
      "rejeita quantidade de pessoas negativa",
      await deveRejeitar(
        c,
        "insert into grupos_oracao (missao_id, nome, quantidade_pessoas) values ($1, 'Negativo', -1)",
        [missao],
      ),
    );

    ok(
      "rejeita dia da semana fora de 0..6",
      await deveRejeitar(
        c,
        "insert into grupos_oracao (missao_id, nome, dia_semana) values ($1, 'Dia 9', 9)",
        [missao],
      ),
    );

    // ─── Eventos: período coerente ─────────────────────────────────────────
    console.log("\nAções apostólicas");
    ok(
      "rejeita término anterior ao início",
      await deveRejeitar(
        c,
        `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
         values ($1, $2, 'Invertido', now(), now() - interval '1 hour')`,
        [missao, tipo],
      ),
    );

    ok(
      "rejeita número de participantes negativo",
      await deveRejeitar(
        c,
        `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim, participantes_total)
         values ($1, $2, 'Negativo', now(), now(), -5)`,
        [missao, tipo],
      ),
    );

    const { rows: e } = await c.query<{ id: string }>(
      `insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim)
       values ($1, $2, 'Evento válido', now(), now() + interval '3 hours') returning id`,
      [missao, tipo],
    );
    const evento = e[0].id;

    // ─── Financeiro ────────────────────────────────────────────────────────
    console.log("\nFinanceiro");
    ok(
      "rejeita lançamento de valor zero",
      await deveRejeitar(
        c,
        `insert into evento_lancamentos (evento_id, tipo, descricao, valor, data)
         values ($1, 'receita', 'Zero', 0, current_date)`,
        [evento],
      ),
    );

    ok(
      "rejeita lançamento de valor negativo",
      await deveRejeitar(
        c,
        `insert into evento_lancamentos (evento_id, tipo, descricao, valor, data)
         values ($1, 'despesa', 'Negativo', -10, current_date)`,
        [evento],
      ),
    );

    await c.query(
      `insert into evento_lancamentos (evento_id, tipo, descricao, valor, data) values
         ($1, 'receita', 'Doações',    1000.00, current_date),
         ($1, 'receita', 'Inscrições',  500.50, current_date),
         ($1, 'despesa', 'Alimentação', 300.25, current_date)`,
      [evento],
    );

    const { rows: saldo } = await c.query<{ saldo: string }>(
      `select coalesce(sum(case when tipo = 'receita' then valor else -valor end), 0)::text as saldo
         from evento_lancamentos where evento_id = $1`,
      [evento],
    );
    ok(
      `saldo calculado corretamente (1000,00 + 500,50 − 300,25 = ${saldo[0].saldo})`,
      saldo[0].saldo === "1200.25",
    );

    // ─── Indicadores ───────────────────────────────────────────────────────
    console.log("\nIndicadores");
    await c.query(
      `insert into missao_indicadores
         (missao_id, competencia, membros_total, grupos_total, pessoas_grupos_total)
       values ($1, date_trunc('month', current_date), 100, 2, 30)`,
      [missao],
    );
    ok("aceita a primeira competência do mês", true);

    ok(
      "rejeita competência duplicada no mesmo mês",
      await deveRejeitar(
        c,
        `insert into missao_indicadores
           (missao_id, competencia, membros_total, grupos_total, pessoas_grupos_total)
         values ($1, date_trunc('month', current_date), 111, 3, 40)`,
        [missao],
      ),
    );

    ok(
      "rejeita competência que não cai no dia 1",
      await deveRejeitar(
        c,
        `insert into missao_indicadores
           (missao_id, competencia, membros_total, grupos_total, pessoas_grupos_total)
         values ($1, date_trunc('month', current_date) + 14, 100, 2, 30)`,
        [missao],
      ),
    );

    // ─── Configuração e integridade ────────────────────────────────────────
    console.log("\nConfiguração e integridade");
    ok(
      "rejeita cor de tipo de evento fora do formato hexadecimal",
      await deveRejeitar(
        c,
        "insert into tipos_evento (nome, cor) values ('Cor ruim', 'vermelho')",
      ),
    );

    ok(
      "rejeita link que não seja http(s)",
      await deveRejeitar(
        c,
        "insert into evento_links (evento_id, titulo, url) values ($1, 'Ruim', 'javascript:alert(1)')",
        [evento],
      ),
    );

    ok(
      "impede apagar tipo de evento em uso",
      await deveRejeitar(c, "delete from tipos_evento where id = $1", [tipo]),
    );

    await c.query("delete from missoes where id = $1", [missao]);
    const { rows: orfaos } = await c.query(
      "select 1 from eventos where id = $1",
      [evento],
    );
    ok("apagar a missão leva junto eventos e filhos", orfaos.length === 0);
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
    await pool.end();
  }

  if (falhas) {
    console.error(`\n✗ ${falhas} regra(s) não estão sendo impostas.\n`);
    process.exit(1);
  }
  console.log("\n✓ Todas as regras de domínio impostas pelo banco.\n");
}

principal().catch((erro) => {
  console.error("\n✗ Erro:", erro?.message ?? erro);
  process.exit(1);
});
