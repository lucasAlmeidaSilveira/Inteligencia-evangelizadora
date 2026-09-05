import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/server/env";

import * as schema from "./schema";

const env = serverEnv();

// A instância serverless reaproveita o módulo entre invocações; guardar o pool
// no globalThis evita abrir um novo a cada hot-reload em desenvolvimento.
const global = globalThis as unknown as { __iePool?: Pool };

const pool =
  global.__iePool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // Instância compartilhada com o Glyvo. Teto baixo por instância para não
    // esgotar o limite de conexões do Render e derrubar os dois sistemas.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Toda conexão já nasce apontando para o nosso schema.
    options: `-c search_path=${env.DB_SCHEMA},public`,
  });

global.__iePool = pool;

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type Transacao = Parameters<Parameters<Db["transaction"]>[0]>[0];
