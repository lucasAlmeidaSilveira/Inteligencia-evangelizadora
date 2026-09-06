import { readFileSync } from "node:fs";

import { Pool } from "pg";

import { configuracaoDeConexao } from "../src/server/db/conexao";

/**
 * Compara as migrations do repositório com as já aplicadas em produção.
 *
 *   npx tsx scripts/conferir-migrations.ts
 *
 * Somente leitura: consulta `ie.__migrations` e não chama `migrate()`. Existe
 * para responder "produção está em dia?" sem precisar trocar de ambiente — o
 * `pnpm ambiente producao` reescreve o `.env.local` e faz o servidor de
 * desenvolvimento aberto trocar de banco no meio do caminho.
 */
function valorDe(env: string, chave: string) {
  const linha = env
    .split("\n")
    .find((l) => l.trim().startsWith(`${chave}=`));
  return linha ? linha.slice(linha.indexOf("=") + 1).trim() : undefined;
}

async function principal() {
  const env = readFileSync(".env.local", "utf8");

  // Com o ambiente apontando para a demonstração, a credencial real está nas
  // linhas `#GUARDADO_*` que `scripts/ambiente.ts` deixa para trás.
  const url =
    valorDe(env, "#GUARDADO_DATABASE_URL_ADMIN") ??
    valorDe(env, "#GUARDADO_DATABASE_URL") ??
    valorDe(env, "DATABASE_URL_ADMIN") ??
    valorDe(env, "DATABASE_URL");

  if (!url) {
    console.error("\n✗ Não encontrei credencial de banco em .env.local.\n");
    process.exit(1);
  }

  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    console.error(
      "\n✗ A credencial encontrada é a do banco local. Este script confere\n" +
        "  produção — rode com o .env.local apontando para lá, ou deixe as\n" +
        "  linhas #GUARDADO_* preenchidas.\n",
    );
    process.exit(1);
  }

  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string }[] };
  const locais = journal.entries.map((e) => e.tag);

  console.log(`\nBanco: ${hostname}\n`);

  const pool = new Pool({ ...configuracaoDeConexao(url), max: 1 });
  try {
    const { rows } = await pool.query<{ hash: string }>(
      "select hash from ie.__migrations order by created_at",
    );

    // O drizzle grava o hash do arquivo, não a tag. A ordem é a mesma do
    // journal, então a contagem é o que diz onde a produção parou.
    locais.forEach((tag, i) => {
      console.log(`  ${i < rows.length ? "✓" : "✗"} ${tag}`);
    });

    const faltam = locais.length - rows.length;
    console.log(
      faltam > 0
        ? `\n✗ Faltam ${faltam} migration(s) em produção. Rode \`pnpm db:migrate\` com o ambiente em produção.\n`
        : "\n✓ Produção está em dia com o repositório.\n",
    );
    if (faltam > 0) process.exitCode = 1;
  } catch (erro) {
    const mensagem = (erro as Error).message;
    if (mensagem.includes("__migrations")) {
      console.error(
        "✗ A tabela ie.__migrations não existe: nenhuma migration foi aplicada aqui.\n",
      );
      process.exitCode = 1;
      return;
    }
    console.error("✗", mensagem, "\n");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

principal();
