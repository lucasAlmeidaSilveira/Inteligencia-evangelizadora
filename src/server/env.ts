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

/* ─── Endereço público ───────────────────────────────────────────────────── */

/**
 * Grupo próprio, e não dentro de `envAgendador`: aquele lança sem
 * `CRON_SECRET`, e o link da pesquisa de satisfação não pode depender de o
 * cron estar configurado. Opcional aqui; `urlPublica()` decide o que fazer na
 * falta dele conforme o ambiente.
 */
export const envPublico = memoizar(() =>
  ler(
    z.object({
      APP_URL: z.url().optional(),
    }),
    "Endereço público",
  ),
);

/* ─── E-mail (Resend) ────────────────────────────────────────────────────── */

/**
 * Só é lido na hora de enviar. `emailConfigurado()` em `src/server/email.ts`
 * decide antes se vale tentar — e a rotina de lembretes funciona sem e-mail,
 * apenas com a notificação interna.
 */
export const envEmail = memoizar(() =>
  ler(
    z.object({
      RESEND_API_KEY: z.string().min(1),
      /** "Inteligência Evangelizadora <avisos@dominio-verificado.org>". */
      EMAIL_REMETENTE: z.string().min(3),
    }),
    "E-mail",
  ),
);

/* ─── Rotinas agendadas ──────────────────────────────────────────────────── */

export const envAgendador = memoizar(() =>
  ler(
    z.object({
      /**
       * Segredo que o agendador manda em `Authorization: Bearer`. A Vercel o
       * injeta sozinha nos crons quando a variável existe no projeto; qualquer
       * outro agendador precisa mandá-lo à mão. Sem ele a rota recusa tudo.
       */
      CRON_SECRET: z.string().min(16),
      /**
       * Endereço público da aplicação, para os links do e-mail. Opcional: na
       * falta, a rota usa a origem da própria requisição.
       */
      APP_URL: z.url().optional(),
    }),
    "Agendador",
  ),
);
