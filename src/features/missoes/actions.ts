"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";

import { missoesDisponiveis } from "@/features/eventos/queries";
import { gerarSlug } from "@/lib/slug";
import { requerUsuario } from "@/server/auth/sessao";
import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import type { Transacao } from "@/server/db/index";
import {
  centrosEvangelizacao,
  gruposOracao,
  missaoIndicadores,
  missoes,
} from "@/server/db/schema";

import { COOKIE_FOCO, DURACAO_FOCO_S } from "./foco";
import { competenciaSchema, missaoSchema } from "./schemas";

/** Só admin cria missão — o RLS já barra, mas a mensagem aqui é legível. */
const APENAS_ADMIN = "Apenas o administrador geral pode fazer isso.";

/** Os números de uma missão aparecem em várias telas ao mesmo tempo.
 *  Revalidar a árvore sob /missoes evita que alguma delas continue servindo
 *  a contagem anterior depois de uma alteração. */
function revalidarArvore(missaoId?: string) {
  revalidatePath("/missoes", "layout");
  if (missaoId) revalidatePath(`/missoes/${missaoId}`, "layout");
  // Equipe também depende da lista de missões: é dela que sai o select do
  // convite, e o nome da missão aparece ao lado de cada pessoa. Sem isto uma
  // missão recém-criada não aparece para vincular, e uma excluída continua
  // aparecendo.
  revalidatePath("/equipe");
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

/**
 * Criação de missão — sempre ato do administrador master. Cria só a missão.
 *
 * O responsável não entra aqui, embora a informação costume estar à mão: quem
 * responde pela missão é a conta com papel `responsavel` vinculada a ela, e
 * gravar esse vínculo é atribuição de `convidarUsuario`, na tela Equipe. Uma
 * segunda porta para a mesma escrita seria uma porta sem `normalizar()`, sem a
 * trava de própria conta e sem a checagem de quem já está na equipe — foi
 * exatamente o que existiu aqui, e o `on conflict` movia de missão, em
 * silêncio, quem já tivesse conta.
 *
 * A missão recém-criada fica sem responsável até isso ser feito, e a tela dela
 * avisa disso com um caminho direto para Equipe.
 *
 * O que nasce junto é o **centro principal**, na mesma transação. Ele é o que
 * torna possível `grupos_oracao.centro_id` e `eventos.centro_id` serem
 * obrigatórios: sempre existe um centro para onde apontar. Criá-lo aqui, e não
 * depois, é o que impede uma missão de existir sem ele nem por um instante.
 */
export async function criarMissao(entrada: unknown) {
  const validado = missaoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const dadosMissao = validado.data;

  try {
    const id = await comUsuario(async (tx, usuario) => {
      if (!usuario.ehAdmin) throw new Error(APENAS_ADMIN);

      const [criada] = await tx
        .insert(missoes)
        .values({
          ...dadosMissao,
          slug: await slugLivre(tx, gerarSlug(dadosMissao.nome)),
        })
        .returning({ id: missoes.id });

      // Com o nome da própria missão: é como as missões chamam a sede, e
      // poupa o coordenador de aprender um rótulo novo. `cidade` e `regiao`
      // ficam em branco de propósito — nesta tabela, em branco significa "as
      // mesmas da missão", e copiá-las criaria uma cópia para divergir.
      await tx.insert(centrosEvangelizacao).values({
        missaoId: criada.id,
        nome: dadosMissao.nome,
        tipo: "centro_evangelizacao",
        principal: true,
      });

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

/**
 * Escolhe a missão em foco — o recorte que a barra lateral aplica ao painel,
 * ao calendário, às ações e aos relatórios. `null` volta para "todas".
 *
 * Esconder o seletor de quem não é admin não é permissão: a conferência de
 * papel acontece aqui. E o id é validado contra as missões que o usuário
 * enxerga, para o cookie nunca virar um `where` que ele não poderia pedir.
 */
export async function definirFoco(missaoId: string | null) {
  const usuario = await requerUsuario();
  if (!usuario.ehAdmin) return falha(APENAS_ADMIN);

  const jar = await cookies();

  if (missaoId === null) {
    jar.delete(COOKIE_FOCO);
  } else {
    const opcoes = await missoesDisponiveis();
    if (!opcoes.some((m) => m.id === missaoId)) {
      return falha("Missão não encontrada.");
    }

    jar.set(COOKIE_FOCO, missaoId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_FOCO_S,
    });
  }

  // O recorte vale para a árvore inteira, e o rótulo do seletor mora no layout.
  revalidatePath("/", "layout");
  return sucesso();
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
