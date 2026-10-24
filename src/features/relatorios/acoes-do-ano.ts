import { and, asc, eq, gte, lte, ne } from "drizzle-orm";

import {
  centroDoLocal,
  juncaoDoLocal,
  nomeDoLocal,
} from "@/features/eventos/local";
import type { Transacao } from "@/server/db/index";
import {
  centrosEvangelizacao,
  eventos,
  missoes,
  tiposEvento,
} from "@/server/db/schema";

import { limitesDoAno, type FiltrosAnuais } from "./anual";

/**
 * Toda ação que tocou o ano, uma linha por ação, em ordem de início.
 *
 * O critério é o de sobreposição do calendário e do relatório consolidado — a
 * ação que atravessa a virada entra nos dois anos —, com os limites no relógio
 * de São Paulo (ver `limitesDoAno`).
 *
 * Nenhum filtro de situação além das canceladas, que ficam de fora a não ser
 * que se peça. Uma ação que aconteceu e continua "planejada" porque ninguém a
 * atualizou é justamente a que este relatório não pode omitir; a situação vai
 * na linha, e quem lê vê o que falta fechar.
 *
 * Sem `server-only` e sem cache, como `agregadosPorMissao`: é o que deixa um
 * teste exercitar a consulta de verdade contra um banco com números
 * conhecidos. Quem atende a tela é `listarAcoesDoAno`, em `queries-anual.ts`.
 */
export async function consultarAcoesDoAno(
  tx: Transacao,
  filtros: FiltrosAnuais,
) {
  const { de, ate } = limitesDoAno(filtros.ano);

  return tx
    .select({
      id: eventos.id,
      titulo: eventos.titulo,
      tipoNome: tiposEvento.nome,
      tipoCor: tiposEvento.cor,
      missaoNome: missoes.nome,
      centroNome: centrosEvangelizacao.nome,
      // O centro escolhido como local ou o texto livre — ver `eventos/local.ts`.
      local: nomeDoLocal,
      dataInicio: eventos.dataInicio,
      dataFim: eventos.dataFim,
      status: eventos.status,
      destaqueRegional: eventos.destaqueRegional,
    })
    .from(eventos)
    .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
    .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
    .innerJoin(
      centrosEvangelizacao,
      eq(centrosEvangelizacao.id, eventos.centroId),
    )
    .leftJoin(centroDoLocal, juncaoDoLocal)
    .where(
      and(
        lte(eventos.dataInicio, ate),
        gte(eventos.dataFim, de),
        filtros.missaoId ? eq(eventos.missaoId, filtros.missaoId) : undefined,
        filtros.incluirCancelados ? undefined : ne(eventos.status, "cancelado"),
      ),
    )
    .orderBy(asc(eventos.dataInicio), asc(eventos.titulo));
}
