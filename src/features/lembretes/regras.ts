/**
 * Regras do lembrete bimestral de contagem — puras, sem banco e sem
 * `server-only`, para que a tela do grupo e a rotina do servidor decidam
 * "está vencido?" exatamente do mesmo jeito, e para que o teste as exercite
 * direto.
 */

/** O ritmo que as planilhas antigas já seguiam: uma contagem a cada bimestre. */
export const MESES_ENTRE_CONTAGENS = 2;

/**
 * Instante antes do qual uma contagem conta como vencida.
 *
 * Aritmética em UTC de propósito: isto compara instantes, não dias, então o
 * fuso não entra — e usar os métodos locais faria o resultado depender do
 * relógio da máquina, que em produção é UTC e no notebook é São Paulo.
 */
export function limiteDeContagem(agora: Date = new Date()) {
  const limite = new Date(agora.getTime());
  limite.setUTCMonth(limite.getUTCMonth() - MESES_ENTRE_CONTAGENS);
  return limite;
}

/**
 * Um grupo está com a contagem vencida quando a última foi feita há dois
 * meses ou mais. Sem contagem alguma — grupo que nunca passou por aqui — também
 * conta como vencido: é justamente quem mais precisa do lembrete.
 */
export function contagemVencida(
  ultimaContagemEm: string | Date | null,
  agora: Date = new Date(),
) {
  if (!ultimaContagemEm) return true;
  return new Date(ultimaContagemEm).getTime() <= limiteDeContagem(agora).getTime();
}

/**
 * Se o grupo já recebeu lembrete dentro do bimestre corrente, não recebe
 * outro: a rotina roda todo dia, e sem esta regra avisaria todo dia.
 */
export function lembreteRecente(
  ultimoLembreteEm: string | Date | null,
  agora: Date = new Date(),
) {
  if (!ultimoLembreteEm) return false;
  return new Date(ultimoLembreteEm).getTime() > limiteDeContagem(agora).getTime();
}

/** Para onde o lembrete leva: a aba de grupos da missão, com o diálogo de
 *  contagem do grupo já aberto. */
export function caminhoDaContagem(missaoId: string, grupoId: string) {
  return `/missoes/${missaoId}/grupos?grupo=${grupoId}`;
}

/** Vários grupos da mesma missão: a lista já recortada aos que estão vencidos. */
export function caminhoDosPendentes(missaoId: string) {
  return `/missoes/${missaoId}/grupos?contagem=pendente`;
}
