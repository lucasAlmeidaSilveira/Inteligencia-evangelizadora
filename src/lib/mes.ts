/**
 * Mês como intervalo, numa definição só.
 *
 * Deixou de ser o vocabulário de recorte da aplicação — quem faz esse papel é
 * `lib/periodo.ts`, desde que o filtro passou a ser um intervalo livre. O que
 * sobrou aqui é a aritmética de mês, que continua tendo dois clientes reais:
 * o padrão do painel (que abre no mês corrente), o atalho "Último mês" e a
 * leitura dos links antigos, que ainda chegam com `?mes=2026-09`.
 *
 * Continua em `lib/` porque atravessa a fronteira: o servidor resolve o recorte
 * e o navegador monta os atalhos. Duas contas de "primeiro e último instante do
 * mês" acabariam discordando na virada — o cartão diria 7 ações e a tela de
 * destino mostraria 6, sem erro em lugar nenhum.
 */

/** Como o mês viajava na URL: `?mes=2026-09`. Ainda aceito na leitura. */
const CHAVE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function inicioDoMes(referencia = new Date()) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

/* Dia 0 do mês seguinte é o último dia deste — evita a tabela de 28/30/31 e
   fevereiro bissexto. Os milissegundos vão até 999 porque o limite é `<=`:
   parar em 23:59:59 deixaria de fora a ação marcada no último segundo. */
export function fimDoMes(referencia = new Date()) {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

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

function primeiroDia(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, 1);
}

/** Intervalo fechado do mês, pronto para os filtros `de` e `ate`. */
export function intervaloDoMes(chave: string) {
  const referencia = primeiroDia(chave);
  return { de: inicioDoMes(referencia), ate: fimDoMes(referencia) };
}
