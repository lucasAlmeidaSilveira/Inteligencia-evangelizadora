import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
} from "./conexao";

import { categoriasFinanceiras, tiposEvento } from "./schema";

/**
 * Dados de configuração iniciais. Reexecutável: `onConflictDoNothing` pelo
 * nome, então rodar duas vezes não duplica nem sobrescreve ajustes feitos
 * pelo admin na interface.
 *
 * Os tipos de evento aqui são provisórios — serão substituídos pela lista
 * definitiva do cliente.
 */
const TIPOS_EVENTO = [
  { nome: "Evento Pequeno Porte", cor: "#DB2777", ordem: 1 },
  { nome: "Evento Médio Porte", cor: "#8B5CF6", ordem: 2 },
  { nome: "Evento Grande Porte", cor: "#EC4899", ordem: 3 },
  { nome: "Celebração", cor: "#7C3AED", ordem: 4 },
  { nome: "Retiro", cor: "#0891B2", ordem: 5 },
  { nome: "Evangelização", cor: "#DC2626", ordem: 6 },
  { nome: "Formação", cor: "#2563EB", ordem: 7 },
  { nome: "Ação social", cor: "#059669", ordem: 8 },
  { nome: "Encontro de grupos", cor: "#A16207", ordem: 9 },
  { nome: "Vigília", cor: "#4338CA", ordem: 10 },
];

const CATEGORIAS = [
  { nome: "Doações", tipo: "receita" as const, ordem: 1 },
  { nome: "Inscrições", tipo: "receita" as const, ordem: 2 },
  { nome: "Venda de materiais", tipo: "receita" as const, ordem: 3 },
  { nome: "Parcerias e patrocínios", tipo: "receita" as const, ordem: 4 },
  { nome: "Alimentação", tipo: "despesa" as const, ordem: 5 },
  { nome: "Estrutura e locação", tipo: "despesa" as const, ordem: 6 },
  { nome: "Transporte", tipo: "despesa" as const, ordem: 7 },
  { nome: "Material gráfico", tipo: "despesa" as const, ordem: 8 },
  { nome: "Som e iluminação", tipo: "despesa" as const, ordem: 9 },
  { nome: "Outros", tipo: "ambos" as const, ordem: 10 },
];

async function principal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente em .env.local");

  const pool = new Pool({
    ...configuracaoDeConexao(url),
    max: 1,
  });

  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      // As tabelas têm FORCE RLS: mesmo sendo dono do banco, este script
      // precisa se declarar admin para conseguir escrever.
      await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
      await tx.execute(sql`select set_config('app.papel', 'admin', true)`);

      await tx
        .insert(tiposEvento)
        .values(TIPOS_EVENTO)
        .onConflictDoNothing({ target: tiposEvento.nome });

      await tx
        .insert(categoriasFinanceiras)
        .values(CATEGORIAS)
        .onConflictDoNothing({ target: categoriasFinanceiras.nome });
    });

    console.log(
      `✓ Seed aplicado: ${TIPOS_EVENTO.length} tipos de evento, ${CATEGORIAS.length} categorias.`,
    );
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha no seed:", erro);
  process.exit(1);
});
