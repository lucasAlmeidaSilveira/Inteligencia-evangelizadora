import "server-only";

import { cache } from "react";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import { emIso, emIsoOuNulo } from "@/server/db/iso";
import { notificacoes } from "@/server/db/schema";

/** O sino mostra as últimas; o resto é histórico que ninguém volta a ler. */
const LIMITE = 20;

/**
 * Notificações de quem está na requisição.
 *
 * Fora do `leituraCacheada` de propósito: a política é `usuario_id =
 * ie.usuario_id()`, então o resultado varia por pessoa dentro do mesmo recorte
 * de missão — e o cache compartilhado por recorte serviria o sino de um para
 * outro (ver `recorteDe` em `src/server/cache.ts`). O `cache` do React basta:
 * uma consulta por renderização, e a próxima página consulta de novo.
 */
export const listarNotificacoes = cache(async () => {
  return comUsuario(async (tx, usuario) => {
    const [itens, [{ naoLidas }]] = await Promise.all([
      tx
        .select({
          id: notificacoes.id,
          titulo: notificacoes.titulo,
          mensagem: notificacoes.mensagem,
          url: notificacoes.url,
          lidaEm: emIsoOuNulo(notificacoes.lidaEm),
          criadoEm: emIso(notificacoes.criadoEm),
        })
        .from(notificacoes)
        .where(eq(notificacoes.usuarioId, usuario.id))
        .orderBy(desc(notificacoes.criadoEm))
        .limit(LIMITE),
      // Contada à parte: o limite acima cortaria a contagem de quem acumulou
      // mais de vinte sem ler.
      tx
        .select({ naoLidas: sql<number>`count(*)`.mapWith(Number) })
        .from(notificacoes)
        .where(
          and(
            eq(notificacoes.usuarioId, usuario.id),
            isNull(notificacoes.lidaEm),
          ),
        ),
    ]);

    return { itens, naoLidas };
  });
});

export type NotificacaoListada = Awaited<
  ReturnType<typeof listarNotificacoes>
>["itens"][number];
