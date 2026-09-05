export type Financeiro = {
  receitas: number;
  despesas: number;
  saldo: number;
};

export const SEM_MOVIMENTO: Financeiro = {
  receitas: 0,
  despesas: 0,
  saldo: 0,
};

/**
 * Dinheiro em centavos inteiros antes de qualquer conta.
 *
 * `0.1 + 0.2` dá `0.30000000000000004` em ponto flutuante. Num saldo de
 * prestação de contas isso vira centavo faltando no relatório, e ninguém
 * consegue explicar de onde veio. O Postgres devolve `numeric` como string
 * justamente para não perder precisão — a conta se faz em inteiros.
 */
export function paraCentavos(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export function calcularFinanceiro(
  receitas: string | number | null | undefined,
  despesas: string | number | null | undefined,
): Financeiro {
  const r = paraCentavos(receitas);
  const d = paraCentavos(despesas);
  return { receitas: r / 100, despesas: d / 100, saldo: (r - d) / 100 };
}

/** Soma uma lista de lançamentos já separados por tipo. */
export function somarLancamentos(
  lancamentos: { tipo: "receita" | "despesa"; valor: string }[],
): Financeiro {
  let receitas = 0;
  let despesas = 0;
  for (const l of lancamentos) {
    if (l.tipo === "receita") receitas += paraCentavos(l.valor);
    else despesas += paraCentavos(l.valor);
  }
  return {
    receitas: receitas / 100,
    despesas: despesas / 100,
    saldo: (receitas - despesas) / 100,
  };
}
