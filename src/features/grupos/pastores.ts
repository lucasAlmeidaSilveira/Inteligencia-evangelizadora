import { asc, inArray } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import { grupoPastores } from "@/server/db/schema";

export type Pastor = {
  id: string;
  nome: string;
  telefone: string | null;
  ordem: number;
};

/**
 * Pastores de vários grupos numa consulta só, agrupados em memória.
 *
 * Sem `server-only` de propósito: assim o teste de regressão consegue chamar
 * esta função com uma transação própria e conferir os números contra dados
 * conhecidos.
 *
 * A tentação aqui é uma subconsulta correlacionada com `json_agg`. Não use:
 * dentro de um fragmento `sql`, o Drizzle escreve a referência à tabela
 * externa sem qualificar o schema, e o Postgres resolve o nome para a coluna
 * homônima da tabela interna. `where p.grupo_id = "id"` vira `p.grupo_id =
 * p.id`, que nunca é verdadeiro — e o resultado volta vazio, em silêncio.
 */
export async function pastoresPorGrupo(tx: Transacao, grupoIds: string[]) {
  const mapa = new Map<string, Pastor[]>();
  if (grupoIds.length === 0) return mapa;

  const linhas = await tx
    .select({
      id: grupoPastores.id,
      grupoId: grupoPastores.grupoId,
      nome: grupoPastores.nome,
      telefone: grupoPastores.telefone,
      ordem: grupoPastores.ordem,
    })
    .from(grupoPastores)
    .where(inArray(grupoPastores.grupoId, grupoIds))
    .orderBy(asc(grupoPastores.ordem));

  for (const { grupoId, ...pastor } of linhas) {
    const lista = mapa.get(grupoId);
    if (lista) lista.push(pastor);
    else mapa.set(grupoId, [pastor]);
  }

  return mapa;
}
