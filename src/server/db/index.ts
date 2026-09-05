import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/server/env";

import { configuracaoDeConexao } from "./conexao";
import * as schema from "./schema";

const env = serverEnv();

// A instância serverless reaproveita o módulo entre invocações; guardar o pool
// no globalThis evita abrir um novo a cada hot-reload em desenvolvimento.
const global = globalThis as unknown as { __iePool?: Pool };

export const pool =
  global.__iePool ??
  new Pool({
    ...configuracaoDeConexao(env.DATABASE_URL),
    // Instância compartilhada com o Glyvo. Teto baixo por instância para não
    // esgotar o limite de conexões do Render e derrubar os dois sistemas.
    max: 5,
    // Conexão ociosa mantida por 5 minutos: o aperto de mão TLS com um banco
    // distante custa mais que a própria consulta, e reabrir a cada página
    // dobraria o tempo de resposta.
    idleTimeoutMillis: 300_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });

global.__iePool = pool;

export const db = drizzle(pool, { schema });

export type Db = NodePgDatabase<typeof schema>;
/** Contexto transacional com o escopo do usuário já aplicado. */
export type Transacao = Db;
