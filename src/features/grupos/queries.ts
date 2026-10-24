import "server-only";

import { cache } from "react";
import { and, asc, eq, sql } from "drizzle-orm";

import { lerFiltroDeCentro } from "@/features/centros/schemas";
import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { comUsuario } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import {
  centrosEvangelizacao,
  grupoContagens,
  gruposOracao,
  missoes,
} from "@/server/db/schema";

import { pastoresPorGrupo } from "./pastores";

export type { Pastor } from "./pastores";

const colunas = {
  id: gruposOracao.id,
  missaoId: gruposOracao.missaoId,
  centroId: gruposOracao.centroId,
  /* Nome do centro pelo JOIN, não guardado aqui: o nome muda quando o centro é
     renomeado, e uma cópia ficaria desatualizada em silêncio. `innerJoin`
     porque `centro_id` é obrigatório — o tipo sai `string`, e a tela não
     precisa tratar um nulo impossível. */
  centroNome: centrosEvangelizacao.nome,
  centroTipo: centrosEvangelizacao.tipo,
  nome: gruposOracao.nome,
  membrosEfetivos: gruposOracao.membrosEfetivos,
  membrosFlutuantes: gruposOracao.membrosFlutuantes,
  membrosEvadidos: gruposOracao.membrosEvadidos,
  /** Efetivos + flutuantes, calculado pelo banco. */
  quantidadePessoas: gruposOracao.quantidadePessoas,
  /**
   * Quando a contagem foi feita pela última vez, em ISO — é o que a tela usa
   * para dizer "atualizada há 3 meses" e marcar o grupo como pendente.
   *
   * Subconsulta correlacionada com as referências interpoladas, nunca
   * escritas como texto: é a interpolação que faz o Drizzle qualificar
   * `grupos_oracao.id`, e sem ela o Postgres resolveria o nome para a coluna
   * homônima de `grupo_contagens` — comparação sempre falsa, sem erro algum.
   * Nulo só para grupo sem histórico, o que a migration não deixa existir.
   */
  ultimaContagemEm: sql<string | null>`(
    select max(${grupoContagens.registradoEm})
      from ${grupoContagens}
     where ${grupoContagens.grupoId} = ${gruposOracao.id}
  )`.mapWith((valor) =>
    valor === null || valor === undefined
      ? null
      : valor instanceof Date
        ? valor.toISOString()
        : new Date(valor as string).toISOString(),
  ),
  diaSemana: gruposOracao.diaSemana,
  horario: gruposOracao.horario,
  local: gruposOracao.local,
  observacoes: gruposOracao.observacoes,
  ativo: gruposOracao.ativo,
};

/** Recorte por centro de evangelização. Ausente = todos os centros. */
export type FiltroGrupos = { centroId?: string };

/** Revalida aqui também: a consulta não confia em quem a chama ter validado. */
function condicaoDoCentro(centroId: string | undefined) {
  const valido = lerFiltroDeCentro(centroId);
  return valido ? eq(gruposOracao.centroId, valido) : undefined;
}

/* `filtros` é obrigatório, sem valor padrão: o que muda o resultado precisa
   aparecer na chamada, porque é o que compõe a chave do cache. Argumento
   omitido é filtro que alguém esquece de considerar ao invalidar. */
export const listarGrupos = leituraCacheada(
  "grupos",
  async (tx, missaoId: string, filtros: FiltroGrupos) => {
    const grupos = await tx
      .select(colunas)
      .from(gruposOracao)
      .innerJoin(
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
  },
  {
    etiquetas: ([missaoId]) => [ETIQUETAS.gruposDaMissao(missaoId)],
    revalidar: CINCO_MINUTOS,
  },
);

export const obterGrupo = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [grupo] = await tx
      .select(colunas)
      .from(gruposOracao)
      .innerJoin(
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

/* ─── Panorama: grupos de todas as missões visíveis ──────────────────────────
 *
 * Pelo mesmo motivo de `listarCentrosVisiveis`: a tela /grupos atravessa
 * missões, então a missão é filtro dela e não o foco da barra lateral.
 */

export type FiltrosGruposVisiveis = { missaoId?: string; centroId?: string };

export const listarGruposVisiveis = leituraCacheada(
  "grupos-panorama",
  async (tx, filtros: FiltrosGruposVisiveis) => {
    const grupos = await tx
      .select({ ...colunas, missaoNome: missoes.nome })
      .from(gruposOracao)
      .innerJoin(
        centrosEvangelizacao,
        eq(centrosEvangelizacao.id, gruposOracao.centroId),
      )
      .innerJoin(missoes, eq(missoes.id, gruposOracao.missaoId))
      .where(
        and(
          filtros.missaoId
            ? eq(gruposOracao.missaoId, filtros.missaoId)
            : undefined,
          condicaoDoCentro(filtros.centroId),
        ),
      )
      // Agrupado por missão e, dentro dela, pelo centro que reúne os grupos.
      .orderBy(
        asc(missoes.nome),
        asc(centrosEvangelizacao.nome),
        asc(gruposOracao.nome),
      );

    const pastores = await pastoresPorGrupo(
      tx,
      grupos.map((g) => g.id),
    );

    return grupos.map((grupo) => ({
      ...grupo,
      pastores: pastores.get(grupo.id) ?? [],
    }));
  },
  // Atravessa missões: só a etiqueta geral alcança esta entrada.
  { etiquetas: () => [ETIQUETAS.grupos], revalidar: CINCO_MINUTOS },
);

export type GrupoListado = Awaited<ReturnType<typeof listarGrupos>>[number];
export type GrupoVisivel = Awaited<
  ReturnType<typeof listarGruposVisiveis>
>[number];
