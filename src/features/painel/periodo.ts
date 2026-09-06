import { chaveDoMes, lerChaveDeMes } from "@/lib/mes";

/**
 * O recorte de período do painel.
 *
 * Aqui a ausência do parâmetro **não** significa "sem filtro", ao contrário de
 * /eventos: o painel abre no mês corrente, que é a pergunta de quem entra uma
 * vez por mês para fechar o acompanhamento. Somar o histórico inteiro por
 * padrão daria um número grande que não responde a nada.
 *
 * Como o padrão é um recorte, "todo o período" precisa de um valor próprio na
 * URL — daí `TODO_O_PERIODO`. Sem ele não haveria como pedir o acumulado: tirar
 * o parâmetro traria o mês de volta.
 *
 * Vive fora de `queries.ts` porque atravessa a fronteira: a página lê no
 * servidor e a barra de filtros monta as opções no navegador.
 */
export const TODO_O_PERIODO = "tudo";

/**
 * Lê `?mes=` da URL, que qualquer um edita.
 *
 * Devolve `undefined` para "todo o período" — é o que as consultas esperam
 * como ausência de recorte. O que não é mês possível cai no padrão em vez de
 * virar `Invalid Date` numa comparação com coluna `timestamp`.
 */
export function lerPeriodoDoPainel(valor: unknown) {
  if (valor === TODO_O_PERIODO) return undefined;
  return lerChaveDeMes(valor) ?? chaveDoMes();
}
