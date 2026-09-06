import "server-only";

import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";

import { lerFiltroDeCentro } from "@/features/centros/schemas";
import { CINCO_MINUTOS, leituraCacheada } from "@/server/cache";
import { comUsuario } from "@/server/dados";
import { ETIQUETAS } from "@/server/etiquetas";
import { centrosEvangelizacao, gruposOracao } from "@/server/db/schema";

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
  quantidadePessoas: gruposOracao.quantidadePessoas,
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

export type GrupoListado = Awaited<ReturnType<typeof listarGrupos>>[number];
