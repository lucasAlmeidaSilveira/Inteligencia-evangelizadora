import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import {
  eventoLancamentos,
  eventos,
  gruposOracao,
  missaoIndicadores,
  missoes,
  tiposEvento,
} from "@/server/db/schema";
import { membrosDaMissao } from "@/features/missoes/agregados";
import { calcularFinanceiro } from "@/features/eventos/financeiro";

/* ─── Períodos ───────────────────────────────────────────────────────────── */

export function inicioDoMes(referencia = new Date()) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

export function fimDoMes(referencia = new Date()) {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

function inicioDoAno(referencia = new Date()) {
  return new Date(referencia.getFullYear(), 0, 1);
}

/* ─── Panorama ───────────────────────────────────────────────────────────── */

export type Resumo = {
  missoesAtivas: number;
  membros: number;
  membrosEstimados: boolean;
  gruposAtivos: number;
  pessoasEmGrupos: number;
  acoesNoMes: number;
  participantesNoAno: number;
  servosNoAno: number;
  receitasNoAno: number;
  despesasNoAno: number;
  saldoNoAno: number;
};

/**
 * Números do topo do painel.
 *
 * Cada consulta tem uma única tabela no FROM. Subconsulta correlacionada
 * escrita em `sql` bruto referencia a tabela externa sem qualificar o schema,
 * e o Postgres resolve o nome para a coluna homônima da tabela interna —
 * todos os totais voltam zerados sem erro algum.
 */
export async function obterResumo(): Promise<Resumo> {
  return comUsuario(async (tx) => {
    const lista = await tx
      .select({ id: missoes.id, membrosTotal: missoes.membrosTotal })
      .from(missoes)
      .where(eq(missoes.ativo, true));

    const ids = lista.map((m) => m.id);

    if (ids.length === 0) {
      return {
        missoesAtivas: 0,
        membros: 0,
        membrosEstimados: false,
        gruposAtivos: 0,
        pessoasEmGrupos: 0,
        acoesNoMes: 0,
        participantesNoAno: 0,
        servosNoAno: 0,
        receitasNoAno: 0,
        despesasNoAno: 0,
        saldoNoAno: 0,
      };
    }

    const [grupos] = await tx
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        pessoas: sql<number>`coalesce(sum(quantidade_pessoas), 0)`.mapWith(Number),
      })
      .from(gruposOracao)
      .where(
        and(inArray(gruposOracao.missaoId, ids), eq(gruposOracao.ativo, true)),
      );

    // Pessoas em grupos por missão, para o mesmo critério de estimativa que a
    // página da missão usa: sem total informado, vale a soma dos grupos.
    const porMissao = await tx
      .select({
        missaoId: gruposOracao.missaoId,
        pessoas: sql<number>`coalesce(sum(quantidade_pessoas), 0)`.mapWith(Number),
      })
      .from(gruposOracao)
      .where(
        and(inArray(gruposOracao.missaoId, ids), eq(gruposOracao.ativo, true)),
      )
      .groupBy(gruposOracao.missaoId);

    const pessoasPorMissao = new Map(porMissao.map((l) => [l.missaoId, l.pessoas]));

    let membros = 0;
    let algumEstimado = false;
    for (const missao of lista) {
      const calculado = membrosDaMissao(
        missao.membrosTotal,
        pessoasPorMissao.get(missao.id) ?? 0,
      );
      membros += calculado.valor;
      if (calculado.estimado) algumEstimado = true;
    }

    const [doMes] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(eventos)
      .where(
        and(
          inArray(eventos.missaoId, ids),
          lte(eventos.dataInicio, fimDoMes()),
          gte(eventos.dataFim, inicioDoMes()),
        ),
      );

    const [doAno] = await tx
      .select({
        participantes: sql<number>`coalesce(sum(participantes_total), 0)`.mapWith(Number),
        servos: sql<number>`coalesce(sum(servos_engajados), 0)`.mapWith(Number),
      })
      .from(eventos)
      .where(
        and(
          inArray(eventos.missaoId, ids),
          gte(eventos.dataInicio, inicioDoAno()),
          sql`${eventos.status} <> 'cancelado'`,
        ),
      );

    const eventosDoAno = await tx
      .select({ id: eventos.id })
      .from(eventos)
      .where(
        and(
          inArray(eventos.missaoId, ids),
          gte(eventos.dataInicio, inicioDoAno()),
        ),
      );

    const idsEventos = eventosDoAno.map((e) => e.id);
    let financeiro = calcularFinanceiro(0, 0);

    if (idsEventos.length > 0) {
      const [somas] = await tx
        .select({
          receitas: sql<string>`coalesce(sum(valor) filter (where tipo = 'receita'), 0)`,
          despesas: sql<string>`coalesce(sum(valor) filter (where tipo = 'despesa'), 0)`,
        })
        .from(eventoLancamentos)
        .where(inArray(eventoLancamentos.eventoId, idsEventos));

      financeiro = calcularFinanceiro(somas.receitas, somas.despesas);
    }

    return {
      missoesAtivas: lista.length,
      membros,
      membrosEstimados: algumEstimado,
      gruposAtivos: grupos.total,
      pessoasEmGrupos: grupos.pessoas,
      acoesNoMes: doMes.total,
      participantesNoAno: doAno.participantes,
      servosNoAno: doAno.servos,
      receitasNoAno: financeiro.receitas,
      despesasNoAno: financeiro.despesas,
      saldoNoAno: financeiro.saldo,
    };
  });
}

/* ─── Evolução de membros ────────────────────────────────────────────────── */

export type PontoEvolucao = { competencia: string } & Record<string, number | string>;

export type Evolucao = {
  pontos: PontoEvolucao[];
  series: { chave: string; nome: string }[];
  competencias: number;
};

/**
 * Série histórica para a linha de evolução.
 *
 * Depende do registro de competência, que é opcional por decisão de produto —
 * pode vir vazia, e a interface precisa dizer isso em vez de desenhar um
 * gráfico de um ponto só.
 */
export async function obterEvolucao(meses = 12): Promise<Evolucao> {
  return comUsuario(async (tx) => {
    const corte = new Date();
    corte.setMonth(corte.getMonth() - meses);
    corte.setDate(1);

    const linhas = await tx
      .select({
        competencia: missaoIndicadores.competencia,
        missaoId: missaoIndicadores.missaoId,
        missaoNome: missoes.nome,
        membros: missaoIndicadores.membrosTotal,
      })
      .from(missaoIndicadores)
      .innerJoin(missoes, eq(missoes.id, missaoIndicadores.missaoId))
      .where(gte(missaoIndicadores.competencia, corte.toISOString().slice(0, 10)))
      .orderBy(asc(missaoIndicadores.competencia));

    const competencias = [...new Set(linhas.map((l) => l.competencia))];

    // Ordem fixa das séries: a cor acompanha a missão, não a posição no ranking.
    const missoesNaSerie = [...new Map(linhas.map((l) => [l.missaoId, l.missaoNome])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .slice(0, 5)
      .map(([id, nome]) => ({ chave: id, nome }));

    const porCompetencia = new Map<string, PontoEvolucao>();
    for (const competencia of competencias) {
      porCompetencia.set(competencia, { competencia });
    }
    for (const linha of linhas) {
      const ponto = porCompetencia.get(linha.competencia);
      if (ponto && missoesNaSerie.some((s) => s.chave === linha.missaoId)) {
        ponto[linha.missaoId] = linha.membros;
      }
    }

    return {
      pontos: [...porCompetencia.values()],
      series: missoesNaSerie,
      competencias: competencias.length,
    };
  });
}

/* ─── Comparativo entre missões ──────────────────────────────────────────── */

export type BarraMissao = {
  id: string;
  nome: string;
  membros: number;
  estimado: boolean;
};

export async function obterComparativo(): Promise<BarraMissao[]> {
  return comUsuario(async (tx) => {
    const lista = await tx
      .select({
        id: missoes.id,
        nome: missoes.nome,
        membrosTotal: missoes.membrosTotal,
      })
      .from(missoes)
      .where(eq(missoes.ativo, true));

    if (lista.length === 0) return [];

    const grupos = await tx
      .select({
        missaoId: gruposOracao.missaoId,
        pessoas: sql<number>`coalesce(sum(quantidade_pessoas), 0)`.mapWith(Number),
      })
      .from(gruposOracao)
      .where(
        and(
          inArray(
            gruposOracao.missaoId,
            lista.map((m) => m.id),
          ),
          eq(gruposOracao.ativo, true),
        ),
      )
      .groupBy(gruposOracao.missaoId);

    const pessoas = new Map(grupos.map((g) => [g.missaoId, g.pessoas]));

    return lista
      .map((missao) => {
        const calculado = membrosDaMissao(
          missao.membrosTotal,
          pessoas.get(missao.id) ?? 0,
        );
        return {
          id: missao.id,
          nome: missao.nome,
          membros: calculado.valor,
          estimado: calculado.estimado,
        };
      })
      // Ranking: sempre decrescente, que é como se lê comparação de magnitude.
      .sort((a, b) => b.membros - a.membros);
  });
}

/* ─── Agenda ─────────────────────────────────────────────────────────────── */

const colunasAgenda = {
  id: eventos.id,
  titulo: eventos.titulo,
  dataInicio: eventos.dataInicio,
  dataFim: eventos.dataFim,
  local: eventos.local,
  status: eventos.status,
  missaoId: eventos.missaoId,
  missaoNome: missoes.nome,
  tipoNome: tiposEvento.nome,
  tipoCor: tiposEvento.cor,
};

/** Eventos que tocam o intervalo — inclusive os que atravessam a virada. */
export async function obterEventosDoPeriodo(de: Date, ate: Date) {
  return comUsuario(async (tx) =>
    tx
      .select(colunasAgenda)
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(and(lte(eventos.dataInicio, ate), gte(eventos.dataFim, de)))
      .orderBy(asc(eventos.dataInicio)),
  );
}

export async function obterProximosEventos(limite = 5) {
  return comUsuario(async (tx) =>
    tx
      .select(colunasAgenda)
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(
        and(
          gte(eventos.dataFim, new Date()),
          sql`${eventos.status} <> 'cancelado'`,
        ),
      )
      .orderBy(asc(eventos.dataInicio))
      .limit(limite),
  );
}

export type EventoAgenda = Awaited<
  ReturnType<typeof obterEventosDoPeriodo>
>[number];
