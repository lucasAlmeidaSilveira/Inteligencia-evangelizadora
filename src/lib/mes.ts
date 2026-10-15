import { diaNoFuso, instanteNoFuso } from "./fuso";

/**
 * Mês como intervalo, numa definição só.
 *
 * Deixou de ser o vocabulário de recorte da aplicação — quem faz esse papel é
 * `lib/periodo.ts`, desde que o filtro passou a ser um intervalo livre. O que
 * sobrou aqui é a aritmética de mês, que continua tendo clientes reais: o
 * padrão do painel (que abre no mês corrente), o atalho "Último mês", a grade
 * do calendário e a leitura dos links antigos, que ainda chegam com
 * `?mes=2026-09`.
 *
 * O mês viaja como chave (`"2026-09"`) e vira instante só na borda da consulta,
 * no relógio de São Paulo — ver `lib/fuso.ts`. Duas contas de "primeiro e
 * último instante do mês" acabariam discordando na virada: o cartão diria 7
 * ações e a tela de destino mostraria 6, sem erro em lugar nenhum.
 */

/** Como o mês viaja na URL: `?mes=2026-09`. Ainda aceito na leitura. */
const CHAVE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Lê `?mes=` da URL, que qualquer um edita.
 *
 * O que não é mês possível vira `undefined`, e quem chama decide o padrão. Sem
 * isto, um "2026-13" viraria `Invalid Date` numa comparação com coluna
 * `timestamp`.
 */
export function lerChaveDeMes(valor: unknown) {
  return typeof valor === "string" && CHAVE.test(valor) ? valor : undefined;
}

/** O mês de um instante, em São Paulo: `"2026-09"`. */
export function mesNoFuso(instante: string | Date) {
  return diaNoFuso(instante).slice(0, 7);
}

/** O primeiro instante do mês em São Paulo. */
export function inicioDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return instanteNoFuso(ano, mes, 1);
}

/* Dia 0 do mês seguinte é o último dia deste — evita a tabela de 28/30/31 e
   fevereiro bissexto. Os milissegundos vão até 999 porque o limite é `<=`:
   parar em 23:59:59 deixaria de fora a ação marcada no último segundo. */
export function fimDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return instanteNoFuso(ano, mes + 1, 0, 23, 59, 59, 999);
}

/** Intervalo fechado do mês, pronto para os filtros `de` e `ate`. */
export function intervaloDoMes(chave: string) {
  return { de: inicioDoMes(chave), ate: fimDoMes(chave) };
}

/** O último dia do mês, como chave: `"2026-09-30"`. */
export function ultimoDiaDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  const dia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${chave}-${String(dia).padStart(2, "0")}`;
}

/** O mês `quantos` meses depois (ou antes, se negativo), de chave para chave.
 *  Em UTC porque é conta de calendário: o resultado não pode depender do fuso
 *  do servidor que a faz. */
export function deslocarMes(chave: string, quantos: number) {
  const [ano, mes] = chave.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + quantos, 1));
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}`;
}
