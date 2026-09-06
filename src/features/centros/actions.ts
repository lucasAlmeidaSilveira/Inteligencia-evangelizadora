"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import {
  centrosEvangelizacao,
  eventos,
  gruposOracao,
} from "@/server/db/schema";

import { centroSchema } from "./schemas";

/**
 * Mudar um centro muda a contagem que aparece na listagem de missões, na visão
 * geral da missão e no painel. Revalidar a árvore inteira sob /missoes é o que
 * garante que o número não fique velho — revalidar só a aba dos centros
 * deixaria as outras telas servindo o total anterior.
 */
function revalidarArvore(missaoId: string) {
  revalidatePath("/missoes", "layout");
  revalidatePath(`/missoes/${missaoId}`, "layout");
  // As ações apostólicas têm árvore própria e mostram o nome do centro, que
  // vem por JOIN: renomear ou excluir um centro muda o que elas exibem, e sem
  // isto a tela da ação continuaria servindo o nome antigo — ou o de um centro
  // que não existe mais.
  revalidatePath("/eventos", "layout");
  revalidatePath("/");
}

export async function criarCentro(missaoId: string, entrada: unknown) {
  const validado = centroSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    /* Sem checagem de papel: montar uma frente nova é trabalho de quem está na
       missão, como cadastrar um grupo de oração. O que o auxiliar não faz —
       alterar o cadastro da missão — continua fora, e quem impõe isso é o
       RLS, não este arquivo. */
    const id = await comUsuario(async (tx) => {
      const [criado] = await tx
        .insert(centrosEvangelizacao)
        .values({ ...validado.data, missaoId })
        .returning({ id: centrosEvangelizacao.id });

      return criado.id;
    });

    revalidarArvore(missaoId);
    return sucesso({ id });
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function atualizarCentro(id: string, entrada: unknown) {
  const validado = centroSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const missaoId = await comUsuario(async (tx) => {
      const [atualizado] = await tx
        .update(centrosEvangelizacao)
        .set(validado.data)
        .where(eq(centrosEvangelizacao.id, id))
        .returning({ missaoId: centrosEvangelizacao.missaoId });

      // Nada atualizado com RLS ligado: o centro é de outra missão.
      return atualizado?.missaoId ?? null;
    });

    if (!missaoId) return falha("Centro não encontrado.");

    revalidarArvore(missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Apaga o centro e devolve o que ficou solto.
 *
 * O FK de grupos e ações é `no action` de propósito: desvincular aqui, à
 * vista, é melhor que um `set null` silencioso no banco. Nada se perde — os
 * grupos e as ações voltam a pender diretamente da missão, que é exatamente o
 * estado de antes desta feature.
 */
export async function excluirCentro(id: string) {
  try {
    const resultado = await comUsuario(async (tx) => {
      const grupos = await tx
        .update(gruposOracao)
        .set({ centroId: null })
        .where(eq(gruposOracao.centroId, id))
        .returning({ id: gruposOracao.id });

      const acoes = await tx
        .update(eventos)
        .set({ centroId: null })
        .where(eq(eventos.centroId, id))
        .returning({ id: eventos.id });

      const [removido] = await tx
        .delete(centrosEvangelizacao)
        .where(eq(centrosEvangelizacao.id, id))
        .returning({ missaoId: centrosEvangelizacao.missaoId });

      if (!removido) return null;

      return {
        missaoId: removido.missaoId,
        grupos: grupos.length,
        eventos: acoes.length,
      };
    });

    if (!resultado) return falha("Centro não encontrado.");

    revalidarArvore(resultado.missaoId);
    return sucesso({ grupos: resultado.grupos, eventos: resultado.eventos });
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

function camposComErro(erro: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "");
    if (campo && !campos[campo]) campos[campo] = problema.message;
  }
  return campos;
}
