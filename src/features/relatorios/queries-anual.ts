import "server-only";

import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { ETIQUETAS } from "@/server/etiquetas";

import { consultarAcoesDoAno } from "./acoes-do-ano";
import type { FiltrosAnuais } from "./anual";

/**
 * As ações do ano para a tela e a exportação, guardadas entre requisições.
 *
 * A consulta mora em `acoes-do-ano.ts`, fora do `server-only`, para o teste
 * alcançá-la; aqui ela só ganha o cache e as datas em ISO — `Date` voltaria do
 * cache como string, e o tipo diria outra coisa (ver `server/db/iso.ts`).
 */
export const listarAcoesDoAno = leituraCacheada(
  "relatorio-anual",
  async (tx, filtros: FiltrosAnuais) =>
    (await consultarAcoesDoAno(tx, filtros)).map((acao) => ({
      ...acao,
      dataInicio: acao.dataInicio.toISOString(),
      dataFim: acao.dataFim.toISOString(),
    })),
  {
    // Os nomes de missão, centro e tipo vêm por JOIN: renomear qualquer um
    // muda o relatório, e não só escrever numa ação.
    etiquetas: () => [
      ETIQUETAS.eventos,
      ETIQUETAS.missoes,
      ETIQUETAS.centros,
      ETIQUETAS.tipos,
    ],
    revalidar: CINCO_MINUTOS,
  },
);

export type AcaoDoAno = Awaited<ReturnType<typeof listarAcoesDoAno>>[number];
