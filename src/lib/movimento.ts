/**
 * Tokens de movimento.
 *
 * Vivem em `src/lib/` porque são lidos por componentes de cliente. Os números
 * estão em segundos, que é a unidade da Motion; os equivalentes em CSS ficam
 * em `globals.css`, e os dois precisam contar a mesma história — um botão que
 * responde em 150ms e um cartão que chega em 600ms parecem dois sistemas.
 *
 * Não há mola com overshoot em lugar nenhum. O quique lê como brinquedo, e
 * quem usa isto está prestando contas de dinheiro de missão.
 */

export const DURACAO = {
  /** Sobreposições do Radix. Igual ao que o `tw-animate-css` já aplica. */
  sobreposicao: 0.1,
  /** Hover, foco, esmaecer enquanto pendente. */
  micro: 0.15,
  /**
   * Item que sai da lista. Sair é mais rápido que chegar de propósito: o que
   * já foi não deve competir por atenção com o que ficou.
   */
  saida: 0.16,
  /** Conteúdo que chega. Mesma cadência da barra de progresso. */
  chegada: 0.22,
} as const;

/*
 * Tipadas como tupla e não com `as const`: a Motion espera
 * `[number, number, number, number]` mutável, e a tupla readonly que o
 * `as const` produz não é atribuível.
 */
type Bezier = [number, number, number, number];

export const CURVA = {
  /** Desacelera no fim: o conteúdo chega e assenta. */
  chegada: [0.32, 0.72, 0, 1] as Bezier,
  /** Acelera no fim: o que sai, sai de vez, sem se despedir. */
  partida: [0.4, 0, 1, 1] as Bezier,
};

/** Intervalo entre itens de uma cascata. */
export const PASSO_LISTA = 0.035;

/**
 * Teto de itens que recebem atraso na cascata.
 *
 * Sem teto, uma tabela de relatório com 200 linhas levaria sete segundos para
 * terminar de aparecer: a cascata viraria lentidão, que é exatamente o oposto
 * do que ela comunica. Do nono item em diante, todos entram junto com o oitavo.
 */
export const TETO_ESCALONADO = 8;

/** Transição padrão, aplicada a toda a árvore pelo `MotionConfig`. */
export const TRANSICAO_PADRAO = {
  duration: DURACAO.chegada,
  ease: CURVA.chegada,
};
