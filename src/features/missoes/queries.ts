import "server-only";

import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";

import { comUsuario } from "@/server/dados";
import { missaoIndicadores, missoes } from "@/server/db/schema";

import { agregadosPorMissao, membrosDaMissao, ZERADO } from "./agregados";

export type { Agregados } from "./agregados";

export async function listarMissoes(opcoes?: { incluirInativas?: boolean }) {
  return comUsuario(async (tx) => {
    const base = tx
      .select({
        id: missoes.id,
        nome: missoes.nome,
        slug: missoes.slug,
        cidade: missoes.cidade,
        regiao: missoes.regiao,
        responsavelNome: missoes.responsavelNome,
        membrosTotal: missoes.membrosTotal,
        ativo: missoes.ativo,
      })
      .from(missoes)
      .orderBy(asc(missoes.nome));

    const lista = await (opcoes?.incluirInativas
      ? base
      : base.where(eq(missoes.ativo, true)));

    const agregados = await agregadosPorMissao(
      tx,
      lista.map((m) => m.id),
    );

    return lista.map((missao) => {
      const derivados = agregados.get(missao.id) ?? ZERADO;
      const membros = membrosDaMissao(
        missao.membrosTotal,
        derivados.pessoasEmGrupos,
      );
      return {
        ...missao,
        ...derivados,
        membrosExibidos: membros.valor,
        membrosEstimados: membros.estimado,
      };
    });
  });
}

/** `cache` dedupe a consulta: o layout e a página do detalhe pedem a mesma
 *  missão na mesma renderização, e o banco é consultado uma vez só. */
export const obterMissao = cache(async (id: string) => {
  return comUsuario(async (tx) => {
    const [missao] = await tx
      .select({
        id: missoes.id,
        nome: missoes.nome,
        slug: missoes.slug,
        cidade: missoes.cidade,
        regiao: missoes.regiao,
        endereco: missoes.endereco,
        dataFundacao: missoes.dataFundacao,
        responsavelNome: missoes.responsavelNome,
        contatoTelefone: missoes.contatoTelefone,
        contatoEmail: missoes.contatoEmail,
        membrosTotal: missoes.membrosTotal,
        observacoes: missoes.observacoes,
        ativo: missoes.ativo,
        atualizadoEm: missoes.atualizadoEm,
      })
      .from(missoes)
      .where(eq(missoes.id, id))
      .limit(1);

    // RLS já filtrou: se não veio nada, ou não existe ou não é do usuário —
    // e a distinção não deve vazar para quem perguntou.
    if (!missao) return null;

    const derivados =
      (await agregadosPorMissao(tx, [missao.id])).get(missao.id) ?? ZERADO;
    const membros = membrosDaMissao(
      missao.membrosTotal,
      derivados.pessoasEmGrupos,
    );
    return {
      ...missao,
      ...derivados,
      membrosExibidos: membros.valor,
      membrosEstimados: membros.estimado,
    };
  });
});

/** Série histórica para o gráfico de evolução. Pode vir vazia: o registro
 *  de competência é opcional por decisão de produto. */
export async function listarIndicadores(missaoId: string, limite = 24) {
  return comUsuario(async (tx) =>
    tx
      .select({
        competencia: missaoIndicadores.competencia,
        membrosTotal: missaoIndicadores.membrosTotal,
        gruposTotal: missaoIndicadores.gruposTotal,
        pessoasGruposTotal: missaoIndicadores.pessoasGruposTotal,
        observacao: missaoIndicadores.observacao,
      })
      .from(missaoIndicadores)
      .where(eq(missaoIndicadores.missaoId, missaoId))
      .orderBy(desc(missaoIndicadores.competencia))
      .limit(limite),
  );
}

export type MissaoListada = Awaited<ReturnType<typeof listarMissoes>>[number];
export type MissaoDetalhe = NonNullable<Awaited<ReturnType<typeof obterMissao>>>;
export type Indicador = Awaited<ReturnType<typeof listarIndicadores>>[number];
