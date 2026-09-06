import { and, eq, inArray, sql } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import {
  centrosEvangelizacao,
  eventos,
  gruposOracao,
} from "@/server/db/schema";

export type Agregados = {
  centrosAtivos: number;
  gruposAtivos: number;
  pessoasEmGrupos: number;
  eventosTotal: number;
  /**
   * ISO-8601, não `Date`.
   *
   * Mesma razão pela qual dinheiro trafega como string: é a forma que
   * atravessa serialização sem perder nada. Estes agregados alimentam
   * consultas cacheadas, e o `unstable_cache` grava com `JSON.stringify` — um
   * `Date` voltaria como string apenas a partir do segundo acesso, quando o
   * cache tem entrada. O tipo seria verdade na primeira visita e mentira na
   * seguinte, e o `.getTime()` quebraria só em produção.
   *
   * Os formatadores de `lib/format.ts` já aceitam `string | Date`, então a
   * exibição não muda.
   */
  proximoEvento: string | null;
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
  centrosAtivos: 0,
  gruposAtivos: 0,
  pessoasEmGrupos: 0,
  eventosTotal: 0,
  proximoEvento: null,
};

/**
 * Números derivados de cada missão, em três consultas agregadas.
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

  const centros = await tx
    .select({
      missaoId: centrosEvangelizacao.missaoId,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(centrosEvangelizacao)
    .where(
      and(
        inArray(centrosEvangelizacao.missaoId, missaoIds),
        eq(centrosEvangelizacao.ativo, true),
      ),
    )
    .groupBy(centrosEvangelizacao.missaoId);

  for (const linha of centros) {
    obter(linha.missaoId).centrosAtivos = linha.total;
  }

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
      // Normaliza para ISO: o driver ora devolve `Date`, ora string, conforme
      // o tipo da coluna e o mapeador. Fixar uma forma só aqui é o que faz o
      // valor sobreviver ao cache sem mudar de tipo entre a primeira visita e
      // a segunda.
      proximo: sql<string | null>`min(data_inicio) filter (where data_inicio >= now() and status <> 'cancelado')`.mapWith(
        (valor) =>
          valor === null || valor === undefined
            ? null
            : valor instanceof Date
              ? valor.toISOString()
              : new Date(valor as string).toISOString(),
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
