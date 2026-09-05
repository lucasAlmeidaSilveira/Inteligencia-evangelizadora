import { config } from "dotenv";

config({ path: ".env.local" });

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Verifica a configuração do R2 de ponta a ponta: envia um objeto,
 * gera uma URL assinada, baixa por ela e apaga.
 *
 *   pnpm r2:testar
 *
 * Falhar aqui agora é muito mais barato que descobrir a credencial errada
 * depois, no meio da tela de anexos.
 */
async function principal() {
  const faltando = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ].filter((nome) => !process.env[nome] || process.env[nome] === "preencher");

  if (faltando.length) {
    console.error(`✗ Variáveis não preenchidas em .env.local: ${faltando.join(", ")}`);
    process.exit(1);
  }

  const bucket = process.env.R2_BUCKET!;
  const cliente = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const chave = `_teste/${crypto.randomUUID()}.txt`;
  const conteudo = `teste de conexão — ${new Date().toISOString()}`;

  console.log(`→ Bucket: ${bucket}`);

  await cliente.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      Body: conteudo,
      ContentType: "text/plain",
    }),
  );
  console.log("✓ Escrita");

  const url = await getSignedUrl(
    cliente,
    new GetObjectCommand({ Bucket: bucket, Key: chave }),
    { expiresIn: 60 },
  );

  const resposta = await fetch(url);
  const baixado = await resposta.text();

  if (baixado !== conteudo) {
    throw new Error(`Conteúdo divergente: recebido "${baixado}"`);
  }
  console.log("✓ Leitura por URL assinada");

  await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: chave }));
  console.log("✓ Exclusão");

  console.log("\n✓ R2 configurado corretamente.\n");
}

principal().catch((erro) => {
  console.error("\n✗ Falhou:", erro?.message ?? erro);

  const nome = erro?.name ?? "";
  if (nome === "InvalidAccessKeyId" || nome === "SignatureDoesNotMatch") {
    console.error("  → Access Key ID ou Secret Access Key incorretos.");
  } else if (nome === "NoSuchBucket") {
    console.error("  → O bucket em R2_BUCKET não existe nessa conta.");
  } else if (nome === "AccessDenied") {
    console.error("  → O token não tem permissão de escrita neste bucket.");
  } else if (String(erro?.message).includes("ENOTFOUND")) {
    console.error("  → R2_ACCOUNT_ID provavelmente está errado.");
  }

  process.exit(1);
});
