"use client";

import { ViewTransition } from "react";

/**
 * Faixa de 2px sob a aba ativa, que desliza de uma aba para a outra.
 *
 * As abas são rotas de verdade, cada uma com URL própria. O indicador que
 * viaja mostra que a pessoa se moveu *dentro* da mesma missão — sem ele, a
 * faixa some de um lugar e aparece em outro, e a troca lê como ter ido parar
 * em outro sistema.
 *
 * Feito com `<ViewTransition>` e não com `layoutId` da Motion: `layoutId` é
 * animação de layout e exigiria o conjunto `domMax`, que somado ao `m` daria
 * 35,8 kB — mais caro que importar a Motion inteira, para um efeito que o
 * navegador entrega de graça. Como a barra de navegação vive no layout, que
 * persiste entre as abas, o React só precisa reposicionar o mesmo nome.
 *
 * A faixa é a terceira pista, nunca a única: a cor do texto e o
 * `aria-current="page"` continuam no lugar, e é o que resta quando alguém
 * pede movimento reduzido e ela passa a teleportar.
 */
export function IndicadorAba({ nome }: { nome: string }) {
  /* `default="none"` impede a faixa de fazer crossfade próprio em toda
     transição da página; `share="morph"` precisa continuar explícito junto com
     ele, ou o par silenciosamente para de viajar e a faixa volta a piscar de
     um lugar para o outro. */
  return (
    <ViewTransition name={nome} share="morph" default="none">
      <span
        aria-hidden
        className="bg-primary absolute inset-x-0 -bottom-0.5 h-0.5"
      />
    </ViewTransition>
  );
}
