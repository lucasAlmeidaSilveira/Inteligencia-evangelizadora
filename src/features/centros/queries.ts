import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, or } from "drizzle-orm";

import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { comUsuario } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  centrosEvangelizacao,
  missoes,
  type TipoCentro,
} from "@/server/db/schema";

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

export const listarCentros = leituraCacheada(
  "centros",
  async (tx, missaoId: string) => {
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
  },
  {
    etiquetas: ([missaoId]) => [ETIQUETAS.centrosDaMissao(missaoId)],
    revalidar: CINCO_MINUTOS,
  },
);

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
 * `incluirInativos` é do filtro da lista de grupos: sem ele, o nome de um
 * centro arquivado apareceria no cartão do grupo sem haver como filtrar por
 * ele. Passa como booleano, não dentro de um objeto de opções, porque é ele
 * que separa as duas entradas de cache.
 */
export const centrosParaSelecao = leituraCacheada(
  "centros-selecao",
  async (tx, missaoId: string, incluirInativos: boolean) => {
    return tx
      .select(colunasSelecao)
      .from(centrosEvangelizacao)
      .where(
        and(
          eq(centrosEvangelizacao.missaoId, missaoId),
          incluirInativos ? undefined : podeReceberVinculo,
        ),
      )
      .orderBy(...ordemDeSelecao);
  },
  {
    etiquetas: ([missaoId]) => [ETIQUETAS.centrosDaMissao(missaoId)],
    revalidar: CINCO_MINUTOS,
  },
);

/**
 * Centros de todas as missões visíveis, com a missão de cada um.
 *
 * O formulário de ação apostólica tem select de missão: precisa da lista
 * inteira em mãos para trocar as opções de centro sem uma ida ao servidor a
 * cada troca. O RLS já limita o que vem — o admin vê tudo, os demais só a sua.
 */
export const centrosDasMissoesVisiveis = cache(
  leituraCacheada(
    "centros-visiveis",
    async (tx) =>
      tx
        .select(colunasSelecao)
        .from(centrosEvangelizacao)
        .where(podeReceberVinculo)
        .orderBy(...ordemDeSelecao),
    // Atravessa missões: só a etiqueta geral alcança esta entrada.
    { etiquetas: () => [ETIQUETAS.centros], revalidar: CINCO_MINUTOS },
  ),
);

/* ─── Panorama: centros de todas as missões visíveis ─────────────────────────
 *
 * A tela /centros atravessa missões, e por isso a missão é um filtro dela — não
 * o foco da barra lateral. É a diferença para /eventos: lá o recorte veio junto
 * do painel e do calendário e vale para a navegação inteira; aqui a pergunta é
 * "onde estão os centros", e responder só pela missão em foco seria responder
 * outra pergunta.
 */

export type FiltrosCentros = { missaoId?: string; tipo?: TipoCentro };

const colunasPanorama = {
  id: centrosEvangelizacao.id,
  missaoId: centrosEvangelizacao.missaoId,
  missaoNome: missoes.nome,
  nome: centrosEvangelizacao.nome,
  tipo: centrosEvangelizacao.tipo,
  principal: centrosEvangelizacao.principal,
  cidade: centrosEvangelizacao.cidade,
  regiao: centrosEvangelizacao.regiao,
  contatoTelefone: centrosEvangelizacao.contatoTelefone,
  ativo: centrosEvangelizacao.ativo,
};

export const listarCentrosVisiveis = leituraCacheada(
  "centros-panorama",
  async (tx, filtros: FiltrosCentros) => {
    const centros = await tx
      .select(colunasPanorama)
      .from(centrosEvangelizacao)
      /* `innerJoin` e não busca à parte: o nome da missão muda quando ela é
         renomeada, e uma cópia guardada aqui ficaria velha em silêncio. */
      .innerJoin(missoes, eq(missoes.id, centrosEvangelizacao.missaoId))
      .where(
        and(
          filtros.missaoId
            ? eq(centrosEvangelizacao.missaoId, filtros.missaoId)
            : undefined,
          filtros.tipo ? eq(centrosEvangelizacao.tipo, filtros.tipo) : undefined,
        ),
      )
      // Agrupado por missão, e dentro dela o principal encabeça — a mesma
      // ordem da aba da missão, para quem vem de lá não se perder.
      .orderBy(
        asc(missoes.nome),
        desc(centrosEvangelizacao.principal),
        asc(centrosEvangelizacao.nome),
      );

    const vinculados = await vinculadosPorCentro(
      tx,
      centros.map((c) => c.id),
    );

    return centros.map((centro) => ({
      ...centro,
      ...(vinculados.get(centro.id) ?? SEM_VINCULOS),
    }));
  },
  {
    /* Três etiquetas porque o cartão mostra três coisas: o centro, quantos
       grupos pendem dele e quantas ações. Só `centros` deixaria a contagem de
       grupos velha por cinco minutos depois de cadastrar um. Atravessa missões,
       então só as etiquetas gerais alcançam esta entrada. */
    etiquetas: () => [ETIQUETAS.centros, ETIQUETAS.grupos, ETIQUETAS.eventos],
    revalidar: CINCO_MINUTOS,
  },
);

/** Centros para o select de filtro da tela de grupos, com a missão de cada um. */
export const centrosParaFiltro = cache(
  leituraCacheada(
    "centros-filtro",
    async (tx) =>
      tx
        .select({
          id: centrosEvangelizacao.id,
          missaoId: centrosEvangelizacao.missaoId,
          missaoNome: missoes.nome,
          nome: centrosEvangelizacao.nome,
          principal: centrosEvangelizacao.principal,
          ativo: centrosEvangelizacao.ativo,
        })
        .from(centrosEvangelizacao)
        .innerJoin(missoes, eq(missoes.id, centrosEvangelizacao.missaoId))
        .orderBy(...ordemDeSelecao),
    { etiquetas: () => [ETIQUETAS.centros], revalidar: CINCO_MINUTOS },
  ),
);

export type CentroListado = Awaited<ReturnType<typeof listarCentros>>[number];
export type CentroVisivel = Awaited<
  ReturnType<typeof listarCentrosVisiveis>
>[number];
export type CentroParaFiltro = Awaited<
  ReturnType<typeof centrosParaFiltro>
>[number];
export type CentroParaSelecao = Awaited<
  ReturnType<typeof centrosParaSelecao>
>[number];
