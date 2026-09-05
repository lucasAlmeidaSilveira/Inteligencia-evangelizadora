import { config } from "dotenv";

config({ path: ".env.local" });

import { writeFileSync } from "node:fs";

import { Pool } from "pg";

import { configuracaoDeConexao } from "../src/server/db/conexao";

/** Lê o administrador do banco real, para a demonstração usar o mesmo login. */
async function principal() {
  const url = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
  const pool = new Pool({ ...configuracaoDeConexao(url), max: 1 });
  try {
    const { rows } = await pool.query(
      "select firebase_uid, nome, email from ie.usuarios where papel = 'admin' limit 1",
    );
    if (!rows[0]) process.exit(1);
    writeFileSync(process.env.SAIDA!, JSON.stringify(rows[0]));
  } finally {
    await pool.end();
  }
}

principal().catch(() => process.exit(1));
