import { inArray, sql } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import { eventos, gruposOracao } from "@/server/db/schema";

export type Vinculados = { grupos: number; eventos: number };

export const SEM_VINCULOS: Vinculados = { grupos: 0, eventos: 0 };

/**
 * Quantos grupos e ações pendem de cada centro — duas consultas no total,
 * independentemente da quantidade de centros.
 *
 * Sem `server-only` de propósito: assim o teste de regressão consegue chamar
 * esta função com uma transação própria e conferir os números contra dados
 * conhecidos.
 *
 * A tentação aqui é uma subconsulta correlacionada. Não use: dentro de um
 * fragmento `sql`, o Drizzle escreve a referência à tabela externa sem
 * qualificar o schema, e o Postgres resolve o nome para a coluna homônima da
 * tabela interna. Os totais voltam zerados, em silêncio.
 */
export async function vinculadosPorCentro(tx: Transacao, centroIds: string[]) {
  const mapa = new Map<string, Vinculados>();
  if (centroIds.length === 0) return mapa;

  const obter = (id: string) => {
    const atual = mapa.get(id);
    if (atual) return atual;
    const novo = { ...SEM_VINCULOS };
    mapa.set(id, novo);
    return novo;
  };

  const grupos = await tx
    .select({
      centroId: gruposOracao.centroId,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(gruposOracao)
    .where(inArray(gruposOracao.centroId, centroIds))
    .groupBy(gruposOracao.centroId);

  for (const linha of grupos) {
    if (linha.centroId) obter(linha.centroId).grupos = linha.total;
  }

  const acoes = await tx
    .select({
      centroId: eventos.centroId,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(eventos)
    .where(inArray(eventos.centroId, centroIds))
    .groupBy(eventos.centroId);

  for (const linha of acoes) {
    if (linha.centroId) obter(linha.centroId).eventos = linha.total;
  }

  return mapa;
}
