import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

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
  { nome: "Celebração", cor: "#7C3AED", ordem: 1 },
  { nome: "Retiro", cor: "#0891B2", ordem: 2 },
  { nome: "Evangelização de rua", cor: "#DC2626", ordem: 3 },
  { nome: "Formação", cor: "#2563EB", ordem: 4 },
  { nome: "Ação social", cor: "#059669", ordem: 5 },
  { nome: "Encontro de grupos", cor: "#A16207", ordem: 6 },
  { nome: "Vigília", cor: "#4338CA", ordem: 7 },
  { nome: "Evento musical", cor: "#DB2777", ordem: 8 },
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
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
    options: `-c search_path=${process.env.DB_SCHEMA ?? "ie"},public`,
  });

  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      // As tabelas têm FORCE RLS: mesmo sendo dono do banco, este script
      // precisa se declarar admin para conseguir escrever.
      await tx.execute(sql`select set_config('app.eh_admin', 'on', true)`);

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
