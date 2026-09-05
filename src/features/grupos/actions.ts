"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import type { Transacao } from "@/server/db/index";
import { grupoPastores, gruposOracao } from "@/server/db/schema";

import { grupoSchema } from "./schemas";

type Pastor = { nome: string; telefone: string | null };

/**
 * Mudar um grupo muda os totais que aparecem na listagem de missões, na visão
 * geral e no painel. Revalidar a árvore inteira sob /missoes é o que garante
 * que a contagem não fique velha — revalidar só a página do grupo deixaria as
 * outras servindo o número anterior.
 */
function revalidarArvore(missaoId: string) {
  revalidatePath("/missoes", "layout");
  revalidatePath(`/missoes/${missaoId}`, "layout");
  revalidatePath("/");
}

/**
 * Substitui a lista de pastores por completo.
 * Apagar e reinserir mantém a numeração de `ordem` sempre contígua (1, 2, 3),
 * que é o que a restrição de unicidade do banco espera. Como são no máximo 3
 * linhas e tudo corre na mesma transação, o custo é irrelevante.
 */
async function regravarPastores(
  tx: Transacao,
  grupoId: string,
  lista: Pastor[],
) {
  await tx.delete(grupoPastores).where(eq(grupoPastores.grupoId, grupoId));

  await tx.insert(grupoPastores).values(
    lista.map((pastor, indice) => ({
      grupoId,
      ...pastor,
      ordem: indice + 1,
    })),
  );
}

export async function criarGrupo(missaoId: string, entrada: unknown) {
  const validado = grupoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { pastores, ...grupo } = validado.data;

  try {
    const id = await comUsuario(async (tx) => {
      const [criado] = await tx
        .insert(gruposOracao)
        .values({ ...grupo, missaoId })
        .returning({ id: gruposOracao.id });

      await regravarPastores(tx, criado.id, pastores);
      return criado.id;
    });

    revalidarArvore(missaoId);
    return sucesso({ id });
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function atualizarGrupo(id: string, entrada: unknown) {
  const validado = grupoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { pastores, ...grupo } = validado.data;

  try {
    const missaoId = await comUsuario(async (tx) => {
      const [atualizado] = await tx
        .update(gruposOracao)
        .set(grupo)
        .where(eq(gruposOracao.id, id))
        .returning({ missaoId: gruposOracao.missaoId });

      // Nada atualizado com RLS ligado: o grupo é de outra missão.
      if (!atualizado) return null;

      await regravarPastores(tx, id, pastores);
      return atualizado.missaoId;
    });

    if (!missaoId) return falha("Grupo não encontrado.");

    revalidarArvore(missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function excluirGrupo(id: string) {
  try {
    const missaoId = await comUsuario(async (tx) => {
      const [removido] = await tx
        .delete(gruposOracao)
        .where(eq(gruposOracao.id, id))
        .returning({ missaoId: gruposOracao.missaoId });

      return removido?.missaoId ?? null;
    });

    if (!missaoId) return falha("Grupo não encontrado.");

    revalidarArvore(missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

function camposComErro(erro: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    // Caminhos aninhados viram "pastores.0.nome", que é a chave que o
    // react-hook-form usa para achar o campo na tela.
    const caminho = problema.path.map(String).join(".");
    if (caminho && !campos[caminho]) campos[caminho] = problema.message;
  }
  return campos;
}
