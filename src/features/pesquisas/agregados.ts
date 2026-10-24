import { and, between, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import { eventoRespostas } from "@/server/db/schema";

import {
  FAIXAS_DE_NOTA,
  type AgregadoRespostas,
  type FaixaDeNota,
} from "./satisfacao";

/*
 * Consultas sobre respostas que recebem a transação pronta.
 *
 * Sem `server-only`, como `missoes/agregados.ts`: é o que deixa
 * `pnpm testar:consultas` chamá-las contra um banco de verdade, com números
 * escolhidos a dedo. Quem decide o escopo continua sendo quem abre a
 * transação — `queries.ts` as embrulha em `leituraCacheada`.
 */

/**
 * Respostas de várias ações, agregadas numa consulta.
 *
 * Uma única tabela no FROM, pelo mesmo motivo de `financeiroPorEvento`: uma
 * subconsulta correlacionada em `sql` bruto resolveria o nome da coluna para a
 * tabela errada e devolveria zero em silêncio. Os literais 0..10 do `array`
 * são montados em código, nunca de entrada externa.
 */
const CONTAGEM_POR_NOTA = sql.raw(
  Array.from({ length: 11 }, (_, n) => `count(*) filter (where nota = ${n})::int`)
    .join(", "),
);

export async function respostasPorEvento(tx: Transacao, eventoIds: string[]) {
  const mapa = new Map<string, AgregadoRespostas>();
  if (eventoIds.length === 0) return mapa;

  const linhas = await tx
    .select({
      eventoId: eventoRespostas.eventoId,
      quantidade: sql<number>`count(*)::int`,
      soma: sql<number>`coalesce(sum(nota), 0)::int`,
      promotores: sql<number>`count(*) filter (where nota >= 9)::int`,
      detratores: sql<number>`count(*) filter (where nota <= 6)::int`,
      // `count(coluna)` ignora nulo: conta só quem escreveu alguma coisa.
      comentarios: sql<number>`count(comentario)::int`,
      distribuicao: sql<number[]>`array[${CONTAGEM_POR_NOTA}]`,
    })
    .from(eventoRespostas)
    .where(inArray(eventoRespostas.eventoId, eventoIds))
    .groupBy(eventoRespostas.eventoId);

  for (const linha of linhas) {
    mapa.set(linha.eventoId, {
      quantidade: linha.quantidade,
      soma: linha.soma,
      promotores: linha.promotores,
      detratores: linha.detratores,
      comentarios: linha.comentarios,
      distribuicao: linha.distribuicao,
    });
  }
  return mapa;
}

/* ─── Lista completa de comentários, paginada ────────────────────────────── */

export const COMENTARIOS_POR_PAGINA = 20;

export type ComentarioListado = {
  id: string;
  nota: number;
  comentario: string;
  /** ISO, não `Date`: a página passa pelo cache. Ver `server/db/iso.ts`. */
  respondidaEm: string;
};

/** `type` e não `interface`: só alias ganha a assinatura de índice implícita
 *  que `leituraCacheada` exige para provar que o retorno é serializável. */
export type PaginaDeComentarios = {
  itens: ComentarioListado[];
  /** Comentários em cada faixa, para o filtro dizer quantos há antes do clique. */
  porFaixa: Record<FaixaDeNota | "todas", number>;
  /** Total da faixa escolhida — o que a paginação divide. */
  total: number;
  /** A página de fato devolvida: fora do intervalo vira a mais próxima. */
  pagina: number;
  paginas: number;
};

/**
 * Uma página dos comentários de uma ação, do mais recente ao mais antigo.
 *
 * Duas consultas: as contagens por faixa — que dizem quantas páginas existem —
 * e a página em si. Página pedida além da última vira a última, em vez de uma
 * lista vazia: é o que acontece quando o coordenador apaga o único comentário
 * da página 3 e a tela recarrega.
 *
 * O desempate por `id` na ordenação é o que torna a paginação estável: duas
 * respostas no mesmo instante — a semeadura gera isso, um salão inteiro
 * também — poderiam trocar de lugar entre uma página e outra, e uma delas
 * apareceria duas vezes enquanto a outra sumiria.
 */
export async function comentariosPaginados(
  tx: Transacao,
  eventoId: string,
  faixa: FaixaDeNota | null,
  pagina: number,
): Promise<PaginaDeComentarios> {
  const comComentario = and(
    eq(eventoRespostas.eventoId, eventoId),
    isNotNull(eventoRespostas.comentario),
  );

  const [contagem] = await tx
    .select({
      todas: sql<number>`count(*)::int`,
      baixas: sql<number>`count(*) filter (where ${eventoRespostas.nota} between 0 and 6)::int`,
      medias: sql<number>`count(*) filter (where ${eventoRespostas.nota} between 7 and 8)::int`,
      altas: sql<number>`count(*) filter (where ${eventoRespostas.nota} between 9 and 10)::int`,
    })
    .from(eventoRespostas)
    .where(comComentario);

  // As chaves espelham FAIXAS_DE_NOTA; o teste de consultas confere a soma.
  const porFaixa: PaginaDeComentarios["porFaixa"] = {
    todas: contagem?.todas ?? 0,
    "0-6": contagem?.baixas ?? 0,
    "7-8": contagem?.medias ?? 0,
    "9-10": contagem?.altas ?? 0,
  };

  const total = faixa ? porFaixa[faixa] : porFaixa.todas;
  const paginas = Math.max(1, Math.ceil(total / COMENTARIOS_POR_PAGINA));
  const atual = Math.min(Math.max(1, Math.trunc(pagina) || 1), paginas);

  if (total === 0) {
    return { itens: [], porFaixa, total, pagina: 1, paginas: 1 };
  }

  const recorte = FAIXAS_DE_NOTA.find((f) => f.valor === faixa);
  const linhas = await tx
    .select({
      id: eventoRespostas.id,
      nota: eventoRespostas.nota,
      comentario: sql<string>`${eventoRespostas.comentario}`,
      respondidaEm: eventoRespostas.respondidaEm,
    })
    .from(eventoRespostas)
    .where(
      recorte
        ? and(comComentario, between(eventoRespostas.nota, recorte.de, recorte.ate))
        : comComentario,
    )
    .orderBy(desc(eventoRespostas.respondidaEm), desc(eventoRespostas.id))
    .limit(COMENTARIOS_POR_PAGINA)
    .offset((atual - 1) * COMENTARIOS_POR_PAGINA);

  return {
    itens: linhas.map((linha) => ({
      ...linha,
      respondidaEm: new Date(linha.respondidaEm).toISOString(),
    })),
    porFaixa,
    total,
    pagina: atual,
    paginas,
  };
}
