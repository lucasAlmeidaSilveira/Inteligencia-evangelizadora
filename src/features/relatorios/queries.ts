import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  eventoLancamentos,
  eventos,
  missoes,
  tiposEvento,
} from "@/server/db/schema";
import { calcularFinanceiro, paraCentavos } from "@/features/eventos/financeiro";
import { calcularImpacto } from "@/features/eventos/impacto";

export type FiltrosRelatorio = {
  de: Date;
  ate: Date;
  missaoId?: string;
  tipoEventoId?: string;
  incluirCancelados?: boolean;
};

export type LinhaRelatorio = {
  id: string;
  nome: string;
  cor?: string;
  acoes: number;
  participantes: number;
  servos: number;
  receitas: number;
  despesas: number;
  saldo: number;
  /** Média das notas de 0 a 10, só das ações que tiveram pesquisa. */
  nps: number | null;
  comNps: number;
  /** Média do Índice de Impacto Evangelizador, só das ações que têm índice.
   *  `comImpacto` diz de quantas: "72" de 3 ações em 40 não é "72". */
  impacto: number | null;
  comImpacto: number;
};

export type Relatorio = {
  porMissao: LinhaRelatorio[];
  porTipo: LinhaRelatorio[];
  total: Omit<LinhaRelatorio, "id" | "nome" | "cor">;
  periodo: { de: Date; ate: Date };
};

/**
 * Consolidação por missão e por tipo de ação.
 *
 * Duas consultas: os eventos do período e os lançamentos deles. A soma é feita
 * em memória, em centavos inteiros — agregar dinheiro em ponto flutuante deixa
 * centavo faltando no relatório, e ninguém consegue explicar de onde veio.
 */
const consolidar = leituraCacheada(
  "relatorio",
  async (
    tx,
    filtros: FiltrosRelatorio,
  ): Promise<Omit<Relatorio, "periodo">> => {
    const condicoes = [
      // Um evento entra se qualquer parte dele toca o período.
      lte(eventos.dataInicio, filtros.ate),
      gte(eventos.dataFim, filtros.de),
      filtros.missaoId ? eq(eventos.missaoId, filtros.missaoId) : undefined,
      filtros.tipoEventoId
        ? eq(eventos.tipoEventoId, filtros.tipoEventoId)
        : undefined,
      filtros.incluirCancelados
        ? undefined
        : sql`${eventos.status} <> 'cancelado'`,
    ].filter(Boolean);

    const lista = await tx
      .select({
        id: eventos.id,
        missaoId: eventos.missaoId,
        missaoNome: missoes.nome,
        tipoId: tiposEvento.id,
        tipoNome: tiposEvento.nome,
        tipoCor: tiposEvento.cor,
        participantes: eventos.participantesTotal,
        servos: eventos.servosEngajados,
        // O que o índice de impacto precisa além do financeiro.
        participantesInscritos: eventos.participantesInscritos,
        participantesNovos: eventos.participantesNovos,
        participantesPermaneceram: eventos.participantesPermaneceram,
        nps: eventos.nps,
        orcamentoPrevisto: eventos.orcamentoPrevisto,
      })
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(and(...condicoes))
      .orderBy(asc(missoes.nome));

    const financeiroPorEvento = new Map<
      string,
      { receitas: number; despesas: number }
    >();

    if (lista.length > 0) {
      const somas = await tx
        .select({
          eventoId: eventoLancamentos.eventoId,
          receitas: sql<string>`coalesce(sum(valor) filter (where tipo = 'receita'), 0)`,
          despesas: sql<string>`coalesce(sum(valor) filter (where tipo = 'despesa'), 0)`,
        })
        .from(eventoLancamentos)
        .where(
          inArray(
            eventoLancamentos.eventoId,
            lista.map((e) => e.id),
          ),
        )
        .groupBy(eventoLancamentos.eventoId);

      for (const linha of somas) {
        financeiroPorEvento.set(linha.eventoId, {
          receitas: paraCentavos(linha.receitas),
          despesas: paraCentavos(linha.despesas),
        });
      }
    }

    /* O índice de cada ação sai da mesma função que a tela da ação usa: o
       relatório nunca pode dizer um número e a ação, outro. Calculado uma vez
       por evento e reaproveitado nos dois agrupamentos. */
    const impactoPorEvento = new Map<string, number | null>();
    for (const evento of lista) {
      const dinheiro = financeiroPorEvento.get(evento.id);
      const receitas = (dinheiro?.receitas ?? 0) / 100;
      const despesas = (dinheiro?.despesas ?? 0) / 100;
      impactoPorEvento.set(
        evento.id,
        calcularImpacto({
          participantesInscritos: evento.participantesInscritos,
          participantesTotal: evento.participantes,
          participantesNovos: evento.participantesNovos,
          participantesPermaneceram: evento.participantesPermaneceram,
          nps: evento.nps,
          orcamentoPrevisto: evento.orcamentoPrevisto,
          financeiro: { receitas, despesas, saldo: receitas - despesas },
        }).indice,
      );
    }

    type Acumulador = {
      nome: string;
      cor?: string;
      acoes: number;
      participantes: number;
      servos: number;
      receitas: number;
      despesas: number;
      /* Somas e contagens separadas, não médias parciais: a média de médias
         daria peso igual a uma ação e a dez. */
      somaNps: number;
      comNps: number;
      somaImpacto: number;
      comImpacto: number;
    };

    const novoAcumulador = (nome: string, cor?: string): Acumulador => ({
      nome,
      cor,
      acoes: 0,
      participantes: 0,
      servos: 0,
      receitas: 0,
      despesas: 0,
      somaNps: 0,
      comNps: 0,
      somaImpacto: 0,
      comImpacto: 0,
    });

    const porMissao = new Map<string, Acumulador>();
    const porTipo = new Map<string, Acumulador>();
    const geral = novoAcumulador("Geral");

    const acumularEm = (atual: Acumulador, evento: (typeof lista)[number]) => {
      const dinheiro = financeiroPorEvento.get(evento.id);
      atual.acoes += 1;
      atual.participantes += evento.participantes;
      atual.servos += evento.servos;
      atual.receitas += dinheiro?.receitas ?? 0;
      atual.despesas += dinheiro?.despesas ?? 0;

      const nps = evento.nps === null ? null : Number(evento.nps);
      if (nps !== null && Number.isFinite(nps)) {
        atual.somaNps += nps;
        atual.comNps += 1;
      }
      const impacto = impactoPorEvento.get(evento.id) ?? null;
      if (impacto !== null) {
        atual.somaImpacto += impacto;
        atual.comImpacto += 1;
      }
    };

    const acumular = (
      mapa: Map<string, Acumulador>,
      chave: string,
      nome: string,
      cor: string | undefined,
      evento: (typeof lista)[number],
    ) => {
      const atual = mapa.get(chave) ?? novoAcumulador(nome, cor);
      acumularEm(atual, evento);
      mapa.set(chave, atual);
    };

    for (const evento of lista) {
      acumular(porMissao, evento.missaoId, evento.missaoNome, undefined, evento);
      acumular(porTipo, evento.tipoId, evento.tipoNome, evento.tipoCor, evento);
      acumularEm(geral, evento);
    }

    const fechar = (a: Acumulador) => ({
      acoes: a.acoes,
      participantes: a.participantes,
      servos: a.servos,
      ...calcularFinanceiro(a.receitas / 100, a.despesas / 100),
      nps: a.comNps > 0 ? a.somaNps / a.comNps : null,
      comNps: a.comNps,
      impacto: a.comImpacto > 0 ? a.somaImpacto / a.comImpacto : null,
      comImpacto: a.comImpacto,
    });

    const finalizar = (mapa: Map<string, Acumulador>): LinhaRelatorio[] =>
      [...mapa.entries()]
        .map(([id, a]) => ({ id, nome: a.nome, cor: a.cor, ...fechar(a) }))
        .sort((x, y) => y.participantes - x.participantes || y.acoes - x.acoes);

    return {
      porMissao: finalizar(porMissao),
      porTipo: finalizar(porTipo),
      total: fechar(geral),
    };
  },
  { etiquetas: () => [ETIQUETAS.eventos], revalidar: CINCO_MINUTOS },
);

/**
 * O `periodo` é eco da entrada, não resultado de consulta — por isso é
 * reanexado aqui fora, depois do cache.
 *
 * Assim ele continua sendo `Date`, que é o que `csv.ts` espera para chamar
 * `toLocaleDateString` e `toISOString`. Dentro do escopo cacheado ele voltaria
 * como string no segundo acesso, e o nome do arquivo exportado quebraria.
 */
export async function gerarRelatorio(
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  return {
    ...(await consolidar(filtros)),
    periodo: { de: filtros.de, ate: filtros.ate },
  };
}
