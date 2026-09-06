"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferência de movimento reduzido do sistema, reativa.
 *
 * O prefixo `use` é a única palavra em inglês aqui: não é vocabulário, é o
 * protocolo que o React e a regra `rules-of-hooks` exigem para reconhecer um
 * hook — `usarMovimentoReduzido` reprova no lint. O substantivo, que é o que
 * carrega domínio, continua em português. Mesmo critério do `use-mobile.ts`.
 *
 * A Motion traz `useReducedMotion()`, mas ele guarda a preferência num
 * `useState` e não volta a olhar — quem liga "Reduzir movimento" no meio da
 * sessão continua vendo animação até recarregar a página. Há um TODO no
 * próprio fonte reconhecendo a limitação. Ele também devolve `null` no
 * servidor, o que obrigaria a tratar divergência de hidratação em cada uso.
 *
 * `useSyncExternalStore` resolve os dois: o snapshot do servidor é explícito e
 * o React o usa durante a hidratação, e a assinatura mantém o valor em dia. É
 * o mesmo mecanismo que a barra de progresso já usa.
 *
 * Serve para o que o CSS não alcança: o Recharts, que anima por conta própria,
 * e chamadas imperativas. O `MotionConfig` cuida dos componentes da Motion.
 */

const CONSULTA = "(prefers-reduced-motion: reduce)";

function assinar(aoMudar: () => void) {
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener("change", aoMudar);
  return () => lista.removeEventListener("change", aoMudar);
}

const ler = () => window.matchMedia(CONSULTA).matches;

/* No servidor não há como saber. Supor "quer menos movimento" faria o HTML
   inicial divergir para a maioria dos visitantes; supomos o padrão e
   corrigimos na hidratação, que é justamente o que este hook sabe fazer sem
   disparar aviso de divergência. */
const lerNoServidor = () => false;

export function useMovimentoReduzido() {
  return useSyncExternalStore(assinar, ler, lerNoServidor);
}
