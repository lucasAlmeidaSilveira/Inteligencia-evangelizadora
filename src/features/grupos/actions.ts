"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import type { Transacao } from "@/server/db/index";
import {
  grupoContagens,
  grupoPastores,
  gruposOracao,
} from "@/server/db/schema";

import { contagemSchema, grupoSchema } from "./schemas";

type Pastor = { nome: string; telefone: string | null };

type Contagem = {
  membrosEfetivos: number;
  membrosFlutuantes: number;
  membrosEvadidos: number;
};

/**
 * Mudar um grupo muda os totais que aparecem na listagem de missões, na visão
 * geral e no painel. Revalidar a árvore inteira sob /missoes é o que garante
 * que a contagem não fique velha — revalidar só a página do grupo deixaria as
 * outras servindo o número anterior.
 */
function revalidarArvore(missaoId: string) {
  // A geral entra junto porque o painel soma as pessoas em grupos de todas as
  // missões — sem ela o total continuaria o anterior.
  updateTag(ETIQUETAS.gruposDaMissao(missaoId));
  updateTag(ETIQUETAS.grupos);
  updateTag(ETIQUETAS.missoes);
  updateTag(ETIQUETAS.painel);

  revalidatePath("/missoes", "layout");
  revalidatePath(`/missoes/${missaoId}`, "layout");
  revalidatePath("/grupos");
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

/**
 * Uma linha de histórico por contagem informada.
 *
 * Vai na mesma transação da escrita no grupo: ou os dois gravam, ou nenhum.
 * Histórico sem o grupo atualizado — ou o contrário — faria a tela dizer uma
 * contagem e o lembrete decidir por outra.
 */
async function registrarHistorico(
  tx: Transacao,
  grupoId: string,
  contagem: Contagem,
  usuarioId: string,
) {
  await tx.insert(grupoContagens).values({
    grupoId,
    ...contagem,
    registradoPor: usuarioId,
  });
}

function mesmaContagem(a: Contagem, b: Contagem) {
  return (
    a.membrosEfetivos === b.membrosEfetivos &&
    a.membrosFlutuantes === b.membrosFlutuantes &&
    a.membrosEvadidos === b.membrosEvadidos
  );
}

export async function criarGrupo(missaoId: string, entrada: unknown) {
  const validado = grupoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { pastores, ...grupo } = validado.data;

  try {
    const id = await comUsuario(async (tx, usuario) => {
      const [criado] = await tx
        .insert(gruposOracao)
        .values({ ...grupo, missaoId })
        .returning({ id: gruposOracao.id });

      await regravarPastores(tx, criado.id, pastores);
      // O cadastro já é a primeira contagem: é dela que o bimestre passa a
      // contar para o lembrete.
      await registrarHistorico(tx, criado.id, grupo, usuario.id);
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
    const missaoId = await comUsuario(async (tx, usuario) => {
      // Lida antes de gravar, para saber se os números mudaram. Editar o
      // horário ou o local não é uma contagem nova, e registrar histórico
      // nesses casos faria o lembrete acreditar que o grupo foi recontado.
      const [anterior] = await tx
        .select({
          membrosEfetivos: gruposOracao.membrosEfetivos,
          membrosFlutuantes: gruposOracao.membrosFlutuantes,
          membrosEvadidos: gruposOracao.membrosEvadidos,
        })
        .from(gruposOracao)
        .where(eq(gruposOracao.id, id))
        .limit(1);

      // Nada encontrado com RLS ligado: o grupo é de outra missão.
      if (!anterior) return null;

      const [atualizado] = await tx
        .update(gruposOracao)
        .set(grupo)
        .where(eq(gruposOracao.id, id))
        .returning({ missaoId: gruposOracao.missaoId });

      if (!atualizado) return null;

      await regravarPastores(tx, id, pastores);

      if (!mesmaContagem(anterior, grupo)) {
        await registrarHistorico(tx, id, grupo, usuario.id);
      }

      return atualizado.missaoId;
    });

    if (!missaoId) return falha("Grupo não encontrado.");

    revalidarArvore(missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Só a contagem — o caminho do lembrete bimestral.
 *
 * Diferente de `atualizarGrupo`, grava histórico mesmo quando os números não
 * mudaram: quem abre pelo lembrete e confirma "continua 12, 3 e 1" fez a
 * contagem do bimestre, e é isso que precisa ficar registrado para o lembrete
 * não voltar amanhã.
 */
export async function registrarContagem(grupoId: string, entrada: unknown) {
  const validado = contagemSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const missaoId = await comUsuario(async (tx, usuario) => {
      const [atualizado] = await tx
        .update(gruposOracao)
        .set(validado.data)
        .where(eq(gruposOracao.id, grupoId))
        .returning({ missaoId: gruposOracao.missaoId });

      if (!atualizado) return null;

      await registrarHistorico(tx, grupoId, validado.data, usuario.id);
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
