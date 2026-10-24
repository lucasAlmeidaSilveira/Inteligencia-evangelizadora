"use server";

import { eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import { eventoPesquisas, eventoRespostas, eventos } from "@/server/db/schema";
import { gerarToken } from "@/server/pesquisa";
import { revalidarEvento } from "@/features/eventos/revalidacao";

import { eventoIdSchema } from "./schemas";

/*
 * Ações do coordenador sobre a pesquisa da própria ação. Todas passam por
 * `comUsuario`: o RLS é quem decide se a ação é da missão dele, e a ausência
 * de linha significa ao mesmo tempo "não existe" e "não é sua". O id da ação
 * vem da URL e é conferido como uuid antes de chegar ao banco; `missaoId`
 * nunca vem do cliente — sai do `returning`.
 *
 * A action pública, que não tem usuário, fica em `actions-publicas.ts`.
 */

const PRAZO_PADRAO = sql`interval '14 days'`;

export async function abrirPesquisa(eventoId: unknown) {
  const id = eventoIdSchema.safeParse(eventoId);
  if (!id.success) return falha("Ação apostólica não encontrada.");

  try {
    const aberta = await comUsuario(async (tx, usuario) => {
      const [evento] = await tx
        .select({ missaoId: eventos.missaoId, dataFim: eventos.dataFim })
        .from(eventos)
        .where(eq(eventos.id, id.data))
        .limit(1);
      if (!evento) return null;

      /* Prazo decidido no banco, com o relógio dele: catorze dias depois do
         fim da ação, ou sete dias a partir de agora se a ação já passou há
         mais tempo — quem abre a pesquisa de um retiro antigo ainda precisa
         de uma janela para recolher respostas. */
      await tx.insert(eventoPesquisas).values({
        eventoId: id.data,
        token: gerarToken(),
        encerraEm: sql`greatest(${evento.dataFim}::timestamptz + ${PRAZO_PADRAO}, now() + interval '7 days')`,
        criadaPor: usuario.id,
      });

      return evento.missaoId;
    });

    if (!aberta) return falha("Ação apostólica não encontrada.");

    revalidarEvento(id.data, aberta);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Grava um punhado de colunas da pesquisa e revalida. Mesmo desenho de
 * `gravarCampos` em `eventos/actions.ts`: zero linhas alteradas é "não
 * encontrada", e a missão sai do `returning`.
 */
async function alterarPesquisa(
  eventoId: unknown,
  // O tipo do `set` do Drizzle, e não o da linha: aceita `sql\`now() + …\``,
  // que é como o prazo é calculado — no relógio do banco, não no do servidor.
  valores: PgUpdateSetSource<typeof eventoPesquisas>,
) {
  const id = eventoIdSchema.safeParse(eventoId);
  if (!id.success) return falha("Pesquisa não encontrada.");

  try {
    const missaoId = await comUsuario(async (tx) => {
      const [linha] = await tx
        .update(eventoPesquisas)
        .set(valores)
        .where(eq(eventoPesquisas.eventoId, id.data))
        .returning({ eventoId: eventoPesquisas.eventoId });
      if (!linha) return null;

      const [evento] = await tx
        .select({ missaoId: eventos.missaoId })
        .from(eventos)
        .where(eq(eventos.id, linha.eventoId))
        .limit(1);
      return evento?.missaoId ?? null;
    });

    if (!missaoId) return falha("Pesquisa não encontrada.");

    revalidarEvento(id.data, missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function encerrarPesquisa(eventoId: unknown) {
  return alterarPesquisa(eventoId, { aberta: false });
}

/** Reabrir ganha prazo novo: reabrir uma pesquisa vencida sem prazo não
 *  reabriria nada. */
export async function reabrirPesquisa(eventoId: unknown) {
  return alterarPesquisa(eventoId, {
    aberta: true,
    encerraEm: sql`now() + ${PRAZO_PADRAO}`,
  });
}

/** O link antigo deixa de funcionar na hora; as respostas ficam. */
export async function gerarNovoLink(eventoId: unknown) {
  return alterarPesquisa(eventoId, { token: gerarToken() });
}

/**
 * Recomeça do zero: apaga todas as respostas da ação e troca o link.
 *
 * O link é projetado num salão e vira público para quem estava lá; se alguém
 * o inundar de zeros, a média e o índice ficam envenenados e apagar
 * comentário por comentário não resolve — resposta sem comentário nem aparece
 * na lista. A policy de DELETE já é a de moderação; a ação só a aplica à ação
 * inteira, dentro de uma transação, junto com o token novo.
 */
export async function reiniciarPesquisa(eventoId: unknown) {
  const id = eventoIdSchema.safeParse(eventoId);
  if (!id.success) return falha("Pesquisa não encontrada.");

  try {
    const missaoId = await comUsuario(async (tx) => {
      const [linha] = await tx
        .update(eventoPesquisas)
        .set({ token: gerarToken(), aberta: true, encerraEm: sql`now() + ${PRAZO_PADRAO}` })
        .where(eq(eventoPesquisas.eventoId, id.data))
        .returning({ eventoId: eventoPesquisas.eventoId });
      if (!linha) return null;

      await tx
        .delete(eventoRespostas)
        .where(eq(eventoRespostas.eventoId, id.data));

      const [evento] = await tx
        .select({ missaoId: eventos.missaoId })
        .from(eventos)
        .where(eq(eventos.id, id.data))
        .limit(1);
      return evento?.missaoId ?? null;
    });

    if (!missaoId) return falha("Pesquisa não encontrada.");

    revalidarEvento(id.data, missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Moderação: apaga uma resposta inteira (nota e comentário). Não existe
 * "editar" — mexer na nota de um participante seria adulterar a pesquisa.
 */
export async function excluirResposta(respostaId: unknown) {
  const id = eventoIdSchema.safeParse(respostaId);
  if (!id.success) return falha("Resposta não encontrada.");

  try {
    const alvo = await comUsuario(async (tx) => {
      const [removida] = await tx
        .delete(eventoRespostas)
        .where(eq(eventoRespostas.id, id.data))
        .returning({ eventoId: eventoRespostas.eventoId });
      if (!removida) return null;

      const [evento] = await tx
        .select({ missaoId: eventos.missaoId })
        .from(eventos)
        .where(eq(eventos.id, removida.eventoId))
        .limit(1);
      return { eventoId: removida.eventoId, missaoId: evento?.missaoId };
    });

    if (!alvo) return falha("Resposta não encontrada.");

    revalidarEvento(alvo.eventoId, alvo.missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}
