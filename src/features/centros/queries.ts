import "server-only";

import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import { centrosEvangelizacao } from "@/server/db/schema";

import { SEM_VINCULOS, vinculadosPorCentro } from "./vinculados";

export type { Vinculados } from "./vinculados";

const colunas = {
  id: centrosEvangelizacao.id,
  missaoId: centrosEvangelizacao.missaoId,
  nome: centrosEvangelizacao.nome,
  tipo: centrosEvangelizacao.tipo,
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
      .orderBy(asc(centrosEvangelizacao.nome));

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

/**
 * Centros de uma missão, para os selects de grupos e ações.
 *
 * Por padrão só os ativos: um centro arquivado não deve receber vínculo novo.
 * Quem já aponta para ele continua apontando — daí o `incluirInativos`, que o
 * filtro da lista de grupos usa. Sem ele, o nome do centro apareceria no
 * cartão do grupo sem haver como filtrar por ele.
 */
export async function centrosParaSelecao(
  missaoId: string,
  opcoes: { incluirInativos?: boolean } = {},
) {
  return comUsuario(async (tx) => {
    return tx
      .select({
        id: centrosEvangelizacao.id,
        missaoId: centrosEvangelizacao.missaoId,
        nome: centrosEvangelizacao.nome,
        tipo: centrosEvangelizacao.tipo,
        ativo: centrosEvangelizacao.ativo,
      })
      .from(centrosEvangelizacao)
      .where(
        and(
          eq(centrosEvangelizacao.missaoId, missaoId),
          opcoes.incluirInativos
            ? undefined
            : eq(centrosEvangelizacao.ativo, true),
        ),
      )
      .orderBy(asc(centrosEvangelizacao.nome));
  });
}

/**
 * Todos os centros ativos que o usuário enxerga, com a missão de cada um.
 *
 * O formulário de ação apostólica tem select de missão: precisa da lista
 * inteira em mãos para trocar as opções de centro sem uma ida ao servidor a
 * cada troca. O RLS já limita o que vem — o admin vê tudo, os demais só a sua.
 */
export async function centrosDasMissoesVisiveis() {
  return comUsuario(async (tx) => {
    return tx
      .select({
        id: centrosEvangelizacao.id,
        missaoId: centrosEvangelizacao.missaoId,
        nome: centrosEvangelizacao.nome,
        tipo: centrosEvangelizacao.tipo,
        ativo: centrosEvangelizacao.ativo,
      })
      .from(centrosEvangelizacao)
      .where(eq(centrosEvangelizacao.ativo, true))
      .orderBy(asc(centrosEvangelizacao.nome));
  });
}

export type CentroListado = Awaited<ReturnType<typeof listarCentros>>[number];
export type CentroParaSelecao = Awaited<
  ReturnType<typeof centrosParaSelecao>
>[number];
