import { inicioDoMes, fimDoMes } from "@/lib/mes";
import { lerPeriodo, type Periodo } from "@/lib/periodo";

/**
 * O recorte de período do painel.
 *
 * Aqui a ausência do parâmetro **não** significa "sem filtro", ao contrário de
 * /eventos: o painel abre no mês corrente, que é a pergunta de quem entra uma
 * vez por mês para fechar o acompanhamento. Somar o histórico inteiro por
 * padrão daria um número grande que não responde a nada.
 *
 * Como o padrão é um recorte, "todo o período" precisa de um valor próprio na
 * URL — daí o `?periodo=tudo` que `lib/periodo.ts` entende. Sem ele não haveria
 * como pedir o acumulado: tirar os parâmetros traria o mês de volta.
 *
 * Vive fora de `queries.ts` porque atravessa a fronteira: a página lê no
 * servidor e o seletor de período escreve no navegador.
 */
export function lerPeriodoDoPainel(
  parametros: Record<string, string | string[] | undefined>,
): Periodo | undefined {
  const referencia = new Date();
  return lerPeriodo(parametros, {
    de: inicioDoMes(referencia),
    ate: fimDoMes(referencia),
  });
}
