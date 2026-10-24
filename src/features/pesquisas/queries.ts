import "server-only";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { emIso } from "@/server/db/iso";
import type { Transacao } from "@/server/db/index";
import { eventoPesquisas, eventoRespostas } from "@/server/db/schema";
import {
  comPesquisaLimitada,
  marcarTokenDesconhecido,
  tokenDesconhecido,
} from "@/server/pesquisa";

import type { AgregadoRespostas } from "./satisfacao";

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
      distribuicao: linha.distribuicao,
    });
  }
  return mapa;
}

/** A pesquisa de uma ação, como o coordenador a vê. ISO para caber no cache. */
export async function pesquisaDoEvento(tx: Transacao, eventoId: string) {
  const [pesquisa] = await tx
    .select({
      id: eventoPesquisas.id,
      token: eventoPesquisas.token,
      aberta: eventoPesquisas.aberta,
      encerraEm: emIso(eventoPesquisas.encerraEm),
      criadoEm: emIso(eventoPesquisas.criadoEm),
      // Calculado no banco, com o relógio dele: a tela decide "encerrada"
      // sem comparar datas em JavaScript.
      aceitaRespostas: sql<boolean>`${eventoPesquisas.aberta} and ${eventoPesquisas.encerraEm} > now()`,
    })
    .from(eventoPesquisas)
    .where(eq(eventoPesquisas.eventoId, eventoId))
    .limit(1);

  return pesquisa ?? null;
}

/** Os comentários mais recentes — só respostas que escreveram algo. */
export async function comentariosDoEvento(
  tx: Transacao,
  eventoId: string,
  limite = 5,
) {
  return tx
    .select({
      id: eventoRespostas.id,
      nota: eventoRespostas.nota,
      comentario: sql<string>`${eventoRespostas.comentario}`,
      respondidaEm: emIso(eventoRespostas.respondidaEm),
    })
    .from(eventoRespostas)
    .where(
      and(
        eq(eventoRespostas.eventoId, eventoId),
        isNotNull(eventoRespostas.comentario),
      ),
    )
    .orderBy(desc(eventoRespostas.respondidaEm))
    .limit(limite);
}

export type PesquisaDoEvento = NonNullable<
  Awaited<ReturnType<typeof pesquisaDoEvento>>
>;
export type ComentarioDaPesquisa = Awaited<
  ReturnType<typeof comentariosDoEvento>
>[number];

/* ─── Caminho público ────────────────────────────────────────────────────── */

export type PesquisaPublica = {
  titulo: string;
  /** Já decidido pelo banco: aberta e dentro do prazo. */
  aceitaRespostas: boolean;
};

/**
 * O que a página pública mostra. Passa por `ie.pesquisa_do_token()`, que é
 * tudo que o papel `pesquisa` enxerga — e a função só devolve título e se
 * aceita respostas, decidido pelo relógio do banco, o mesmo que
 * `responder_pesquisa()` usa para recusar.
 */
export async function pesquisaPeloToken(
  token: string,
): Promise<PesquisaPublica | null> {
  if (tokenDesconhecido(token)) return null;

  const linha = await comPesquisaLimitada(token, async (tx) => {
    const { rows } = await tx.execute<{ titulo: string; aceita: boolean }>(
      sql`select titulo, aceita from ie.pesquisa_do_token()`,
    );
    return rows[0] ?? null;
  });

  if (!linha) {
    marcarTokenDesconhecido(token);
    return null;
  }
  return { titulo: linha.titulo, aceitaRespostas: linha.aceita };
}
