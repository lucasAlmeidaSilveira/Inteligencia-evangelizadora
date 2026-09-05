import { config } from "dotenv";

config({ path: ".env.local" });

import { Pool } from "pg";

import {
  configuracaoDeConexao,
} from "./conexao";

/**
 * Copia os dados do schema `ie` de um banco para outro.
 *
 *   DATABASE_URL_ORIGEM="postgres://..." pnpm db:copiar
 *
 * A origem vem de DATABASE_URL_ORIGEM; o destino é a DATABASE_URL do
 * .env.local — que a essa altura já deve apontar para o banco novo.
 *
 * Preserva os identificadores: os tipos de evento e as categorias são
 * copiados junto, e não semeados de novo, porque os eventos existentes
 * apontam para os ids antigos.
 */
const ORDEM = [
  "usuarios",
  "missoes",
  "usuario_missoes",
  "missao_indicadores",
  "grupos_oracao",
  "grupo_responsaveis",
  "tipos_evento",
  "categorias_financeiras",
  "eventos",
  "evento_lancamentos",
  "evento_documentos",
  "evento_links",
] as const;

function conectar(url: string) {
  return new Pool({
    ...configuracaoDeConexao(url),
    max: 1,
  });
}

async function principal() {
  const origemUrl = process.env.DATABASE_URL_ORIGEM;
  // Manutenção: escreve como dono, sem depender das políticas.
  const destinoUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;

  if (!origemUrl) {
    console.error('Falta DATABASE_URL_ORIGEM. Uso:\n  DATABASE_URL_ORIGEM="postgres://..." pnpm db:copiar');
    process.exit(1);
  }
  if (!destinoUrl) throw new Error("DATABASE_URL ausente em .env.local");
  if (origemUrl === destinoUrl) {
    console.error("Origem e destino são o mesmo banco. Nada a fazer.");
    process.exit(1);
  }

  const origem = conectar(origemUrl);
  const destino = conectar(destinoUrl);

  const co = await origem.connect();
  const cd = await destino.connect();

  try {
    console.log(`origem:  ${new URL(origemUrl).hostname}`);
    console.log(`destino: ${new URL(destinoUrl).hostname}\n`);

    // Ambos os lados precisam de escopo de admin: as tabelas têm FORCE RLS.
    await co.query("begin");
    await co.query("select set_config('app.eh_admin','on',true)");
    await cd.query("begin");
    await cd.query("select set_config('app.eh_admin','on',true)");

    let total = 0;

    for (const tabela of ORDEM) {
      const { rows: colunas } = await co.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'ie' and table_name = $1
          order by ordinal_position`,
        [tabela],
      );

      if (colunas.length === 0) {
        console.log(`  ${tabela.padEnd(24)} (não existe na origem)`);
        continue;
      }

      const nomes = colunas.map((c) => `"${c.column_name}"`).join(", ");
      const { rows } = await co.query(`select ${nomes} from ie."${tabela}"`);

      if (rows.length === 0) {
        console.log(`  ${tabela.padEnd(24)} vazia`);
        continue;
      }

      for (const linha of rows) {
        const valores = colunas.map((c) => linha[c.column_name]);
        const marcadores = valores.map((_, i) => `$${i + 1}`).join(", ");
        await cd.query(
          `insert into ie."${tabela}" (${nomes}) values (${marcadores})
             on conflict do nothing`,
          valores,
        );
      }

      total += rows.length;
      console.log(`  ${tabela.padEnd(24)} ${String(rows.length).padStart(4)} linha(s)`);
    }

    await cd.query("commit");
    await co.query("rollback");

    console.log(`\n✓ ${total} linha(s) copiadas.`);
    console.log("  Confira com: pnpm db:estado");
  } catch (erro) {
    await cd.query("rollback").catch(() => undefined);
    await co.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    co.release();
    cd.release();
    await origem.end();
    await destino.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha na cópia:", erro?.message ?? erro);
  process.exit(1);
});
