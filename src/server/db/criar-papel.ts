import { config } from "dotenv";

config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool } from "pg";

import { configuracaoDeConexao, DEFINIR_SEARCH_PATH } from "./conexao";

/**
 * Cria o papel de aplicação — aquele com que o sistema realmente se conecta.
 *
 *   pnpm db:criar-papel
 *
 * Por que isto existe: o papel dono do schema costuma ter o atributo
 * BYPASSRLS. Ele é mais forte que `FORCE ROW LEVEL SECURITY` e faz o Postgres
 * ignorar todas as políticas — o isolamento entre missões some, sem erro e sem
 * aviso. Foi o que aconteceu ao migrar para o Neon, cujo `neondb_owner` vem
 * com esse atributo ligado.
 *
 * A separação também é boa prática por si só: quem atende requisições não
 * precisa poder criar nem apagar tabelas.
 */
const PAPEL = "ie_app";

async function principal() {
  const admin = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  const pool = new Pool({ ...configuracaoDeConexao(admin), max: 1 });
  const c = await pool.connect();

  try {
    await c.query(DEFINIR_SEARCH_PATH);

    // Alfanumérica: entra na string de conexão sem precisar de escape.
    const senha = randomBytes(24).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 28);

    const { rows: existe } = await c.query(
      "select 1 from pg_roles where rolname = $1",
      [PAPEL],
    );

    if (existe.length) {
      await c.query(`alter role ${PAPEL} with login password '${senha}' nobypassrls`);
      console.log(`→ Papel ${PAPEL} já existia; senha renovada.`);
    } else {
      await c.query(`create role ${PAPEL} with login password '${senha}' nobypassrls`);
      console.log(`→ Papel ${PAPEL} criado.`);
    }

    // Sem BYPASSRLS e sem poder alterar estrutura: só lê e escreve dados,
    // sempre sujeito às políticas.
    await c.query(`grant usage on schema ie to ${PAPEL}`);
    await c.query(`grant usage on schema public to ${PAPEL}`);
    await c.query(
      `grant select, insert, update, delete on all tables in schema ie to ${PAPEL}`,
    );
    await c.query(`grant execute on all functions in schema ie to ${PAPEL}`);
    // Tabelas criadas por migrations futuras já nascem acessíveis.
    await c.query(
      `alter default privileges in schema ie grant select, insert, update, delete on tables to ${PAPEL}`,
    );
    await c.query(
      `alter default privileges in schema ie grant execute on functions to ${PAPEL}`,
    );

    console.log("→ Permissões concedidas (dados sim, estrutura não).");

    const { rows: conferencia } = await c.query(
      "select rolbypassrls, rolsuper from pg_roles where rolname = $1",
      [PAPEL],
    );
    if (conferencia[0].rolbypassrls || conferencia[0].rolsuper) {
      throw new Error(
        `O papel ${PAPEL} ainda ignora RLS. Não use esta configuração.`,
      );
    }
    console.log("✓ Confirmado: o papel está sujeito às políticas de RLS.");

    const url = new URL(admin!);
    url.username = PAPEL;
    url.password = senha;

    // Gravado direto no arquivo: senha longa colada à mão vira erro de digitação.
    const caminho = resolve(".env.local");
    let env = readFileSync(caminho, "utf8");

    const definir = (chave: string, valor: string) => {
      const padrao = new RegExp(`^${chave}=.*$`, "m");
      env = padrao.test(env)
        ? env.replace(padrao, () => `${chave}=${valor}`)
        : `${env.trimEnd()}\n${chave}=${valor}\n`;
    };

    // A ordem importa: preserva a de admin antes de sobrescrever a principal.
    definir("DATABASE_URL_ADMIN", admin!);
    definir("DATABASE_URL", url.toString());

    writeFileSync(caminho, env);

    console.log("\n✓ .env.local atualizado:");
    console.log(`    DATABASE_URL        → ${PAPEL} (aplicação, sujeita ao RLS)`);
    console.log("    DATABASE_URL_ADMIN  → dono do schema (só migrations)\n");
  } finally {
    c.release();
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha:", erro?.message ?? erro);
  process.exit(1);
});
