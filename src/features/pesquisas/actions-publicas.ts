"use server";

import { updateTag } from "next/cache";
import { sql } from "drizzle-orm";

import {
  camposComErro,
  erroDeBanco,
  falha,
  sucesso,
  traduzirErroDeBanco,
  type Resultado,
} from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  CaminhoPublicoOcupado,
  comPesquisaLimitada,
  limitarPublico,
  marcarTokenDesconhecido,
  tokenDesconhecido,
} from "@/server/pesquisa";

import { respostaSchema, tokenSchema } from "./schemas";

const MUITA_GENTE =
  "Muita gente respondendo agora. Aguarde um minuto e tente de novo.";

/**
 * A única Server Action do sistema sem usuário. Vive em arquivo próprio para
 * isso ficar visível: nada aqui passa por `comUsuario`, e tudo que entra é
 * tratado como hostil.
 *
 * Ordem de propósito — do mais barato ao mais caro: formato do token, zod,
 * honeypot, limite em memória, e só então o banco, dentro do semáforo. O
 * honeypot preenchido devolve sucesso sem gravar: um erro diria ao robô o que
 * o denunciou.
 *
 * Revalida **só** a etiqueta da ação respondida. Expirar as listas e o painel
 * a cada resposta, como fazem as ações do coordenador, seria deixar qualquer
 * visitante esvaziar o cache de todas as missões trinta vezes por minuto.
 * Lista, relatório e painel acompanham no prazo normal do cache.
 */
export async function responderPesquisa(
  token: unknown,
  entrada: unknown,
): Promise<Resultado> {
  const tokenValido = tokenSchema.safeParse(token);
  if (!tokenValido.success) {
    return falha("Pesquisa não encontrada. Confira o link.");
  }

  const validado = respostaSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira a nota e o comentário.", camposComErro(validado.error));
  }

  if (validado.data.confirmacao) return sucesso();

  if (tokenDesconhecido(tokenValido.data)) {
    return falha("Pesquisa não encontrada. Confira o link.");
  }
  if (!limitarPublico(tokenValido.data, "resposta")) return falha(MUITA_GENTE);

  try {
    const eventoId = await comPesquisaLimitada(tokenValido.data, async (tx) => {
      const { rows } = await tx.execute<{ evento_id: string }>(
        sql`select ie.responder_pesquisa(${validado.data.nota}, ${validado.data.comentario}) as evento_id`,
      );
      return rows[0]?.evento_id ?? null;
    });

    if (eventoId) updateTag(ETIQUETAS.evento(eventoId));
    return sucesso();
  } catch (erro) {
    if (erro instanceof CaminhoPublicoOcupado) return falha(MUITA_GENTE);

    const { code, constraint } = erroDeBanco(erro);
    if (constraint === "pesquisa_inexistente") {
      marcarTokenDesconhecido(tokenValido.data);
    }
    // Sem policy para este papel, qualquer toque direto em tabela cai em
    // 42501; para quem respondeu, isso é "não encontrada", não "sem permissão".
    if (code === "42501") {
      return falha("Pesquisa não encontrada. Confira o link.");
    }
    return falha(traduzirErroDeBanco(erro));
  }
}
