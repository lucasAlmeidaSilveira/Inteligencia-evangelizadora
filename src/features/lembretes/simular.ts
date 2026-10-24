import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlDaAplicacao,
} from "@/server/db/conexao";
import * as schema from "@/server/db/schema";

import { executarLembretes } from "./job";

/**
 * Mostra quem receberia o lembrete bimestral hoje, sem enviar nem gravar nada.
 *
 *   pnpm lembretes:simular
 *
 * Mesma rotina da rota `/api/lembretes/contagem?simular=1`, rodada daqui para
 * não depender de segredo nem de servidor no ar. Lê o banco que o `.env.local`
 * aponta — confira com `pnpm ambiente` antes. A transação é revertida no fim,
 * e com `simular` a rotina nem tenta escrever; os dois cuidados juntos fazem
 * isto ser estritamente leitura.
 */
async function principal() {
  const pool = new Pool({ ...configuracaoDeConexao(urlDaAplicacao()), max: 1 });
  const db = drizzle(pool, { schema });

  try {
    // Guardado fora da transação: `tx.rollback()` encerra o callback lançando,
    // então o valor não pode sair pelo `return`. Numa caixa, e não numa `let`,
    // porque o TypeScript não enxerga atribuição feita dentro do callback e
    // concluiria que a variável segue `null`.
    const caixa: { relatorio: Awaited<ReturnType<typeof executarLembretes>> | null } = {
      relatorio: null,
    };

    await db
      .transaction(async (tx) => {
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
        // O escopo do sistema, como na rota: enxerga todas as missões.
        await tx.execute(
          sql`select set_config('app.papel', 'admin', true),
                     set_config('app.usuario_id', '00000000-0000-0000-0000-000000000000', true)`,
        );

        caixa.relatorio = await executarLembretes(tx, {
          baseUrl: process.env.APP_URL ?? "http://localhost:3000",
          enviarEmail: null,
          simular: true,
        });

        tx.rollback();
      })
      .catch((erro) => {
        // `tx.rollback()` encerra a transação lançando — é o esperado aqui.
        if (erro instanceof Error && erro.message.includes("Rollback")) return;
        throw erro;
      });

    const relatorio = caixa.relatorio;
    if (!relatorio) {
      console.error("✗ A simulação não devolveu relatório.");
      process.exit(1);
    }

    console.log(`\nSimulação em ${relatorio.executadoEm}\n`);
    console.log(`  grupos com contagem vencida e sem aviso neste bimestre: ${relatorio.gruposVencidos}`);
    console.log(`  pessoas que receberiam o lembrete: ${relatorio.destinatarios}\n`);

    for (const envio of relatorio.envios) {
      console.log(`  → ${envio.para} (${envio.missao})`);
      for (const grupo of envio.grupos) console.log(`      · ${grupo}`);
    }

    for (const missao of relatorio.semDestinatario) {
      console.log(
        `\n  ! ${missao.missaoNome}: ${missao.grupos.length} grupo(s) vencido(s) e ninguém ativo para avisar — ${missao.grupos.join(", ")}`,
      );
    }

    if (relatorio.envios.length === 0 && relatorio.semDestinatario.length === 0) {
      console.log("  Nada a enviar hoje: todas as contagens estão em dia ou já foram lembradas.");
    }
    console.log();
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha na simulação:", erro);
  process.exit(1);
});
