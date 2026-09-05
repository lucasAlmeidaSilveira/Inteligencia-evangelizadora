import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import type { Transacao } from "@/server/db/index";
import {
  categoriasFinanceiras,
  eventoDocumentos,
  eventoLancamentos,
  eventoLinks,
  eventos,
  missoes,
  tiposEvento,
} from "@/server/db/schema";

import {
  calcularFinanceiro,
  SEM_MOVIMENTO,
  somarLancamentos,
  type Financeiro,
} from "./financeiro";

/**
 * Totais financeiros de vários eventos numa consulta agregada.
 *
 * Uma única tabela no FROM, de propósito: subconsulta correlacionada escrita
 * em `sql` bruto referencia a tabela externa sem qualificar o schema, e o
 * Postgres resolve o nome para a coluna homônima da tabela interna — a
 * comparação nunca é verdadeira e os totais voltam zerados em silêncio.
 */
async function financeiroPorEvento(tx: Transacao, eventoIds: string[]) {
  const mapa = new Map<string, Financeiro>();
  if (eventoIds.length === 0) return mapa;

  const linhas = await tx
    .select({
      eventoId: eventoLancamentos.eventoId,
      receitas: sql<string>`coalesce(sum(valor) filter (where tipo = 'receita'), 0)`,
      despesas: sql<string>`coalesce(sum(valor) filter (where tipo = 'despesa'), 0)`,
    })
    .from(eventoLancamentos)
    .where(inArray(eventoLancamentos.eventoId, eventoIds))
    .groupBy(eventoLancamentos.eventoId);

  for (const linha of linhas) {
    mapa.set(linha.eventoId, calcularFinanceiro(linha.receitas, linha.despesas));
  }
  return mapa;
}

export type FiltrosEvento = {
  missaoId?: string;
  tipoEventoId?: string;
  status?: "planejado" | "em_andamento" | "realizado" | "cancelado";
  de?: Date;
  ate?: Date;
};

const colunas = {
  id: eventos.id,
  missaoId: eventos.missaoId,
  missaoNome: missoes.nome,
  tipoEventoId: eventos.tipoEventoId,
  tipoNome: tiposEvento.nome,
  tipoCor: tiposEvento.cor,
  titulo: eventos.titulo,
  dataInicio: eventos.dataInicio,
  dataFim: eventos.dataFim,
  local: eventos.local,
  participantesTotal: eventos.participantesTotal,
  servosEngajados: eventos.servosEngajados,
  status: eventos.status,
};

export async function listarEventos(filtros: FiltrosEvento = {}) {
  return comUsuario(async (tx) => {
    const condicoes = [
      filtros.missaoId ? eq(eventos.missaoId, filtros.missaoId) : undefined,
      filtros.tipoEventoId
        ? eq(eventos.tipoEventoId, filtros.tipoEventoId)
        : undefined,
      filtros.status ? eq(eventos.status, filtros.status) : undefined,
      // Um evento entra no período se qualquer parte dele o intersecta.
      filtros.ate ? lte(eventos.dataInicio, filtros.ate) : undefined,
      filtros.de ? gte(eventos.dataFim, filtros.de) : undefined,
    ].filter(Boolean);

    const lista = await tx
      .select(colunas)
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(condicoes.length ? and(...condicoes) : undefined)
      .orderBy(desc(eventos.dataInicio));

    const financeiro = await financeiroPorEvento(
      tx,
      lista.map((e) => e.id),
    );

    return lista.map((evento) => ({
      ...evento,
      financeiro: financeiro.get(evento.id) ?? SEM_MOVIMENTO,
    }));
  });
}

export const obterEvento = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [evento] = await tx
      .select({
        ...colunas,
        descricao: eventos.descricao,
        observacoes: eventos.observacoes,
        endereco: eventos.endereco,
        criadoEm: eventos.criadoEm,
        atualizadoEm: eventos.atualizadoEm,
      })
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(eq(eventos.id, id))
      .limit(1);

    if (!evento) return null;

    const financeiro = await financeiroPorEvento(tx, [evento.id]);
    return { ...evento, financeiro: financeiro.get(evento.id) ?? SEM_MOVIMENTO };
  });
});

export async function listarLancamentos(eventoId: string) {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: eventoLancamentos.id,
        tipo: eventoLancamentos.tipo,
        categoriaId: eventoLancamentos.categoriaId,
        categoriaNome: categoriasFinanceiras.nome,
        descricao: eventoLancamentos.descricao,
        valor: eventoLancamentos.valor,
        data: eventoLancamentos.data,
      })
      .from(eventoLancamentos)
      .leftJoin(
        categoriasFinanceiras,
        eq(categoriasFinanceiras.id, eventoLancamentos.categoriaId),
      )
      .where(eq(eventoLancamentos.eventoId, eventoId))
      .orderBy(desc(eventoLancamentos.data), asc(eventoLancamentos.descricao)),
  );
}

export async function listarDocumentos(eventoId: string) {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: eventoDocumentos.id,
        nome: eventoDocumentos.nome,
        tipoMime: eventoDocumentos.tipoMime,
        tamanhoBytes: eventoDocumentos.tamanhoBytes,
        criadoEm: eventoDocumentos.criadoEm,
      })
      .from(eventoDocumentos)
      .where(eq(eventoDocumentos.eventoId, eventoId))
      .orderBy(desc(eventoDocumentos.criadoEm)),
  );
}

export async function listarLinks(eventoId: string) {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: eventoLinks.id,
        titulo: eventoLinks.titulo,
        url: eventoLinks.url,
        descricao: eventoLinks.descricao,
      })
      .from(eventoLinks)
      .where(eq(eventoLinks.eventoId, eventoId))
      .orderBy(asc(eventoLinks.ordem), asc(eventoLinks.titulo)),
  );
}

/* ─── Listas para os formulários ─────────────────────────────────────────── */

export async function listarTiposEvento() {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: tiposEvento.id,
        nome: tiposEvento.nome,
        cor: tiposEvento.cor,
      })
      .from(tiposEvento)
      .where(eq(tiposEvento.ativo, true))
      .orderBy(asc(tiposEvento.ordem), asc(tiposEvento.nome)),
  );
}

export async function listarCategorias() {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: categoriasFinanceiras.id,
        nome: categoriasFinanceiras.nome,
        tipo: categoriasFinanceiras.tipo,
      })
      .from(categoriasFinanceiras)
      .where(eq(categoriasFinanceiras.ativo, true))
      .orderBy(asc(categoriasFinanceiras.ordem), asc(categoriasFinanceiras.nome)),
  );
}

/** Missões que o usuário pode escolher ao criar uma ação — o RLS já limita. */
export async function missoesDisponiveis() {
  return comUsuario(async (tx) =>
    tx
      .select({ id: missoes.id, nome: missoes.nome })
      .from(missoes)
      .where(eq(missoes.ativo, true))
      .orderBy(asc(missoes.nome)),
  );
}

/**
 * Tudo que o detalhe de uma ação precisa, numa transação só.
 *
 * O layout já lê os três conjuntos para exibir as contagens nas abas, e cada
 * aba lê um deles. Buscando separado eram quatro transações — dezessete idas
 * a um banco que fica a 200 ms. Aqui são sete, e o `cache` do React faz o
 * layout e a aba dividirem o mesmo resultado.
 */
export const obterEventoCompleto = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [evento] = await tx
      .select({
        ...colunas,
        descricao: eventos.descricao,
        observacoes: eventos.observacoes,
        endereco: eventos.endereco,
        criadoEm: eventos.criadoEm,
        atualizadoEm: eventos.atualizadoEm,
      })
      .from(eventos)
      .innerJoin(missoes, eq(missoes.id, eventos.missaoId))
      .innerJoin(tiposEvento, eq(tiposEvento.id, eventos.tipoEventoId))
      .where(eq(eventos.id, id))
      .limit(1);

    if (!evento) return null;

    const lancamentos = await tx
      .select({
        id: eventoLancamentos.id,
        tipo: eventoLancamentos.tipo,
        categoriaId: eventoLancamentos.categoriaId,
        categoriaNome: categoriasFinanceiras.nome,
        descricao: eventoLancamentos.descricao,
        valor: eventoLancamentos.valor,
        data: eventoLancamentos.data,
      })
      .from(eventoLancamentos)
      .leftJoin(
        categoriasFinanceiras,
        eq(categoriasFinanceiras.id, eventoLancamentos.categoriaId),
      )
      .where(eq(eventoLancamentos.eventoId, id))
      .orderBy(desc(eventoLancamentos.data), asc(eventoLancamentos.descricao));

    const documentos = await tx
      .select({
        id: eventoDocumentos.id,
        nome: eventoDocumentos.nome,
        tipoMime: eventoDocumentos.tipoMime,
        tamanhoBytes: eventoDocumentos.tamanhoBytes,
        criadoEm: eventoDocumentos.criadoEm,
      })
      .from(eventoDocumentos)
      .where(eq(eventoDocumentos.eventoId, id))
      .orderBy(desc(eventoDocumentos.criadoEm));

    const links = await tx
      .select({
        id: eventoLinks.id,
        titulo: eventoLinks.titulo,
        url: eventoLinks.url,
        descricao: eventoLinks.descricao,
      })
      .from(eventoLinks)
      .where(eq(eventoLinks.eventoId, id))
      .orderBy(asc(eventoLinks.ordem), asc(eventoLinks.titulo));

    // Já temos os lançamentos: somar em memória evita mais uma ida ao banco.
    return {
      evento: { ...evento, financeiro: somarLancamentos(lancamentos) },
      lancamentos,
      documentos,
      links,
    };
  });
});

export type EventoCompleto = NonNullable<
  Awaited<ReturnType<typeof obterEventoCompleto>>
>;

export type EventoListado = Awaited<ReturnType<typeof listarEventos>>[number];
export type EventoDetalhe = NonNullable<Awaited<ReturnType<typeof obterEvento>>>;
export type Lancamento = Awaited<ReturnType<typeof listarLancamentos>>[number];
export type Documento = Awaited<ReturnType<typeof listarDocumentos>>[number];
export type LinkUtil = Awaited<ReturnType<typeof listarLinks>>[number];
export type TipoEvento = Awaited<ReturnType<typeof listarTiposEvento>>[number];
export type Categoria = Awaited<ReturnType<typeof listarCategorias>>[number];
