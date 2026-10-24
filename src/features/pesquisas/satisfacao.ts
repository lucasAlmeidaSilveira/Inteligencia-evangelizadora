/**
 * O que se lê de uma pesquisa de satisfação: a média de 0 a 10 — a régua que
 * o coordenador já conhece — e, de apoio, como as notas se distribuem.
 *
 * Puro e sem banco: é a mesma conta para o card da ação, a lista, o relatório
 * e o índice de impacto. Duas contas dariam dois números.
 */

export type AgregadoRespostas = {
  quantidade: number;
  soma: number;
  /** Notas 9 e 10. */
  promotores: number;
  /** Notas de 0 a 6. */
  detratores: number;
  /** Quantas respostas em cada nota, índice 0 a 10. */
  distribuicao: number[];
};

export const SEM_RESPOSTAS: AgregadoRespostas = {
  quantidade: 0,
  soma: 0,
  promotores: 0,
  detratores: 0,
  distribuicao: Array<number>(11).fill(0),
};

export type FonteDaNota = "pesquisa" | "manual";

export type Satisfacao = {
  /** Nota efetiva de 0 a 10, com uma casa; `null` sem informação. */
  nota: number | null;
  /** De onde a nota veio. A pesquisa tem prioridade sobre a nota digitada. */
  fonte: FonteDaNota | null;
  respostas: number;
  promotores: number;
  detratores: number;
  distribuicao: number[];
};

/**
 * Uma casa, como o `numeric(3,1)` da nota manual: tela e índice leem a mesma
 * precisão venha a nota de onde vier.
 */
function umaCasa(valor: number) {
  return Math.round(valor * 10) / 10;
}

export function resumirSatisfacao(
  agregado: AgregadoRespostas | undefined,
  npsManual: string | number | null | undefined,
): Satisfacao {
  const respostas = agregado ?? SEM_RESPOSTAS;

  if (respostas.quantidade > 0) {
    return {
      nota: umaCasa(respostas.soma / respostas.quantidade),
      fonte: "pesquisa",
      respostas: respostas.quantidade,
      promotores: respostas.promotores,
      detratores: respostas.detratores,
      distribuicao: respostas.distribuicao,
    };
  }

  const manual =
    npsManual === null || npsManual === undefined || npsManual === ""
      ? null
      : Number(npsManual);

  return {
    nota: manual !== null && Number.isFinite(manual) ? umaCasa(manual) : null,
    fonte: manual !== null && Number.isFinite(manual) ? "manual" : null,
    respostas: 0,
    promotores: 0,
    detratores: 0,
    distribuicao: SEM_RESPOSTAS.distribuicao,
  };
}

/** Sem base, `null` — nunca 0%. Mesma regra de `variacaoPercentual`. */
export function percentual(parte: number, total: number) {
  if (total <= 0) return null;
  return (parte / total) * 100;
}

/**
 * "43% deram 9 ou 10 · 12% deram 6 ou menos". A leitura por faixas é a do
 * NPS, mas dita em notas, que é o que o coordenador viu no formulário.
 */
export function fraseDeLeitura(s: Satisfacao) {
  if (s.fonte !== "pesquisa" || s.respostas === 0) return null;
  const altas = Math.round(percentual(s.promotores, s.respostas) ?? 0);
  const baixas = Math.round(percentual(s.detratores, s.respostas) ?? 0);
  return `${altas}% deram 9 ou 10 · ${baixas}% deram 6 ou menos`;
}

/** "1 resposta" / "37 respostas". */
export function contarRespostas(n: number) {
  return `${n} ${n === 1 ? "resposta" : "respostas"}`;
}

/** Texto da fonte para a tela. */
export function descreverFonte(s: Satisfacao) {
  if (s.fonte === "pesquisa") return contarRespostas(s.respostas);
  if (s.fonte === "manual") return "informada manualmente";
  return "Sem pesquisa";
}
