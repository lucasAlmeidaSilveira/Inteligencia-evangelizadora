import "server-only";

import { z } from "zod";

/**
 * Segredos do servidor. O import de `server-only` faz o build falhar se algum
 * Client Component importar este módulo, em vez de vazar silenciosamente.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  DB_SCHEMA: z.string().min(1).default("ie"),

  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.email(),
  // No .env a chave vem em uma linha só, com \n escapado.
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((valor) => valor.replace(/\\n/g, "\n")),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

let cache: z.infer<typeof schema> | null = null;

/** Lazy: só valida quando algo do servidor realmente precisa, para que um
 *  build de front sem segredos configurados não quebre sem necessidade. */
export function serverEnv() {
  if (!cache) {
    const resultado = schema.safeParse(process.env);
    if (!resultado.success) {
      const faltando = resultado.error.issues
        .map((i) => i.path.join("."))
        .join(", ");
      throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${faltando}`);
    }
    cache = resultado.data;
  }
  return cache;
}
