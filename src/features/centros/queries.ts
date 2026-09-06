import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, or } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import { centrosEvangelizacao } from "@/server/db/schema";

import { SEM_VINCULOS, vinculadosPorCentro } from "./vinculados";

export type { Vinculados } from "./vinculados";

const colunas = {
  id: centrosEvangelizacao.id,
  missaoId: centrosEvangelizacao.missaoId,
  nome: centrosEvangelizacao.nome,
  tipo: centrosEvangelizacao.tipo,
  principal: centrosEvangelizacao.principal,
  cidade: centrosEvangelizacao.cidade,
  regiao: centrosEvangelizacao.regiao,
  endereco: centrosEvangelizacao.endereco,
  dataFundacao: centrosEvangelizacao.dataFundacao,
  contatoTelefone: centrosEvangelizacao.contatoTelefone,
  observacoes: centrosEvangelizacao.observacoes,
  ativo: centrosEvangelizacao.ativo,
};

export async function listarCentros(missaoId: string) {
  return comUsuario(async (tx) => {
    const centros = await tx
      .select(colunas)
      .from(centrosEvangelizacao)
      .where(eq(centrosEvangelizacao.missaoId, missaoId))
      // O principal encabeça a lista: é o centro que a missão sempre tem, e o
      // destino de tudo que não foi separado em outra frente.
      .orderBy(desc(centrosEvangelizacao.principal), asc(centrosEvangelizacao.nome));

    const vinculados = await vinculadosPorCentro(
      tx,
      centros.map((c) => c.id),
    );

    return centros.map((centro) => ({
      ...centro,
      ...(vinculados.get(centro.id) ?? SEM_VINCULOS),
    }));
  });
}

export const obterCentro = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [centro] = await tx
      .select(colunas)
      .from(centrosEvangelizacao)
      .where(eq(centrosEvangelizacao.id, id))
      .limit(1);

    // RLS já filtrou: se não veio nada, ou não existe ou não é do usuário —
    // e a distinção não deve vazar para quem perguntou.
    return centro ?? null;
  });
});

const colunasSelecao = {
  id: centrosEvangelizacao.id,
  missaoId: centrosEvangelizacao.missaoId,
  nome: centrosEvangelizacao.nome,
  tipo: centrosEvangelizacao.tipo,
  principal: centrosEvangelizacao.principal,
  ativo: centrosEvangelizacao.ativo,
};

/**
 * Quem pode receber vínculo novo: os ativos, **mais o principal sempre**.
 *
 * O principal entra mesmo arquivado porque `centro_id` é obrigatório — uma
 * lista vazia deixaria o formulário sem nada a escolher e sem como salvar. Ele
 * é o centro que a missão sempre tem; arquivá-lo tira das contagens, não da
 * estrutura.
 */
const podeReceberVinculo = or(
  eq(centrosEvangelizacao.ativo, true),
  eq(centrosEvangelizacao.principal, true),
);

/** O principal primeiro: é o padrão do formulário e a primeira opção da lista. */
const ordemDeSelecao = [
  desc(centrosEvangelizacao.principal),
  asc(centrosEvangelizacao.nome),
];

/**
 * Centros de uma missão, para os selects de grupos e ações.
 *
 * Por padrão só quem pode receber vínculo novo. O `incluirInativos` é do
 * filtro da lista de grupos: sem ele, o nome de um centro arquivado apareceria
 * no cartão do grupo sem haver como filtrar por ele.
 */
export async function centrosParaSelecao(
  missaoId: string,
  opcoes: { incluirInativos?: boolean } = {},
) {
  return comUsuario(async (tx) => {
    return tx
      .select(colunasSelecao)
      .from(centrosEvangelizacao)
      .where(
        and(
          eq(centrosEvangelizacao.missaoId, missaoId),
          opcoes.incluirInativos ? undefined : podeReceberVinculo,
        ),
      )
      .orderBy(...ordemDeSelecao);
  });
}

/**
 * Centros de todas as missões visíveis, com a missão de cada um.
 *
 * O formulário de ação apostólica tem select de missão: precisa da lista
 * inteira em mãos para trocar as opções de centro sem uma ida ao servidor a
 * cada troca. O RLS já limita o que vem — o admin vê tudo, os demais só a sua.
 */
export async function centrosDasMissoesVisiveis() {
  return comUsuario(async (tx) => {
    return tx
      .select(colunasSelecao)
      .from(centrosEvangelizacao)
      .where(podeReceberVinculo)
      .orderBy(...ordemDeSelecao);
  });
}

export type CentroListado = Awaited<ReturnType<typeof listarCentros>>[number];
export type CentroParaSelecao = Awaited<
  ReturnType<typeof centrosParaSelecao>
>[number];
