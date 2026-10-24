"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import { notificacoes } from "@/server/db/schema";

/* O sino está no layout de toda página autenticada: é a árvore inteira que
   precisa refletir a leitura, ou a contagem voltaria na próxima navegação. */
function revalidar() {
  revalidatePath("/", "layout");
}

/**
 * Marca uma notificação como lida. Sem filtro por usuário no `where`: a
 * política de UPDATE já restringe às próprias linhas, e a de outra pessoa
 * simplesmente não existe para esta consulta.
 */
export async function marcarNotificacaoLida(id: string) {
  try {
    await comUsuario(async (tx) => {
      await tx
        .update(notificacoes)
        .set({ lidaEm: sql`now()` })
        .where(and(eq(notificacoes.id, id), isNull(notificacoes.lidaEm)));
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function marcarTodasLidas() {
  try {
    await comUsuario(async (tx, usuario) => {
      await tx
        .update(notificacoes)
        .set({ lidaEm: sql`now()` })
        .where(
          and(
            eq(notificacoes.usuarioId, usuario.id),
            isNull(notificacoes.lidaEm),
          ),
        );
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}
