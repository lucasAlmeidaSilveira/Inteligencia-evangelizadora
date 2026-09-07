"use client";

import { SeletorPeriodo } from "@/components/padroes/seletor-periodo";

/**
 * O recorte de período do painel, na URL.
 *
 * É o mesmo `?de=`/`?ate=` de /eventos, de propósito: os cartões levam para lá
 * com o recorte aplicado, e um segundo vocabulário de período faria o painel
 * dizer um número e a tela de destino mostrar outro. A missão continua fora
 * daqui — quem a escolhe é o seletor da barra lateral, e um select de missão ao
 * lado deste daria duas verdades na tela.
 *
 * O recorte fica compartilhável e sobrevive ao recarregar e ao botão voltar,
 * ao contrário do foco de missão, que é do coordenador e mora em cookie.
 */
export function FiltrosPainel({
  periodo,
  hoje,
}: {
  periodo: { de: string; ate: string } | undefined;
  hoje: string;
}) {
  return (
    <SeletorPeriodo
      base="/"
      periodo={periodo}
      hoje={hoje}
      /* Aqui a URL limpa é o mês corrente, não o acumulado. Por isso "Todo o
         período" precisa se escrever na URL em vez de apenas apagar os
         parâmetros — o contrário do que /eventos faz. */
      permiteVazio
      vazioExplicito
      rotuloVazio="Todo o período"
      className="w-full sm:w-auto"
    />
  );
}
