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
  /** Quantas respostas trouxeram comentário — o que a aba lista. */
  comentarios: number;
  /** Quantas respostas em cada nota, índice 0 a 10. */
  distribuicao: number[];
};

export const SEM_RESPOSTAS: AgregadoRespostas = {
  quantidade: 0,
  soma: 0,
  promotores: 0,
  detratores: 0,
  comentarios: 0,
  distribuicao: Array<number>(11).fill(0),
};

/**
 * As três faixas de leitura, num lugar só: a distribuição do card, o filtro
 * da lista de comentários e a frase "X% deram 9 ou 10" falam das mesmas
 * fronteiras, e duas cópias divergiriam na primeira mudança.
 */
export const FAIXAS_DE_NOTA = [
  { valor: "0-6", rotulo: "0 a 6", de: 0, ate: 6 },
  { valor: "7-8", rotulo: "7 e 8", de: 7, ate: 8 },
  { valor: "9-10", rotulo: "9 e 10", de: 9, ate: 10 },
] as const;

export type FaixaDeNota = (typeof FAIXAS_DE_NOTA)[number]["valor"];

export type FonteDaNota = "pesquisa" | "manual";

export type Satisfacao = {
  /** Nota efetiva de 0 a 10, com uma casa; `null` sem informação. */
  nota: number | null;
  /** De onde a nota veio. A pesquisa tem prioridade sobre a nota digitada. */
  fonte: FonteDaNota | null;
  respostas: number;
  promotores: number;
  detratores: number;
  comentarios: number;
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
      comentarios: respostas.comentarios,
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
    comentarios: 0,
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

/**
 * "12 comentários em 40 respostas". Os dois números juntos de propósito:
 * "40 respostas" sozinho, em cima de uma lista de comentários, faria parecer
 * que 35 sumiram — a maioria das pessoas só marca a nota.
 */
export function contarComentarios(s: Pick<Satisfacao, "respostas" | "comentarios">) {
  if (s.respostas === 0) return "Nenhuma resposta ainda";
  const respostas = contarRespostas(s.respostas);
  if (s.comentarios === 0) return `Nenhum comentário em ${respostas}`;
  const comentarios = `${s.comentarios} ${s.comentarios === 1 ? "comentário" : "comentários"}`;
  return `${comentarios} em ${respostas}`;
}

/** Texto da fonte para a tela. */
export function descreverFonte(s: Satisfacao) {
  if (s.fonte === "pesquisa") return contarRespostas(s.respostas);
  if (s.fonte === "manual") return "informada manualmente";
  return "Sem pesquisa";
}
