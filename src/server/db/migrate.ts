import { config } from "dotenv";

config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Aplica as migrations geradas pelo drizzle-kit e, em seguida, reaplica as
 * políticas de RLS. `politicas.sql` é idempotente de propósito: assim ele
 * acompanha qualquer mudança de schema sem exigir uma migration própria a
 * cada ajuste de policy.
 */
async function principal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente em .env.local");

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    console.log("→ Aplicando migrations…");
    await migrate(drizzle(pool), {
      migrationsFolder: "./drizzle",
      // Histórico dentro do nosso schema, longe das tabelas do Glyvo.
      migrationsSchema: "ie",
      migrationsTable: "__migrations",
    });

    console.log("→ Aplicando políticas de RLS…");
    await pool.query(readFileSync(resolve("drizzle/politicas.sql"), "utf8"));

    console.log("✓ Banco atualizado.");
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha na migração:", erro);
  process.exit(1);
});
