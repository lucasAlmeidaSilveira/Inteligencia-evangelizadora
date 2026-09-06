import "server-only";

/**
 * Etiquetas de cache, num lugar só.
 *
 * Existem para que leitura e escrita não escrevam a mesma string por conta
 * própria: uma letra diferente entre `queries.ts` e `actions.ts` produz cache
 * que nunca invalida — a tela serve número velho para sempre, sem erro em
 * lugar nenhum. Com o registro aqui, o TypeScript recusa a divergência.
 *
 * O escopo do RLS **não** entra na etiqueta: ele já é parte da chave do cache
 * (ver `recorteDe` em `src/server/cache.ts`). Etiqueta responde "o que mudou",
 * chave responde "para quem". Misturar as duas coisas faria uma escrita na
 * missão A precisar invalidar, uma a uma, as entradas de todas as outras.
 */
export const ETIQUETAS = {
  /** Tipos de ação apostólica — cadastro do admin, lido por quase toda tela. */
  tipos: "tipos-evento",
  /** Categorias financeiras — idem. */
  categorias: "categorias",

  /** Qualquer lista de missões: seletor de foco, cartões, selects. */
  missoes: "missoes",
  /** Uma missão e seus indicadores. */
  missao: (id: string) => `missao:${id}`,

  /*
   * Centros e grupos têm duas etiquetas cada: uma por missão e uma geral.
   *
   * A geral existe porque nem toda leitura é por missão — o painel soma os
   * centros de todas, e o formulário de ação carrega os de todas as missões
   * visíveis para trocar as opções sem ida ao servidor. Essas entradas não
   * seriam alcançadas por `centros:<missao>`, e continuariam servindo a
   * contagem anterior. Toda escrita invalida as duas.
   */
  centros: "centros",
  centrosDaMissao: (missaoId: string) => `centros:${missaoId}`,
  grupos: "grupos",
  gruposDaMissao: (missaoId: string) => `grupos:${missaoId}`,

  /** Listagens de ações apostólicas. */
  eventos: "eventos",
  /** Uma ação e o que pende dela: lançamentos, documentos, links. */
  evento: (id: string) => `evento:${id}`,

  /**
   * Os totais do painel.
   *
   * Etiqueta própria porque o painel soma quatro domínios ao mesmo tempo —
   * missões, centros, grupos e ações. Sem ela, cada action precisaria saber
   * que existe um painel; com ela, basta acrescentar `painel` à lista.
   */
  painel: "painel",
} as const;
