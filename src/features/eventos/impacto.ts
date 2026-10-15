import { compararOrcamento, type Financeiro } from "./financeiro";
import { calcularParticipacao } from "./participacao";

/**
 * Índice de Impacto Evangelizador: uma nota de 0 a 100 por ação apostólica,
 * para o planejamento trienal comparar ações e orientar os CAPs.
 *
 * Quatro componentes, cada um também de 0 a 100, combinados por média
 * ponderada. Os pesos vivem aqui, num lugar só, e estão documentados em
 * `docs/regras-de-negocio.md` — mudar um exige mudar o outro.
 *
 * O que falta não vale zero. Uma ação sem pesquisa de satisfação não teve
 * satisfação nula: ela não tem a informação, e o índice sai calculado sobre o
 * que existe, marcado como parcial. Zerar o que falta puniria justamente a
 * ação antiga, cadastrada antes de o NPS existir, e inverteria o ranking.
 */
export const PESOS_DO_IMPACTO = {
  /** Permaneceram ÷ presentes: o fruto que a missão mede. O maior peso. */
  permanencia: 35,
  /** NPS × 10: o que os participantes disseram. */
  satisfacao: 25,
  /** Presentes ÷ inscritos, limitado a 100%: quem se comprometeu veio. */
  engajamento: 20,
  /** Prestação de contas: cobertura das despesas e respeito ao orçamento. */
  financeiro: 20,
} as const;

export type ComponenteDoImpacto = keyof typeof PESOS_DO_IMPACTO;

export const ROTULOS_DO_IMPACTO: Record<ComponenteDoImpacto, string> = {
  permanencia: "Permanência",
  satisfacao: "Satisfação",
  engajamento: "Engajamento",
  financeiro: "Financeiro",
};

export type Impacto = {
  /** 0 a 100. `null` quando nenhum componente tem informação. */
  indice: number | null;
  /** Cada componente de 0 a 100, ou `null` quando não há base para calculá-lo. */
  componentes: Record<ComponenteDoImpacto, number | null>;
  /** Componentes sem informação, na ordem de peso. Vazio é índice completo. */
  faltam: ComponenteDoImpacto[];
};

export const SEM_IMPACTO: Impacto = {
  indice: null,
  componentes: {
    permanencia: null,
    satisfacao: null,
    engajamento: null,
    financeiro: null,
  },
  faltam: ["permanencia", "satisfacao", "engajamento", "financeiro"],
};

export type EntradaDoImpacto = {
  participantesInscritos: number;
  participantesTotal: number;
  participantesNovos: number;
  participantesPermaneceram: number;
  /** Como volta do banco: string com uma casa, ou `null` sem pesquisa. */
  nps: string | number | null;
  orcamentoPrevisto: string | number | null;
  financeiro: Financeiro;
};

const limitar = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Prestação de contas em nota.
 *
 * Duas perguntas, e vale a pior resposta: as receitas cobriram as despesas?
 * E o gasto ficou dentro do que se orçou? Cobertura é receitas ÷ despesas
 * (100 quando não se gastou nada); aderência é 100 dentro do orçamento, e
 * perde um ponto por ponto percentual de estouro. Sem orçamento, só a
 * cobertura conta — não orçar não é estourar.
 *
 * Sem lançamento algum, `null`: a prestação de contas não foi feita, e isso é
 * ausência de informação, não equilíbrio.
 */
export function pontuarFinanceiro(
  financeiro: Financeiro,
  orcamentoPrevisto: string | number | null,
): number | null {
  const { receitas, despesas } = financeiro;
  if (receitas <= 0 && despesas <= 0) return null;

  const cobertura = despesas <= 0 ? 100 : limitar((receitas / despesas) * 100);

  const orcamento = compararOrcamento(orcamentoPrevisto, despesas);
  const aderencia =
    orcamento.percentual === null ? 100 : limitar(200 - orcamento.percentual);

  return Math.min(cobertura, aderencia);
}

export function calcularImpacto(evento: EntradaDoImpacto): Impacto {
  const participacao = calcularParticipacao(evento);

  const nps =
    evento.nps === null || evento.nps === "" ? null : Number(evento.nps);

  const componentes: Impacto["componentes"] = {
    permanencia:
      participacao.taxaPermanencia === null
        ? null
        : limitar(participacao.taxaPermanencia),
    satisfacao: nps === null || !Number.isFinite(nps) ? null : limitar(nps * 10),
    engajamento:
      participacao.taxaComparecimento === null
        ? null
        : limitar(participacao.taxaComparecimento),
    financeiro: pontuarFinanceiro(evento.financeiro, evento.orcamentoPrevisto),
  };

  let somaPesos = 0;
  let somaNotas = 0;
  const faltam: ComponenteDoImpacto[] = [];

  for (const nome of Object.keys(PESOS_DO_IMPACTO) as ComponenteDoImpacto[]) {
    const nota = componentes[nome];
    if (nota === null) {
      faltam.push(nome);
      continue;
    }
    somaPesos += PESOS_DO_IMPACTO[nome];
    somaNotas += nota * PESOS_DO_IMPACTO[nome];
  }

  return {
    // Pesos renormalizados sobre o que existe: é o que deixa o índice parcial
    // na mesma escala do completo, em vez de encolher conforme falta dado.
    indice: somaPesos > 0 ? somaNotas / somaPesos : null,
    componentes,
    faltam,
  };
}

/**
 * Média dos índices de várias ações, para o relatório.
 *
 * Só entram as que têm índice — a ação sem informação alguma não é uma ação
 * de impacto zero. O retorno diz sobre quantas a média foi feita, para a tela
 * não apresentar "72" sem dizer que é de 3 ações em 40.
 */
export function mediaDeImpacto(indices: (number | null)[]) {
  const validos = indices.filter((i): i is number => i !== null);
  return {
    media:
      validos.length > 0
        ? validos.reduce((s, i) => s + i, 0) / validos.length
        : null,
    comIndice: validos.length,
  };
}

/** Mesma lógica para o NPS: média das ações que tiveram pesquisa. */
export function mediaDeNps(notas: (string | number | null)[]) {
  const validas = notas
    .map((n) => (n === null || n === "" ? null : Number(n)))
    .filter((n): n is number => n !== null && Number.isFinite(n));
  return {
    media:
      validas.length > 0
        ? validas.reduce((s, n) => s + n, 0) / validas.length
        : null,
    comNps: validas.length,
  };
}

/** `null` vira travessão, como as taxas: a tela nunca inventa índice. */
export function formatarIndice(valor: number | null) {
  if (valor === null) return "—";
  return String(Math.round(valor));
}

/** Uma casa, com vírgula: "8,7". A nota de 10 sai "10", sem ",0". */
export function formatarNps(valor: string | number | null) {
  if (valor === null || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/**
 * Faixas para a leitura do índice. As fronteiras são as de leitura de NPS
 * (até 6 detrator, 7–8 neutro, 9–10 promotor) trazidas para a escala de 100,
 * porque é a régua que quem faz pesquisa de satisfação já conhece.
 */
export function faixaDoImpacto(indice: number | null) {
  if (indice === null) return null;
  if (indice >= 90) return { rotulo: "Alto", tom: "positivo" as const };
  if (indice >= 70) return { rotulo: "Médio", tom: "normal" as const };
  return { rotulo: "Baixo", tom: "negativo" as const };
}
