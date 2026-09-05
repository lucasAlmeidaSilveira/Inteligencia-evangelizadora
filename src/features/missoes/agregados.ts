import { and, eq, inArray, sql } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import { eventos, gruposOracao } from "@/server/db/schema";

export type Agregados = {
  gruposAtivos: number;
  pessoasEmGrupos: number;
  eventosTotal: number;
  proximoEvento: Date | null;
};

/**
 * Quantos membros exibir para a missão.
 *
 * Quando ninguém informou o total no cadastro, a soma das pessoas nos grupos
 * de oração ativos é a melhor aproximação disponível — mas é uma estimativa,
 * e a interface precisa dizer isso. Um número derivado apresentado como se
 * fosse declarado leva a decisão errada mais tarde.
 */
export function membrosDaMissao(
  membrosTotal: number,
  pessoasEmGrupos: number,
): { valor: number; estimado: boolean } {
  if (membrosTotal > 0) return { valor: membrosTotal, estimado: false };
  // Sem grupos também não há o que estimar: zero é zero, não uma estimativa.
  if (pessoasEmGrupos > 0) return { valor: pessoasEmGrupos, estimado: true };
  return { valor: 0, estimado: false };
}

export const ZERADO: Agregados = {
  gruposAtivos: 0,
  pessoasEmGrupos: 0,
  eventosTotal: 0,
  proximoEvento: null,
};

/**
 * Números derivados de cada missão, em duas consultas agregadas.
 *
 * Cada consulta tem uma única tabela no FROM — de propósito. Uma subconsulta
 * correlacionada escrita em `sql` bruto referencia a tabela externa sem
 * qualificação, e o Postgres resolve o nome para a coluna homônima da tabela
 * interna: `g.missao_id = g.id`, sempre falsa, com todos os totais voltando
 * zerados e nenhum erro para denunciar.
 *
 * Sem `server-only` para que o teste de regressão possa exercitá-la direto.
 */
export async function agregadosPorMissao(tx: Transacao, missaoIds: string[]) {
  const mapa = new Map<string, Agregados>();
  if (missaoIds.length === 0) return mapa;

  const obter = (id: string) => {
    const atual = mapa.get(id);
    if (atual) return atual;
    const novo = { ...ZERADO };
    mapa.set(id, novo);
    return novo;
  };

  const grupos = await tx
    .select({
      missaoId: gruposOracao.missaoId,
      total: sql<number>`count(*)`.mapWith(Number),
      pessoas: sql<number>`coalesce(sum(quantidade_pessoas), 0)`.mapWith(Number),
    })
    .from(gruposOracao)
    .where(
      and(
        inArray(gruposOracao.missaoId, missaoIds),
        eq(gruposOracao.ativo, true),
      ),
    )
    .groupBy(gruposOracao.missaoId);

  for (const linha of grupos) {
    const alvo = obter(linha.missaoId);
    alvo.gruposAtivos = linha.total;
    alvo.pessoasEmGrupos = linha.pessoas;
  }

  const acoes = await tx
    .select({
      missaoId: eventos.missaoId,
      total: sql<number>`count(*)`.mapWith(Number),
      // Conversão explícita: sem mapeador, o driver devolve a data como
      // string e o tipo `Date` seria uma mentira que só aparece em produção,
      // no primeiro `.getTime()`.
      proximo: sql<Date | null>`min(data_inicio) filter (where data_inicio >= now() and status <> 'cancelado')`.mapWith(
        (valor) =>
          valor === null || valor === undefined
            ? null
            : valor instanceof Date
              ? valor
              : new Date(valor as string),
      ),
    })
    .from(eventos)
    .where(inArray(eventos.missaoId, missaoIds))
    .groupBy(eventos.missaoId);

  for (const linha of acoes) {
    const alvo = obter(linha.missaoId);
    alvo.eventosTotal = linha.total;
    alvo.proximoEvento = linha.proximo;
  }

  return mapa;
}
