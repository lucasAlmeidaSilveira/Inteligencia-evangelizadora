import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { serverEnv } from "@/server/env";

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

export const TIPOS_PERMITIDOS = {
  "application/pdf": "PDF",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/csv": "CSV",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
} as const;

export type TipoPermitido = keyof typeof TIPOS_PERMITIDOS;

export function tipoEhPermitido(tipo: string): tipo is TipoPermitido {
  return tipo in TIPOS_PERMITIDOS;
}

let cliente: S3Client | null = null;

function obterCliente() {
  if (cliente) return cliente;

  const env = serverEnv();
  cliente = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return cliente;
}

/**
 * Chave do objeto. O prefixo por missão e evento não é organização estética:
 * é o que permite auditar e apagar tudo de uma missão de uma vez.
 */
export function montarChave(
  missaoId: string,
  eventoId: string,
  nomeArquivo: string,
) {
  const limpo = nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `${missaoId}/${eventoId}/${crypto.randomUUID()}-${limpo}`;
}

/** URL temporária para o navegador enviar o arquivo direto ao R2, sem passar
 *  os bytes pelo servidor Next. Quem autoriza é a Server Action que gera esta
 *  URL — ela só a devolve depois de confirmar acesso à missão. */
export async function urlDeUpload(chave: string, tipoMime: string) {
  const env = serverEnv();
  return getSignedUrl(
    obterCliente(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: chave,
      ContentType: tipoMime,
    }),
    { expiresIn: 300 },
  );
}

/** URL temporária de download. O bucket permanece privado: sem esta
 *  assinatura, conhecer a chave não dá acesso a nada. */
export async function urlDeDownload(chave: string, nomeExibicao: string) {
  const env = serverEnv();
  return getSignedUrl(
    obterCliente(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: chave,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(nomeExibicao)}"`,
    }),
    { expiresIn: 300 },
  );
}

export async function removerObjeto(chave: string) {
  const env = serverEnv();
  await obterCliente().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: chave }),
  );
}
