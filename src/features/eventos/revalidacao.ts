import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import { ETIQUETAS } from "@/server/etiquetas";

/*
 * Duas camadas, porque são dois caches distintos.
 *
 * `updateTag` expira o que `leituraCacheada` guardou no servidor; os
 * `revalidatePath` cuidam do Router Cache do navegador, que guarda a tela já
 * renderizada e não conhece etiqueta alguma. Só um dos dois deixaria metade do
 * caminho servindo o número anterior.
 *
 * `updateTag` e não `revalidateTag`: quem acabou de lançar uma despesa precisa
 * ver o saldo novo na volta, não o anterior servido como stale enquanto revalida.
 *
 * Vive fora de `actions.ts` porque um arquivo `"use server"` só pode exportar
 * Server Actions, e a pesquisa de satisfação (`features/pesquisas`) precisa
 * revalidar a mesma árvore depois de abrir ou encerrar uma pesquisa.
 */
export function revalidarEvento(eventoId?: string, missaoId?: string) {
  updateTag(ETIQUETAS.eventos);
  if (eventoId) updateTag(ETIQUETAS.evento(eventoId));
  updateTag(ETIQUETAS.painel);

  revalidatePath("/eventos", "layout");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`, "layout");
  if (missaoId) revalidatePath(`/missoes/${missaoId}`, "layout");
  revalidatePath("/missoes", "layout");
  revalidatePath("/calendario");
  revalidatePath("/relatorios");
  revalidatePath("/");
}
