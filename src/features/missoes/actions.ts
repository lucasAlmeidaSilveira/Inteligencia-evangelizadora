"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { gerarSlug } from "@/lib/slug";
import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import type { Transacao } from "@/server/db/index";
import { gruposOracao, missaoIndicadores, missoes } from "@/server/db/schema";

import { competenciaSchema, missaoSchema } from "./schemas";

/** Só admin cria missão — o RLS já barra, mas a mensagem aqui é legível. */
const APENAS_ADMIN = "Apenas o administrador geral pode fazer isso.";

/** Os números de uma missão aparecem em várias telas ao mesmo tempo.
 *  Revalidar a árvore sob /missoes evita que alguma delas continue servindo
 *  a contagem anterior depois de uma alteração. */
function revalidarArvore(missaoId?: string) {
  revalidatePath("/missoes", "layout");
  if (missaoId) revalidatePath(`/missoes/${missaoId}`, "layout");
  revalidatePath("/");
}

async function slugLivre(tx: Transacao, base: string) {
  let candidato = base || "missao";
  let n = 2;

  for (;;) {
    const [existente] = await tx
      .select({ id: missoes.id })
      .from(missoes)
      .where(eq(missoes.slug, candidato))
      .limit(1);

    if (!existente) return candidato;
    candidato = `${base}-${n++}`;
  }
}

export async function criarMissao(entrada: unknown) {
  const validado = missaoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const id = await comUsuario(async (tx, usuario) => {
      if (!usuario.ehAdmin) throw new Error(APENAS_ADMIN);

      const [criada] = await tx
        .insert(missoes)
        .values({
          ...validado.data,
          slug: await slugLivre(tx, gerarSlug(validado.data.nome)),
        })
        .returning({ id: missoes.id });

      return criada.id;
    });

    revalidarArvore(id);
    return sucesso({ id });
  } catch (erro) {
    if (erro instanceof Error && erro.message === APENAS_ADMIN) {
      return falha(APENAS_ADMIN);
    }
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function atualizarMissao(id: string, entrada: unknown) {
  const validado = missaoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const alterou = await comUsuario(async (tx) => {
      // O slug não acompanha o nome de propósito: links já compartilhados
      // continuam válidos depois de uma correção de grafia.
      const linhas = await tx
        .update(missoes)
        .set(validado.data)
        .where(eq(missoes.id, id))
        .returning({ id: missoes.id });

      return linhas.length > 0;
    });

    // Zero linhas com RLS ligado significa que a missão não é do usuário.
    if (!alterou) return falha("Missão não encontrada.");

    revalidarArvore(id);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function definirAtivoMissao(id: string, ativo: boolean) {
  try {
    const alterou = await comUsuario(async (tx, usuario) => {
      if (!usuario.ehAdmin) throw new Error(APENAS_ADMIN);

      const linhas = await tx
        .update(missoes)
        .set({ ativo })
        .where(eq(missoes.id, id))
        .returning({ id: missoes.id });

      return linhas.length > 0;
    });

    if (!alterou) return falha("Missão não encontrada.");

    revalidarArvore(id);
    return sucesso();
  } catch (erro) {
    if (erro instanceof Error && erro.message === APENAS_ADMIN) {
      return falha(APENAS_ADMIN);
    }
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function excluirMissao(id: string) {
  try {
    const removeu = await comUsuario(async (tx, usuario) => {
      if (!usuario.ehAdmin) throw new Error(APENAS_ADMIN);

      const linhas = await tx
        .delete(missoes)
        .where(eq(missoes.id, id))
        .returning({ id: missoes.id });

      return linhas.length > 0;
    });

    if (!removeu) return falha("Missão não encontrada.");

    revalidarArvore(id);
    return sucesso();
  } catch (erro) {
    if (erro instanceof Error && erro.message === APENAS_ADMIN) {
      return falha(APENAS_ADMIN);
    }
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Congela os números atuais da missão no mês escolhido.
 * É o que permite o gráfico de evolução — e é opcional: quem nunca registrar
 * continua usando o sistema normalmente, só sem linha de tendência.
 */
export async function registrarCompetencia(entrada: unknown) {
  const validado = competenciaSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { missaoId, competencia, observacao } = validado.data;

  try {
    const registrou = await comUsuario(async (tx) => {
      const [missao] = await tx
        .select({ membrosTotal: missoes.membrosTotal })
        .from(missoes)
        .where(eq(missoes.id, missaoId))
        .limit(1);

      if (!missao) return false;

      const [grupos] = await tx
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
          pessoas: sql<number>`coalesce(sum(${gruposOracao.quantidadePessoas}), 0)`.mapWith(Number),
        })
        .from(gruposOracao)
        .where(
          and(
            eq(gruposOracao.missaoId, missaoId),
            eq(gruposOracao.ativo, true),
          ),
        );

      await tx.insert(missaoIndicadores).values({
        missaoId,
        competencia,
        membrosTotal: missao.membrosTotal,
        gruposTotal: grupos.total,
        pessoasGruposTotal: grupos.pessoas,
        observacao,
      });

      return true;
    });

    if (!registrou) return falha("Missão não encontrada.");

    revalidarArvore(missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/** Achata os erros do zod em `{ campo: mensagem }` para o formulário. */
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
