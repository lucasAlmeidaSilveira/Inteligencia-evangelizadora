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
/*
 * `destacarNoPainel` dá cartão próprio no painel. SVES e retiro nascem
 * marcados porque são os dois números que as missões acompanham de perto.
 *
 * O nome do SVES é a sigla, não a frase por extenso: é ele que vira rótulo do
 * cartão, e "Seminário de Vida no Espírito Santo" quebraria em três linhas no
 * `text-xs` do `CartaoMetrica`. A frase inteira fica na descrição, que a tela
 * de configuração exibe.
 */
/* Todas as linhas trazem todas as chaves, mesmo as vazias: num insert de
   várias linhas o Drizzle monta a lista de colunas a partir da primeira, e uma
   chave que só aparece adiante entra deslocada — o SVES nasceu com a cor da
   Vigília e sem o destaque, sem erro nenhum. */
const TIPOS_EVENTO = [
  {
    nome: "SVES",
    descricao: "Seminário de Vida no Espírito Santo",
    cor: "#C2410C",
    ordem: 1,
    destacarNoPainel: true,
  },
  { nome: "Evento Pequeno Porte", descricao: null, cor: "#DB2777", ordem: 2, destacarNoPainel: false },
  { nome: "Evento Médio Porte", descricao: null, cor: "#8B5CF6", ordem: 3, destacarNoPainel: false },
  { nome: "Evento Grande Porte", descricao: null, cor: "#EC4899", ordem: 4, destacarNoPainel: false },
  { nome: "Celebração", descricao: null, cor: "#7C3AED", ordem: 5, destacarNoPainel: false },
  { nome: "Retiro", descricao: null, cor: "#0891B2", ordem: 6, destacarNoPainel: true },
  { nome: "Evangelização", descricao: null, cor: "#DC2626", ordem: 7, destacarNoPainel: false },
  { nome: "Formação", descricao: null, cor: "#2563EB", ordem: 8, destacarNoPainel: false },
  { nome: "Ação social", descricao: null, cor: "#059669", ordem: 9, destacarNoPainel: false },
  { nome: "Encontro de grupos", descricao: null, cor: "#A16207", ordem: 10, destacarNoPainel: false },
  { nome: "Vigília", descricao: null, cor: "#4338CA", ordem: 11, destacarNoPainel: false },
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
