"use server";

import { revalidatePath, updateTag } from "next/cache";
import { and, eq } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
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
  // As duas etiquetas de centro: a da missão alcança a lista e o select dela;
  // a geral alcança o que atravessa missões — o painel e o formulário de ação.
  updateTag(ETIQUETAS.centrosDaMissao(missaoId));
  updateTag(ETIQUETAS.centros);
  updateTag(ETIQUETAS.missoes);
  updateTag(ETIQUETAS.painel);

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

/** O principal é o destino de tudo que não foi separado — apagá-lo deixaria a
 *  missão sem para onde apontar. A mensagem diz a saída que existe. */
const PRINCIPAL_NAO_SE_APAGA =
  "O centro principal da missão não pode ser excluído. Se ele não é mais uma frente ativa, marque-o como inativo.";

const SEM_PRINCIPAL =
  "Esta missão está sem centro principal, e por isso não há para onde mover os grupos e as ações deste centro. Avise o administrador geral.";

/**
 * Apaga o centro e devolve o que foi remanejado.
 *
 * Os grupos e as ações não somem nem ficam soltos: passam para o **centro
 * principal** da missão, que é o destino do que não está separado em outra
 * frente. Fazer isso aqui, à vista e com o número aparecendo no aviso, é
 * melhor que uma regra no banco que mexesse nos vínculos em silêncio.
 */
export async function excluirCentro(id: string) {
  try {
    const resultado = await comUsuario(async (tx) => {
      const [alvo] = await tx
        .select({
          missaoId: centrosEvangelizacao.missaoId,
          principal: centrosEvangelizacao.principal,
        })
        .from(centrosEvangelizacao)
        .where(eq(centrosEvangelizacao.id, id))
        .limit(1);

      // RLS já filtrou: não veio nada significa que não existe ou não é dele.
      if (!alvo) return null;
      if (alvo.principal) throw new Error(PRINCIPAL_NAO_SE_APAGA);

      const [principal] = await tx
        .select({ id: centrosEvangelizacao.id })
        .from(centrosEvangelizacao)
        .where(
          and(
            eq(centrosEvangelizacao.missaoId, alvo.missaoId),
            eq(centrosEvangelizacao.principal, true),
          ),
        )
        .limit(1);

      // Toda missão tem principal desde a migration que criou a coluna, e
      // `criarMissao` mantém isso. Se faltar, é dado quebrado: parar aqui é
      // melhor que apagar o centro e derrubar a página no `not null`.
      if (!principal) throw new Error(SEM_PRINCIPAL);

      const grupos = await tx
        .update(gruposOracao)
        .set({ centroId: principal.id })
        .where(eq(gruposOracao.centroId, id))
        .returning({ id: gruposOracao.id });

      const acoes = await tx
        .update(eventos)
        .set({ centroId: principal.id })
        .where(eq(eventos.centroId, id))
        .returning({ id: eventos.id });

      await tx
        .delete(centrosEvangelizacao)
        .where(eq(centrosEvangelizacao.id, id));

      return {
        missaoId: alvo.missaoId,
        grupos: grupos.length,
        eventos: acoes.length,
      };
    });

    if (!resultado) return falha("Centro não encontrado.");

    revalidarArvore(resultado.missaoId);
    return sucesso({ grupos: resultado.grupos, eventos: resultado.eventos });
  } catch (erro) {
    if (erro instanceof Error && erro.message === PRINCIPAL_NAO_SE_APAGA) {
      return falha(PRINCIPAL_NAO_SE_APAGA);
    }
    if (erro instanceof Error && erro.message === SEM_PRINCIPAL) {
      return falha(SEM_PRINCIPAL);
    }
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
