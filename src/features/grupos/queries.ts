import "server-only";

import { cache } from "react";
import { asc, eq } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import { gruposOracao } from "@/server/db/schema";

import { pastoresPorGrupo } from "./pastores";

export type { Pastor } from "./pastores";

const colunas = {
  id: gruposOracao.id,
  missaoId: gruposOracao.missaoId,
  nome: gruposOracao.nome,
  quantidadePessoas: gruposOracao.quantidadePessoas,
  diaSemana: gruposOracao.diaSemana,
  horario: gruposOracao.horario,
  local: gruposOracao.local,
  observacoes: gruposOracao.observacoes,
  ativo: gruposOracao.ativo,
};

export async function listarGrupos(missaoId: string) {
  return comUsuario(async (tx) => {
    const grupos = await tx
      .select(colunas)
      .from(gruposOracao)
      .where(eq(gruposOracao.missaoId, missaoId))
      .orderBy(asc(gruposOracao.nome));

    // Duas consultas no total, independentemente da quantidade de grupos.
    const pastores = await pastoresPorGrupo(
      tx,
      grupos.map((g) => g.id),
    );

    return grupos.map((grupo) => ({
      ...grupo,
      pastores: pastores.get(grupo.id) ?? [],
    }));
  });
}

export const obterGrupo = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [grupo] = await tx
      .select(colunas)
      .from(gruposOracao)
      .where(eq(gruposOracao.id, id))
      .limit(1);

    if (!grupo) return null;

    const pastores = await pastoresPorGrupo(tx, [grupo.id]);
    return { ...grupo, pastores: pastores.get(grupo.id) ?? [] };
  });
});

export type GrupoListado = Awaited<ReturnType<typeof listarGrupos>>[number];
