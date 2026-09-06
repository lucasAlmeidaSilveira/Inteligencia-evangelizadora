/**
 * O funil de uma ação apostólica: quem se inscreveu, quem veio, quem era novo
 * e quem continuou depois. As duas taxas são o que a missão de fato acompanha —
 * o número absoluto de presentes não diz se a ação deu fruto.
 */
export type Participacao = {
  inscritos: number;
  presentes: number;
  novos: number;
  permaneceram: number;
  /** Presentes ÷ inscritos. Pode passar de 100%: gente vem sem se inscrever. */
  taxaComparecimento: number | null;
  /** Permaneceram ÷ presentes. */
  taxaPermanencia: number | null;
};

export const SEM_PARTICIPACAO: Participacao = {
  inscritos: 0,
  presentes: 0,
  novos: 0,
  permaneceram: 0,
  taxaComparecimento: null,
  taxaPermanencia: null,
};

/**
 * Sem base, a taxa é `null` — nunca 0%.
 *
 * Mesmo princípio de `variacaoPercentual` em `lib/format`: uma ação onde
 * ninguém se inscreveu não teve 0% de comparecimento, ela não tem a informação.
 * Exibir "0%" faria o coordenador ler como fracasso o que é campo em branco.
 */
function taxa(parte: number, base: number) {
  if (base <= 0) return null;
  return (parte / base) * 100;
}

export function calcularParticipacao(evento: {
  participantesInscritos: number;
  participantesTotal: number;
  participantesNovos: number;
  participantesPermaneceram: number;
}): Participacao {
  const inscritos = evento.participantesInscritos;
  const presentes = evento.participantesTotal;

  return {
    inscritos,
    presentes,
    novos: evento.participantesNovos,
    permaneceram: evento.participantesPermaneceram,
    taxaComparecimento: taxa(presentes, inscritos),
    taxaPermanencia: taxa(evento.participantesPermaneceram, presentes),
  };
}

/** `null` vira travessão: a tela nunca mostra percentual inventado. */
export function formatarTaxa(valor: number | null) {
  if (valor === null) return "—";
  return `${Math.round(valor)}%`;
}
