import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { emIso } from "@/server/db/iso";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  centrosEvangelizacao,
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
  centrosAtivos: number;
  gruposAtivos: number;
  pessoasEmGrupos: number;
  acoesNoMes: number;
  acoesNoAno: number;
  participantesNoAno: number;
  servosNoAno: number;
  receitasNoAno: number;
  despesasNoAno: number;
  saldoNoAno: number;
};

/*
 * O painel cruza quatro domínios ao mesmo tempo, então responde às etiquetas
 * dos quatro: mexer num grupo de oração muda o total de membros, e mexer num
 * lançamento muda o saldo do ano. Etiqueta a menos aqui é número velho na
 * primeira tela que o coordenador abre.
 */
const ETIQUETAS_DO_PAINEL = [
  ETIQUETAS.painel,
  ETIQUETAS.missoes,
  ETIQUETAS.eventos,
  ETIQUETAS.grupos,
  ETIQUETAS.centros,
];

/**
 * Números do topo do painel.
 *
 * `missaoId` é a missão em foco (ver `features/missoes/foco.ts`) e chega por
 * parâmetro, não lido do cookie aqui dentro: consulta que muda de resultado
 * sem a assinatura dizer nada é armadilha para quem for reusá-la — e, agora
 * que a leitura é cacheada, é também o que separa uma entrada por foco em vez
 * de servir o panorama de todas para quem escolheu uma. Basta estreitar esta
 * primeira lista — todo o resto já parte dos ids dela.
 *
 * Cada consulta tem uma única tabela no FROM. Subconsulta correlacionada
 * escrita em `sql` bruto referencia a tabela externa sem qualificar o schema,
 * e o Postgres resolve o nome para a coluna homônima da tabela interna —
 * todos os totais voltam zerados sem erro algum.
 */
export const obterResumo = leituraCacheada(
  "painel-resumo",
  async (tx, missaoId?: string): Promise<Resumo> => {
    const lista = await tx
      .select({ id: missoes.id, membrosTotal: missoes.membrosTotal })
      .from(missoes)
      .where(
        and(
          eq(missoes.ativo, true),
          missaoId ? eq(missoes.id, missaoId) : undefined,
        ),
      );

    const ids = lista.map((m) => m.id);

    if (ids.length === 0) {
      return {
        missoesAtivas: 0,
        membros: 0,
        membrosEstimados: false,
        centrosAtivos: 0,
        gruposAtivos: 0,
        pessoasEmGrupos: 0,
        acoesNoMes: 0,
        acoesNoAno: 0,
        participantesNoAno: 0,
        servosNoAno: 0,
        receitasNoAno: 0,
        despesasNoAno: 0,
        saldoNoAno: 0,
      };
    }

    const [centros] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(centrosEvangelizacao)
      .where(
        and(
          inArray(centrosEvangelizacao.missaoId, ids),
          eq(centrosEvangelizacao.ativo, true),
        ),
      );

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
        acoes: sql<number>`count(*)`.mapWith(Number),
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
      centrosAtivos: centros.total,
      gruposAtivos: grupos.total,
      pessoasEmGrupos: grupos.pessoas,
      acoesNoMes: doMes.total,
      acoesNoAno: doAno.acoes,
      participantesNoAno: doAno.participantes,
      servosNoAno: doAno.servos,
      receitasNoAno: financeiro.receitas,
      despesasNoAno: financeiro.despesas,
      saldoNoAno: financeiro.saldo,
    };
  },
  { etiquetas: () => ETIQUETAS_DO_PAINEL, revalidar: CINCO_MINUTOS },
);

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
export const obterEvolucao = leituraCacheada(
  "painel-evolucao",
  async (tx, meses: number = 12, missaoId?: string): Promise<Evolucao> => {
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
      .where(
        and(
          gte(missaoIndicadores.competencia, corte.toISOString().slice(0, 10)),
          missaoId ? eq(missaoIndicadores.missaoId, missaoId) : undefined,
        ),
      )
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
  },
  { etiquetas: () => ETIQUETAS_DO_PAINEL, revalidar: CINCO_MINUTOS },
);

/* ─── Comparativo entre missões ──────────────────────────────────────────── */

export type BarraMissao = {
  id: string;
  nome: string;
  membros: number;
  estimado: boolean;
};

export const obterComparativo = leituraCacheada(
  "painel-comparativo",
  async (tx): Promise<BarraMissao[]> => {
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
  },
  { etiquetas: () => ETIQUETAS_DO_PAINEL, revalidar: CINCO_MINUTOS },
);

/* ─── Agenda ─────────────────────────────────────────────────────────────── */

const colunasAgenda = {
  id: eventos.id,
  titulo: eventos.titulo,
  // ISO, não `Date`: ver `server/db/iso.ts`. É o que permite cachear.
  dataInicio: emIso(eventos.dataInicio),
  dataFim: emIso(eventos.dataFim),
  local: eventos.local,
  status: eventos.status,
  missaoId: eventos.missaoId,
  missaoNome: missoes.nome,
  tipoNome: tiposEvento.nome,
  tipoCor: tiposEvento.cor,
};

/** Eventos que tocam o intervalo — inclusive os que atravessam a virada. */
export const obterEventosDoPeriodo = leituraCacheada(
  "agenda-periodo",
  async (tx, de: Date, ate: Date, missaoId?: string) =>
    tx
      .select(colunasAgenda)
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(
        and(
          lte(eventos.dataInicio, ate),
          gte(eventos.dataFim, de),
          missaoId ? eq(eventos.missaoId, missaoId) : undefined,
        ),
      )
      .orderBy(asc(eventos.dataInicio)),
  { etiquetas: () => [ETIQUETAS.eventos], revalidar: CINCO_MINUTOS },
);

/*
 * O corte é `now()` no momento em que a entrada é criada, não a cada leitura:
 * uma ação que termina fica na lista por até `revalidar` segundos depois de
 * passar. É aceitável para uma agenda que se lê por dia, e o preço de manter
 * a consulta fora do banco a cada visita.
 */
export const obterProximosEventos = leituraCacheada(
  "agenda-proximos",
  async (tx, limite: number = 5, missaoId?: string) =>
    tx
      .select(colunasAgenda)
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(
        and(
          gte(eventos.dataFim, new Date()),
          sql`${eventos.status} <> 'cancelado'`,
          missaoId ? eq(eventos.missaoId, missaoId) : undefined,
        ),
      )
      .orderBy(asc(eventos.dataInicio))
      .limit(limite),
  { etiquetas: () => [ETIQUETAS.eventos], revalidar: CINCO_MINUTOS },
);

export type EventoAgenda = Awaited<
  ReturnType<typeof obterEventosDoPeriodo>
>[number];
