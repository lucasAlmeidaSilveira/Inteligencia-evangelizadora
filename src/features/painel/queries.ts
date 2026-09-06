import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

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
import { intervaloDoMes } from "@/lib/mes";

/* ─── Períodos ───────────────────────────────────────────────────────────── */

/*
 * O mês vem de `lib/mes.ts` e não daqui: o painel e /eventos falam o mesmo
 * `?mes=`, e as duas pontas precisam concordar sobre onde o mês começa e
 * termina. Duas contas iguais hoje divergiriam na primeira correção feita em
 * só uma delas.
 *
 * Ele viaja como chave (`"2026-09"`), não como `Date`: o argumento compõe a
 * chave do cache, e a de um `Date` seria o instante em que a página montou —
 * uma entrada nova a cada visita, nenhum acerto.
 */
function recorteDoMes(mes?: string) {
  if (!mes) return undefined;
  return intervaloDoMes(mes);
}

/* Um evento entra no período se qualquer parte dele o intersecta — o mesmo
   critério de `listarEventos`. Ação que atravessa a virada conta nos dois
   meses, que é como o coordenador a enxerga no calendário. */
function noPeriodo(intervalo?: { de: Date; ate: Date }) {
  return intervalo
    ? and(
        lte(eventos.dataInicio, intervalo.ate),
        gte(eventos.dataFim, intervalo.de),
      )
    : undefined;
}

/* ─── Panorama ───────────────────────────────────────────────────────────── */

/** O que não tem dimensão de período: vale hoje, qualquer que seja o recorte. */
export type Panorama = {
  missoesAtivas: number;
  membros: number;
  membrosEstimados: boolean;
  centrosAtivos: number;
  gruposAtivos: number;
  pessoasEmGrupos: number;
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
  // Marcar um tipo como destaque cria um cartão. Sem esta, ele só apareceria
  // quando a rede de segurança de cinco minutos vencesse.
  ETIQUETAS.tipos,
];

/**
 * Missões, membros, centros e grupos: o estado da obra hoje.
 *
 * `missaoId` é a missão em foco (ver `features/missoes/foco.ts`) e chega por
 * parâmetro, não lido do cookie aqui dentro: consulta que muda de resultado
 * sem a assinatura dizer nada é armadilha para quem for reusá-la — e, agora
 * que a leitura é cacheada, é também o que separa uma entrada por foco em vez
 * de servir o panorama de todas para quem escolheu uma. Basta estreitar esta
 * primeira lista — todo o resto já parte dos ids dela.
 *
 * Separada de `obterAcoes` porque nada aqui depende do mês escolhido: junto,
 * trocar o recorte recontaria membros e grupos de graça, e a fileira de cima
 * ficaria esperando a agregação de ações para aparecer.
 *
 * Cada consulta tem uma única tabela no FROM. Subconsulta correlacionada
 * escrita em `sql` bruto referencia a tabela externa sem qualificar o schema,
 * e o Postgres resolve o nome para a coluna homônima da tabela interna —
 * todos os totais voltam zerados sem erro algum.
 */
export const obterPanorama = leituraCacheada(
  "painel-panorama",
  async (tx, missaoId?: string): Promise<Panorama> => {
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

    return {
      missoesAtivas: lista.length,
      membros,
      membrosEstimados: algumEstimado,
      centrosAtivos: centros.total,
      gruposAtivos: grupos.total,
      pessoasEmGrupos: grupos.pessoas,
    };
  },
  { etiquetas: () => ETIQUETAS_DO_PAINEL, revalidar: CINCO_MINUTOS },
);

/* ─── Ações no período ───────────────────────────────────────────────────── */

/** Um tipo marcado em Configurações para ter cartão próprio no painel. */
export type TipoDestacado = {
  id: string;
  nome: string;
  cor: string;
  acoes: number;
  participantes: number;
};

export type ResumoDeAcoes = {
  destacados: TipoDestacado[];
  realizadas: number;
  /** Planejadas e em andamento — o que ainda vai acontecer no recorte. */
  agendadas: number;
  participantes: number;
  participantesNovos: number;
  servos: number;
  receitas: number;
  despesas: number;
  saldo: number;
};

const SEM_ACOES: ResumoDeAcoes = {
  destacados: [],
  realizadas: 0,
  agendadas: 0,
  participantes: 0,
  participantesNovos: 0,
  servos: 0,
  receitas: 0,
  despesas: 0,
  saldo: 0,
};

/**
 * O que as missões fizeram no recorte escolhido.
 *
 * Contagem de gente e de ação conta **só o realizado**: é o número que vai à
 * prestação de contas, e somar uma ação planejada faria o painel prometer
 * participantes que ainda não existem. O saldo é a exceção — conta tudo que
 * não foi cancelado, porque dinheiro gasto numa ação ainda planejada já saiu
 * do caixa.
 *
 * `mes` é a chave `"2026-09"`; ausente, vale todo o período. Vale a mesma
 * regra de uma tabela por FROM que `obterPanorama` explica: os recortes por
 * situação saem de `filter (where ...)`, não de subconsulta correlacionada.
 */
export const obterAcoes = leituraCacheada(
  "painel-acoes",
  async (tx, missaoId?: string, mes?: string): Promise<ResumoDeAcoes> => {
    const lista = await tx
      .select({ id: missoes.id })
      .from(missoes)
      .where(
        and(
          eq(missoes.ativo, true),
          missaoId ? eq(missoes.id, missaoId) : undefined,
        ),
      );

    const ids = lista.map((m) => m.id);
    if (ids.length === 0) return SEM_ACOES;

    const intervalo = recorteDoMes(mes);
    const doRecorte = and(inArray(eventos.missaoId, ids), noPeriodo(intervalo));

    const [totais] = await tx
      .select({
        realizadas: sql<number>`count(*) filter (where status = 'realizado')`.mapWith(Number),
        agendadas: sql<number>`count(*) filter (where status in ('planejado', 'em_andamento'))`.mapWith(Number),
        participantes: sql<number>`coalesce(sum(participantes_total) filter (where status = 'realizado'), 0)`.mapWith(Number),
        novos: sql<number>`coalesce(sum(participantes_novos) filter (where status = 'realizado'), 0)`.mapWith(Number),
        servos: sql<number>`coalesce(sum(servos_engajados) filter (where status = 'realizado'), 0)`.mapWith(Number),
      })
      .from(eventos)
      .where(doRecorte);

    /* Os tipos vêm antes da contagem e o resultado parte deles, não do
       agrupamento: um SVES sem nenhuma edição no mês precisa aparecer com
       zero. Se o cartão sumisse, o painel mudaria de forma a cada troca de
       mês, e "nenhum seminário em março" — que é a informação — viraria
       ausência de informação. */
    const tipos = await tx
      .select({
        id: tiposEvento.id,
        nome: tiposEvento.nome,
        cor: tiposEvento.cor,
      })
      .from(tiposEvento)
      .where(
        and(
          eq(tiposEvento.destacarNoPainel, true),
          eq(tiposEvento.ativo, true),
        ),
      )
      .orderBy(asc(tiposEvento.ordem), asc(tiposEvento.nome));

    let porTipo = new Map<string, { acoes: number; participantes: number }>();

    if (tipos.length > 0) {
      const linhas = await tx
        .select({
          tipoEventoId: eventos.tipoEventoId,
          acoes: sql<number>`count(*) filter (where status = 'realizado')`.mapWith(Number),
          participantes: sql<number>`coalesce(sum(participantes_total) filter (where status = 'realizado'), 0)`.mapWith(Number),
        })
        .from(eventos)
        .where(
          and(
            doRecorte,
            inArray(
              eventos.tipoEventoId,
              tipos.map((t) => t.id),
            ),
          ),
        )
        .groupBy(eventos.tipoEventoId);

      porTipo = new Map(linhas.map((l) => [l.tipoEventoId, l]));
    }

    /* O `status <> 'cancelado'` estava só no agregado ao lado, e o saldo somava
       lançamentos de ações canceladas — dinheiro que a missão não movimentou. */
    const doPeriodo = await tx
      .select({ id: eventos.id })
      .from(eventos)
      .where(and(doRecorte, sql`${eventos.status} <> 'cancelado'`));

    const idsEventos = doPeriodo.map((e) => e.id);
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
      destacados: tipos.map((tipo) => ({
        ...tipo,
        acoes: porTipo.get(tipo.id)?.acoes ?? 0,
        participantes: porTipo.get(tipo.id)?.participantes ?? 0,
      })),
      realizadas: totais.realizadas,
      agendadas: totais.agendadas,
      participantes: totais.participantes,
      participantesNovos: totais.novos,
      servos: totais.servos,
      receitas: financeiro.receitas,
      despesas: financeiro.despesas,
      saldo: financeiro.saldo,
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

/** Competência (o dia 1) do mês escolhido, ou o mês corrente. */
function competenciaDe(mes?: string) {
  const referencia = mes ? intervaloDoMes(mes).de : new Date();
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

/**
 * Série histórica para a linha de evolução.
 *
 * A janela termina no mês escolhido em vez de hoje: com o painel recortado em
 * março, uma linha que segue até dezembro mostraria o que ainda não tinha
 * acontecido. Continua com doze pontos — só muda onde está ancorada.
 *
 * Depende do registro de competência, que é opcional por decisão de produto —
 * pode vir vazia, e a interface precisa dizer isso em vez de desenhar um
 * gráfico de um ponto só.
 */
export const obterEvolucao = leituraCacheada(
  "painel-evolucao",
  async (
    tx,
    meses: number = 12,
    missaoId?: string,
    mes?: string,
  ): Promise<Evolucao> => {
    const fim = competenciaDe(mes);
    const corte = new Date(fim);
    corte.setMonth(corte.getMonth() - meses);

    /* Montada pelos componentes locais, não por `toISOString()`: a competência
       é o dia 1 no fuso de quem registrou, e o UTC de um horário negativo cai
       no último dia do mês anterior — a janela pegaria uma competência a mais
       de um lado e perderia o mês escolhido do outro. */
    const emIsoData = (data: Date) =>
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;

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
          gte(missaoIndicadores.competencia, emIsoData(corte)),
          lte(missaoIndicadores.competencia, emIsoData(fim)),
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

export type Comparativo = {
  missoes: BarraMissao[];
  /** Missões sem competência registrada até o mês — fora do ranking. */
  semRegistro: number;
};

/**
 * Ranking de missões por membros.
 *
 * Sem mês, compara o valor corrente. Com mês, compara o **último indicador
 * registrado até aquela competência**: perguntar "como estávamos em março" e
 * receber o número de hoje seria responder outra pergunta. O último conhecido,
 * e não só o do próprio mês, porque registrar competência é opcional — exigir
 * o mês exato esvaziaria o gráfico em quase todo recorte.
 *
 * Missão sem nenhum registro até ali fica de fora e é contada em
 * `semRegistro`: pôr o valor de hoje ao lado de valores históricos daria um
 * ranking com duas réguas, e a missão parecendo maior só por ser a única
 * medida no presente.
 */
export const obterComparativo = leituraCacheada(
  "painel-comparativo",
  async (tx, mes?: string): Promise<Comparativo> => {
    const lista = await tx
      .select({
        id: missoes.id,
        nome: missoes.nome,
        membrosTotal: missoes.membrosTotal,
      })
      .from(missoes)
      .where(eq(missoes.ativo, true));

    if (lista.length === 0) return { missoes: [], semRegistro: 0 };

    if (mes) {
      const fim = competenciaDe(mes);
      const ate = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-01`;

      // `distinct on` pela missão, ordenado por competência decrescente: o
      // Postgres guarda a primeira linha de cada grupo, que é a mais recente.
      const registros = await tx
        .selectDistinctOn([missaoIndicadores.missaoId], {
          missaoId: missaoIndicadores.missaoId,
          membros: missaoIndicadores.membrosTotal,
        })
        .from(missaoIndicadores)
        .where(
          and(
            lte(missaoIndicadores.competencia, ate),
            inArray(
              missaoIndicadores.missaoId,
              lista.map((m) => m.id),
            ),
          ),
        )
        .orderBy(
          asc(missaoIndicadores.missaoId),
          desc(missaoIndicadores.competencia),
        );

      const porMissao = new Map(registros.map((r) => [r.missaoId, r.membros]));

      const comRegistro = lista
        .filter((missao) => porMissao.has(missao.id))
        .map((missao) => ({
          id: missao.id,
          nome: missao.nome,
          membros: porMissao.get(missao.id) ?? 0,
          // Indicador é número informado, nunca estimativa pelos grupos.
          estimado: false,
        }))
        .sort((a, b) => b.membros - a.membros);

      return {
        missoes: comRegistro,
        semRegistro: lista.length - comRegistro.length,
      };
    }

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

    return {
      missoes: lista
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
        .sort((a, b) => b.membros - a.membros),
      semRegistro: 0,
    };
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
