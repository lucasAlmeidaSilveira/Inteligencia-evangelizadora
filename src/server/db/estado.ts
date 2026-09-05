import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlAdministrativa,
} from "./conexao";

/**
 * Retrato rápido do que existe no banco.
 *
 *   pnpm db:estado
 */
async function principal() {
  const pool = new Pool({
    ...configuracaoDeConexao(urlAdministrativa()),
    max: 1,
  });

  const c = await pool.connect();

  try {
    await c.query("begin");
    // O pooler do Neon recusa `options` na conexão: o schema é definido aqui.
    await c.query(DEFINIR_SEARCH_PATH);
    await c.query("select set_config('app.papel', 'admin', true)");

    const { rows: pessoas } = await c.query<{
      nome: string;
      email: string;
      papel: string;
      ativo: boolean;
      missao: string | null;
    }>(`
      select u.nome, u.email, u.papel, u.ativo, m.nome as missao
        from usuarios u
        left join missoes m on m.id = u.missao_id
       order by u.papel, u.nome
    `);

    const { rows: contagens } = await c.query<{
      missoes: number;
      grupos: number;
      eventos: number;
      tipos: number;
      categorias: number;
    }>(`
      select
        (select count(*) from missoes)                as missoes,
        (select count(*) from grupos_oracao)          as grupos,
        (select count(*) from eventos)                as eventos,
        (select count(*) from tipos_evento)           as tipos,
        (select count(*) from categorias_financeiras) as categorias
    `);

    console.log("\nUsuários");
    if (!pessoas.length) {
      console.log("  (nenhum — rode: pnpm admin:criar <email> \"<Nome>\")");
    }
    for (const p of pessoas) {
      const escopo =
        p.papel === "admin" ? "todas as missões" : (p.missao ?? "sem missão");
      console.log(
        `  • ${p.nome} <${p.email}> — ${p.papel}, ${escopo}${p.ativo ? "" : " [inativo]"}`,
      );
    }

    const c0 = contagens[0];
    console.log("\nDados");
    console.log(`  Missões:              ${c0.missoes}`);
    console.log(`  Grupos de oração:     ${c0.grupos}`);
    console.log(`  Ações apostólicas:    ${c0.eventos}`);
    console.log("\nConfiguração");
    console.log(`  Tipos de evento:      ${c0.tipos}`);
    console.log(`  Categorias:           ${c0.categorias}\n`);
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗", erro?.message ?? erro);
  process.exit(1);
});
