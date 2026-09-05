import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool } from "pg";

import {
  configuracaoDeConexao,
  urlAdministrativa,
} from "./conexao";

/**
 * Verifica a conexão com o Postgres do Render antes de migrar:
 * conecta, identifica o banco e confirma que dá para criar o schema `ie`.
 *
 *   pnpm db:testar
 */
async function principal() {
  const url = process.env.DATABASE_URL;

  if (!url || url.includes("usuario:senha")) {
    console.error("✗ DATABASE_URL não preenchida em .env.local");
    process.exit(1);
  }

  const schema = process.env.DB_SCHEMA ?? "ie";
  const pool = new Pool({
    ...configuracaoDeConexao(urlAdministrativa()),
    max: 1,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const { rows } = await pool.query<{
      banco: string;
      usuario: string;
      versao: string;
    }>(
      "select current_database() as banco, current_user as usuario, version() as versao",
    );
    const [info] = rows;

    console.log(`→ Banco:   ${info.banco}`);
    console.log(`→ Usuário: ${info.usuario}`);
    console.log(`→ Versão:  ${info.versao.split(" ").slice(0, 2).join(" ")}`);
    console.log("✓ Conexão");

    const { rows: existentes } = await pool.query(
      "select 1 from information_schema.schemata where schema_name = $1",
      [schema],
    );

    if (existentes.length) {
      const { rows: tabelas } = await pool.query(
        "select count(*)::int as total from information_schema.tables where table_schema = $1",
        [schema],
      );
      console.log(`✓ Schema "${schema}" já existe (${tabelas[0].total} tabelas)`);
    } else {
      // Cria e desfaz: prova a permissão sem deixar resíduo.
      await pool.query("begin");
      await pool.query(`create schema "${schema}"`);
      await pool.query("rollback");
      console.log(`✓ Permissão para criar o schema "${schema}"`);
    }

    // O Glyvo divide esta instância: convém saber a folga de conexões.
    const { rows: conexoes } = await pool.query<{
      usadas: number;
      limite: string;
    }>(
      "select count(*)::int as usadas, current_setting('max_connections') as limite from pg_stat_activity",
    );
    console.log(
      `→ Conexões em uso: ${conexoes[0].usadas} de ${conexoes[0].limite}`,
    );

    console.log("\n✓ Banco pronto para `pnpm db:migrate`.\n");
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("\n✗ Falhou:", erro?.message ?? erro);

  const msg = String(erro?.message ?? "");
  if (msg.includes("password authentication")) {
    console.error("  → Usuário ou senha incorretos na DATABASE_URL.");
  } else if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) {
    console.error("  → Host não encontrado. Use a *External* Database URL do Render.");
  } else if (msg.includes("timeout")) {
    console.error("  → Sem resposta. A instância do Render pode estar suspensa.");
  } else if (msg.includes("permission denied")) {
    console.error(`  → O usuário não pode criar schemas neste banco.`);
  }

  process.exit(1);
});
