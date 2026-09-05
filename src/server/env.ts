import "server-only";

import { z } from "zod";

/**
 * Segredos do servidor, validados por grupo e sob demanda.
 *
 * Validar tudo de uma vez parece rigoroso, mas acopla partes que não têm
 * relação: faltando uma credencial do armazenamento de arquivos, o login
 * também parava de funcionar — e a mensagem não dizia nada sobre isso. Cada
 * grupo abaixo só é exigido quando o recurso correspondente é usado.
 *
 * O import de `server-only` faz o build falhar se algum Client Component
 * importar este módulo, em vez de vazar silenciosamente.
 */
function memoizar<T>(validar: () => T) {
  let cache: T | null = null;
  return () => {
    if (!cache) cache = validar();
    return cache;
  };
}

function ler<T extends z.ZodType>(schema: T, rotulo: string): z.infer<T> {
  const resultado = schema.safeParse(process.env);
  if (!resultado.success) {
    const faltando = resultado.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(
      `${rotulo}: variáveis de ambiente inválidas ou ausentes — ${faltando}`,
    );
  }
  return resultado.data;
}

/* ─── Banco ──────────────────────────────────────────────────────────────── */

export const envBanco = memoizar(() =>
  ler(
    z.object({
      DATABASE_URL: z.string().min(1),
      DB_SCHEMA: z.string().min(1).default("ie"),
    }),
    "Banco de dados",
  ),
);

/* ─── Firebase Admin ─────────────────────────────────────────────────────── */

export const envFirebase = memoizar(() =>
  ler(
    z.object({
      FIREBASE_PROJECT_ID: z.string().min(1),
      FIREBASE_CLIENT_EMAIL: z.email(),
      // No .env a chave vem em uma linha só, com \n escapado.
      FIREBASE_PRIVATE_KEY: z
        .string()
        .min(1)
        .transform((valor) => valor.replace(/\\n/g, "\n")),
    }),
    "Firebase Admin",
  ),
);

/* ─── Cloudflare R2 ──────────────────────────────────────────────────────── */

export const envR2 = memoizar(() =>
  ler(
    z.object({
      R2_ACCOUNT_ID: z.string().min(1),
      R2_ACCESS_KEY_ID: z.string().min(1),
      R2_SECRET_ACCESS_KEY: z.string().min(1),
      R2_BUCKET: z.string().min(1),
    }),
    "Cloudflare R2",
  ),
);
