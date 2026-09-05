import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import type { Transacao } from "@/server/db/index";
import {
  categoriasFinanceiras,
  eventoLancamentos,
  eventos,
  missoes,
  tiposEvento,
  usuarios,
} from "@/server/db/schema";

/** Quantos eventos usam cada tipo — para avisar antes de desativar ou excluir. */
async function usoDosTipos(tx: Transacao, ids: string[]) {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;

  const linhas = await tx
    .select({
      tipoEventoId: eventos.tipoEventoId,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(eventos)
    .where(inArray(eventos.tipoEventoId, ids))
    .groupBy(eventos.tipoEventoId);

  for (const linha of linhas) mapa.set(linha.tipoEventoId, linha.total);
  return mapa;
}

export async function listarTodosOsTipos() {
  return comUsuario(async (tx) => {
    const lista = await tx
      .select({
        id: tiposEvento.id,
        nome: tiposEvento.nome,
        cor: tiposEvento.cor,
        descricao: tiposEvento.descricao,
        ordem: tiposEvento.ordem,
        ativo: tiposEvento.ativo,
      })
      .from(tiposEvento)
      .orderBy(asc(tiposEvento.ordem), asc(tiposEvento.nome));

    const uso = await usoDosTipos(
      tx,
      lista.map((t) => t.id),
    );

    return lista.map((tipo) => ({ ...tipo, emUso: uso.get(tipo.id) ?? 0 }));
  });
}

export async function listarTodasAsCategorias() {
  return comUsuario(async (tx) => {
    const lista = await tx
      .select({
        id: categoriasFinanceiras.id,
        nome: categoriasFinanceiras.nome,
        tipo: categoriasFinanceiras.tipo,
        ordem: categoriasFinanceiras.ordem,
        ativo: categoriasFinanceiras.ativo,
      })
      .from(categoriasFinanceiras)
      .orderBy(asc(categoriasFinanceiras.ordem), asc(categoriasFinanceiras.nome));

    if (lista.length === 0) return [];

    const uso = await tx
      .select({
        categoriaId: eventoLancamentos.categoriaId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(eventoLancamentos)
      .where(
        inArray(
          eventoLancamentos.categoriaId,
          lista.map((c) => c.id),
        ),
      )
      .groupBy(eventoLancamentos.categoriaId);

    const mapa = new Map(uso.map((u) => [u.categoriaId, u.total]));
    return lista.map((c) => ({ ...c, emUso: mapa.get(c.id) ?? 0 }));
  });
}

/**
 * Quem tem acesso ao sistema.
 *
 * O recorte vem do RLS, não de um filtro escrito aqui: o admin master enxerga
 * todos; responsável e auxiliar enxergam a si mesmos e os colegas da própria
 * missão. Não há `where` de missão nesta consulta de propósito — esquecer um
 * filtro é justamente a classe de erro que o RLS existe para tornar impossível.
 */
export async function listarUsuarios() {
  return comUsuario(async (tx) =>
    tx
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        papel: usuarios.papel,
        ativo: usuarios.ativo,
        ultimoAcessoEm: usuarios.ultimoAcessoEm,
        criadoEm: usuarios.criadoEm,
        missaoId: usuarios.missaoId,
        missaoNome: missoes.nome,
      })
      .from(usuarios)
      .leftJoin(missoes, eq(missoes.id, usuarios.missaoId))
      .orderBy(asc(usuarios.nome)),
  );
}

export async function listarMissoesParaVinculo() {
  return comUsuario(async (tx) =>
    tx
      .select({ id: missoes.id, nome: missoes.nome, ativo: missoes.ativo })
      .from(missoes)
      .orderBy(asc(missoes.nome)),
  );
}

export type TipoConfig = Awaited<ReturnType<typeof listarTodosOsTipos>>[number];
export type CategoriaConfig = Awaited<
  ReturnType<typeof listarTodasAsCategorias>
>[number];
export type UsuarioConfig = Awaited<ReturnType<typeof listarUsuarios>>[number];
export type MissaoVinculo = Awaited<
  ReturnType<typeof listarMissoesParaVinculo>
>[number];
