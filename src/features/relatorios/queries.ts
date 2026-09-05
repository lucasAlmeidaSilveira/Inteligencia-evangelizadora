import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import {
  eventoLancamentos,
  eventos,
  missoes,
  tiposEvento,
} from "@/server/db/schema";
import { calcularFinanceiro, paraCentavos } from "@/features/eventos/financeiro";

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
export async function gerarRelatorio(
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  return comUsuario(async (tx) => {
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

    type Acumulador = {
      nome: string;
      cor?: string;
      acoes: number;
      participantes: number;
      servos: number;
      receitas: number;
      despesas: number;
    };

    const porMissao = new Map<string, Acumulador>();
    const porTipo = new Map<string, Acumulador>();

    const acumular = (
      mapa: Map<string, Acumulador>,
      chave: string,
      nome: string,
      cor: string | undefined,
      evento: (typeof lista)[number],
    ) => {
      const atual = mapa.get(chave) ?? {
        nome,
        cor,
        acoes: 0,
        participantes: 0,
        servos: 0,
        receitas: 0,
        despesas: 0,
      };
      const dinheiro = financeiroPorEvento.get(evento.id);
      atual.acoes += 1;
      atual.participantes += evento.participantes;
      atual.servos += evento.servos;
      atual.receitas += dinheiro?.receitas ?? 0;
      atual.despesas += dinheiro?.despesas ?? 0;
      mapa.set(chave, atual);
    };

    for (const evento of lista) {
      acumular(porMissao, evento.missaoId, evento.missaoNome, undefined, evento);
      acumular(porTipo, evento.tipoId, evento.tipoNome, evento.tipoCor, evento);
    }

    const finalizar = (mapa: Map<string, Acumulador>): LinhaRelatorio[] =>
      [...mapa.entries()]
        .map(([id, a]) => ({
          id,
          nome: a.nome,
          cor: a.cor,
          acoes: a.acoes,
          participantes: a.participantes,
          servos: a.servos,
          ...calcularFinanceiro(a.receitas / 100, a.despesas / 100),
        }))
        .sort((x, y) => y.participantes - x.participantes || y.acoes - x.acoes);

    const totalReceitas = [...porMissao.values()].reduce((s, a) => s + a.receitas, 0);
    const totalDespesas = [...porMissao.values()].reduce((s, a) => s + a.despesas, 0);

    return {
      porMissao: finalizar(porMissao),
      porTipo: finalizar(porTipo),
      total: {
        acoes: lista.length,
        participantes: lista.reduce((s, e) => s + e.participantes, 0),
        servos: lista.reduce((s, e) => s + e.servos, 0),
        ...calcularFinanceiro(totalReceitas / 100, totalDespesas / 100),
      },
      periodo: { de: filtros.de, ate: filtros.ate },
    };
  });
}
