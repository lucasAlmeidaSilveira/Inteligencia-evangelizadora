import "server-only";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { emIso } from "@/server/db/iso";
import type { Transacao } from "@/server/db/index";
import { eventoPesquisas, eventoRespostas } from "@/server/db/schema";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  comPesquisaLimitada,
  marcarTokenDesconhecido,
  tokenDesconhecido,
} from "@/server/pesquisa";

import { comentariosPaginados } from "./agregados";

/* O agregado mora em `agregados.ts`, sem `server-only`, para o teste de
   consultas alcançá-lo; quem importa daqui continua importando daqui. */
export { respostasPorEvento } from "./agregados";

/**
 * A lista completa de comentários da aba "Pesquisa", uma página por vez.
 *
 * Mesma etiqueta da ação: uma resposta nova (a action pública expira só
 * essa etiqueta) ou uma exclusão (`revalidarEvento`) já invalidam a lista,
 * sem que ninguém precise lembrar de que ela existe.
 */
export const listarComentarios = leituraCacheada(
  "comentarios-pesquisa",
  comentariosPaginados,
  {
    etiquetas: ([eventoId]) => [ETIQUETAS.evento(eventoId)],
    revalidar: CINCO_MINUTOS,
  },
);

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
    // Mesmo desempate da lista paginada: o card e a aba mostram a mesma ordem.
    .orderBy(desc(eventoRespostas.respondidaEm), desc(eventoRespostas.id))
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
