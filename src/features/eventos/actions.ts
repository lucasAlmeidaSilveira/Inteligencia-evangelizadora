"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import type { Transacao } from "@/server/db/index";
import {
  eventoDocumentos,
  eventoLancamentos,
  eventoLinks,
  eventos,
} from "@/server/db/schema";
import {
  montarChave,
  removerObjeto,
  TAMANHO_MAXIMO_BYTES,
  tipoEhPermitido,
  TIPOS_PERMITIDOS,
  urlDeDownload,
  urlDeUpload,
} from "@/server/armazenamento/r2";

import { eventoSchema, lancamentoSchema, linkSchema } from "./schemas";

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
 */
function revalidar(eventoId?: string, missaoId?: string) {
  updateTag(ETIQUETAS.eventos);
  if (eventoId) updateTag(ETIQUETAS.evento(eventoId));
  updateTag(ETIQUETAS.painel);

  revalidatePath("/eventos", "layout");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`, "layout");
  if (missaoId) revalidatePath(`/missoes/${missaoId}`, "layout");
  revalidatePath("/missoes", "layout");
  revalidatePath("/calendario");
  revalidatePath("/");
}

/**
 * Confirma que o evento existe e é acessível, devolvendo a missão dona.
 * Com RLS ligado, um evento de outra missão simplesmente não é encontrado —
 * então este `select` é, ao mesmo tempo, a verificação de permissão.
 */
async function missaoDoEvento(tx: Transacao, eventoId: string) {
  const [evento] = await tx
    .select({ missaoId: eventos.missaoId })
    .from(eventos)
    .where(eq(eventos.id, eventoId))
    .limit(1);
  return evento?.missaoId ?? null;
}

function camposComErro(erro: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const caminho = problema.path.map(String).join(".");
    if (caminho && !campos[caminho]) campos[caminho] = problema.message;
  }
  return campos;
}

/* ═══════════════════════════════ Evento ═══════════════════════════════════ */

export async function criarEvento(entrada: unknown) {
  const validado = eventoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { dataInicio, dataFim, ...resto } = validado.data;

  try {
    const id = await comUsuario(async (tx) => {
      const [criado] = await tx
        .insert(eventos)
        .values({
          ...resto,
          dataInicio: new Date(dataInicio),
          dataFim: new Date(dataFim),
        })
        .returning({ id: eventos.id });
      return criado.id;
    });

    revalidar(id, validado.data.missaoId);
    return sucesso({ id });
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function atualizarEvento(id: string, entrada: unknown) {
  const validado = eventoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { dataInicio, dataFim, ...resto } = validado.data;

  try {
    const alterou = await comUsuario(async (tx) => {
      const linhas = await tx
        .update(eventos)
        .set({
          ...resto,
          dataInicio: new Date(dataInicio),
          dataFim: new Date(dataFim),
        })
        .where(eq(eventos.id, id))
        .returning({ id: eventos.id });
      return linhas.length > 0;
    });

    if (!alterou) return falha("Ação apostólica não encontrada.");

    revalidar(id, validado.data.missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/**
 * Liga e desliga o destaque para o regional direto do cabeçalho.
 *
 * Recebe só o id: o `destaque` novo sai do valor atual no banco e o `missaoId`
 * do próprio `returning`, nunca do cliente — um responsável poderia forjar a
 * requisição, e o RLS é quem garante que o UPDATE não alcança ação de outra
 * missão. Existe separada de `atualizarEvento` porque marcar destaque não pode
 * exigir revalidar o formulário inteiro.
 */
export async function alternarDestaqueRegional(id: string) {
  try {
    const alterado = await comUsuario(async (tx) => {
      const [linha] = await tx
        .update(eventos)
        .set({ destaqueRegional: sql`not ${eventos.destaqueRegional}` })
        .where(eq(eventos.id, id))
        .returning({
          missaoId: eventos.missaoId,
          destaque: eventos.destaqueRegional,
        });
      return linha ?? null;
    });

    if (!alterado) return falha("Ação apostólica não encontrada.");

    revalidar(id, alterado.missaoId);
    return sucesso({ destaque: alterado.destaque });
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function excluirEvento(id: string) {
  try {
    const resultado = await comUsuario(async (tx) => {
      // Guarda as chaves antes: apagar a linha leva os documentos junto por
      // cascata, e sem isso os arquivos ficariam órfãos no R2 para sempre.
      const chaves = await tx
        .select({ chave: eventoDocumentos.chaveArmazenamento })
        .from(eventoDocumentos)
        .where(eq(eventoDocumentos.eventoId, id));

      const [removido] = await tx
        .delete(eventos)
        .where(eq(eventos.id, id))
        .returning({ missaoId: eventos.missaoId });

      return removido ? { missaoId: removido.missaoId, chaves } : null;
    });

    if (!resultado) return falha("Ação apostólica não encontrada.");

    // Fora da transação: falha no armazenamento não deve desfazer a exclusão.
    for (const { chave } of resultado.chaves) {
      await removerObjeto(chave).catch((erro) =>
        console.error("Documento órfão no R2:", chave, erro),
      );
    }

    revalidar(undefined, resultado.missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/* ════════════════════════════ Financeiro ══════════════════════════════════ */

export async function adicionarLancamento(entrada: unknown) {
  const validado = lancamentoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { eventoId, data, ...resto } = validado.data;

  try {
    const missaoId = await comUsuario(async (tx) => {
      const missao = await missaoDoEvento(tx, eventoId);
      if (!missao) return null;

      await tx.insert(eventoLancamentos).values({ ...resto, eventoId, data });
      return missao;
    });

    if (!missaoId) return falha("Ação apostólica não encontrada.");

    revalidar(eventoId, missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function excluirLancamento(id: string) {
  try {
    const eventoId = await comUsuario(async (tx) => {
      const [removido] = await tx
        .delete(eventoLancamentos)
        .where(eq(eventoLancamentos.id, id))
        .returning({ eventoId: eventoLancamentos.eventoId });
      return removido?.eventoId ?? null;
    });

    if (!eventoId) return falha("Lançamento não encontrado.");

    revalidar(eventoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/* ═══════════════════════════════ Links ════════════════════════════════════ */

export async function adicionarLink(entrada: unknown) {
  const validado = linkSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  const { eventoId, ...resto } = validado.data;

  try {
    const missaoId = await comUsuario(async (tx) => {
      const missao = await missaoDoEvento(tx, eventoId);
      if (!missao) return null;
      await tx.insert(eventoLinks).values({ ...resto, eventoId });
      return missao;
    });

    if (!missaoId) return falha("Ação apostólica não encontrada.");

    revalidar(eventoId, missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

export async function excluirLink(id: string) {
  try {
    const eventoId = await comUsuario(async (tx) => {
      const [removido] = await tx
        .delete(eventoLinks)
        .where(eq(eventoLinks.id, id))
        .returning({ eventoId: eventoLinks.eventoId });
      return removido?.eventoId ?? null;
    });

    if (!eventoId) return falha("Link não encontrado.");

    revalidar(eventoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/* ════════════════════════════ Documentos ══════════════════════════════════ */

/**
 * Autoriza um envio e devolve uma URL assinada de curta duração.
 *
 * Os bytes vão do navegador direto para o R2, sem passar pelo servidor Next —
 * o que evita o limite de tamanho de corpo das funções serverless. A
 * autorização acontece aqui: a URL só é emitida depois de o RLS confirmar
 * que o evento pertence a uma missão do usuário.
 */
export async function prepararEnvio(
  eventoId: string,
  arquivo: { nome: string; tipoMime: string; tamanhoBytes: number },
) {
  if (!tipoEhPermitido(arquivo.tipoMime)) {
    return falha(
      `Formato não aceito. Envie ${Object.values(TIPOS_PERMITIDOS).join(", ")}.`,
    );
  }

  if (arquivo.tamanhoBytes <= 0 || arquivo.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
    return falha(
      `O arquivo excede ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)} MB.`,
    );
  }

  try {
    const missaoId = await comUsuario((tx) => missaoDoEvento(tx, eventoId));
    if (!missaoId) return falha("Ação apostólica não encontrada.");

    const chave = montarChave(missaoId, eventoId, arquivo.nome);
    const url = await urlDeUpload(chave, arquivo.tipoMime);

    return sucesso({ url, chave });
  } catch (erro) {
    console.error("Falha ao preparar envio:", erro);
    return falha("Não foi possível preparar o envio.");
  }
}

/** Registra o documento depois que o navegador concluiu o envio ao R2. */
export async function registrarDocumento(dados: {
  eventoId: string;
  nome: string;
  chave: string;
  tipoMime: string;
  tamanhoBytes: number;
}) {
  if (!tipoEhPermitido(dados.tipoMime)) return falha("Formato não aceito.");

  try {
    const missaoId = await comUsuario(async (tx) => {
      const missao = await missaoDoEvento(tx, dados.eventoId);
      if (!missao) return null;

      // A chave tem que ser a que emitimos para este evento. Sem esta
      // conferência, um cliente adulterado registraria um arquivo alheio.
      if (!dados.chave.startsWith(`${missao}/${dados.eventoId}/`)) return null;

      await tx.insert(eventoDocumentos).values({
        eventoId: dados.eventoId,
        nome: dados.nome.slice(0, 200),
        chaveArmazenamento: dados.chave,
        tipoMime: dados.tipoMime,
        tamanhoBytes: dados.tamanhoBytes,
      });

      return missao;
    });

    if (!missaoId) return falha("Não foi possível registrar o documento.");

    revalidar(dados.eventoId, missaoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}

/** URL temporária de download. O bucket é privado: conhecer a chave não basta. */
export async function urlDoDocumento(documentoId: string) {
  try {
    const documento = await comUsuario(async (tx) => {
      const [linha] = await tx
        .select({
          nome: eventoDocumentos.nome,
          chave: eventoDocumentos.chaveArmazenamento,
        })
        .from(eventoDocumentos)
        .where(eq(eventoDocumentos.id, documentoId))
        .limit(1);
      return linha ?? null;
    });

    if (!documento) return falha("Documento não encontrado.");

    const url = await urlDeDownload(documento.chave, documento.nome);
    return sucesso({ url });
  } catch (erro) {
    console.error("Falha ao gerar download:", erro);
    return falha("Não foi possível gerar o link de download.");
  }
}

export async function excluirDocumento(documentoId: string) {
  try {
    const removido = await comUsuario(async (tx) => {
      const [linha] = await tx
        .delete(eventoDocumentos)
        .where(eq(eventoDocumentos.id, documentoId))
        .returning({
          eventoId: eventoDocumentos.eventoId,
          chave: eventoDocumentos.chaveArmazenamento,
        });
      return linha ?? null;
    });

    if (!removido) return falha("Documento não encontrado.");

    await removerObjeto(removido.chave).catch((erro) =>
      console.error("Documento órfão no R2:", removido.chave, erro),
    );

    revalidar(removido.eventoId);
    return sucesso();
  } catch (erro) {
    return falha(traduzirErroDeBanco(erro));
  }
}
