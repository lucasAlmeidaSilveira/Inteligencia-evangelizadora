import "server-only";

import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";

import { lerFiltroDeCentro, SEM_CENTRO } from "@/features/centros/schemas";
import { comUsuario } from "@/server/dados";
import { centrosEvangelizacao, gruposOracao } from "@/server/db/schema";

import { pastoresPorGrupo } from "./pastores";

export type { Pastor } from "./pastores";

const colunas = {
  id: gruposOracao.id,
  missaoId: gruposOracao.missaoId,
  centroId: gruposOracao.centroId,
  /* Nome do centro pelo JOIN, não guardado aqui: o nome muda quando o centro é
     renomeado, e uma cópia ficaria desatualizada em silêncio. `leftJoin`
     porque o vínculo é opcional — sem ele o grupo sumiria da lista. */
  centroNome: centrosEvangelizacao.nome,
  centroTipo: centrosEvangelizacao.tipo,
  nome: gruposOracao.nome,
  quantidadePessoas: gruposOracao.quantidadePessoas,
  diaSemana: gruposOracao.diaSemana,
  horario: gruposOracao.horario,
  local: gruposOracao.local,
  observacoes: gruposOracao.observacoes,
  ativo: gruposOracao.ativo,
};

/**
 * Recorte do centro de evangelização.
 *
 * `SEM_CENTRO` não é "sem filtro": é o filtro dos grupos que pendem direto da
 * missão. Distinguir os dois importa porque, com o vínculo opcional, "nenhum
 * centro" é um conjunto de verdade — e é onde o coordenador vai procurar o que
 * ainda não organizou.
 */
export type FiltroGrupos = { centroId?: string };

/** Revalida aqui também: a consulta não confia em quem a chama ter validado. */
function condicaoDoCentro(centroId: string | undefined) {
  const valido = lerFiltroDeCentro(centroId);
  if (!valido) return undefined;
  return valido === SEM_CENTRO
    ? isNull(gruposOracao.centroId)
    : eq(gruposOracao.centroId, valido);
}

export async function listarGrupos(
  missaoId: string,
  filtros: FiltroGrupos = {},
) {
  return comUsuario(async (tx) => {
    const grupos = await tx
      .select(colunas)
      .from(gruposOracao)
      .leftJoin(
        centrosEvangelizacao,
        eq(centrosEvangelizacao.id, gruposOracao.centroId),
      )
      .where(
        and(
          eq(gruposOracao.missaoId, missaoId),
          condicaoDoCentro(filtros.centroId),
        ),
      )
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
      .leftJoin(
        centrosEvangelizacao,
        eq(centrosEvangelizacao.id, gruposOracao.centroId),
      )
      .where(eq(gruposOracao.id, id))
      .limit(1);

    if (!grupo) return null;

    const pastores = await pastoresPorGrupo(tx, [grupo.id]);
    return { ...grupo, pastores: pastores.get(grupo.id) ?? [] };
  });
});

export type GrupoListado = Awaited<ReturnType<typeof listarGrupos>>[number];
