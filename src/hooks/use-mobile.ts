import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function assinar(aoMudar: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", aoMudar);
  return () => mql.removeEventListener("change", aoMudar);
}

/**
 * `useSyncExternalStore` é a primitiva certa para ler algo que vive fora do
 * React — aqui, o viewport. Ela lê o valor durante a renderização em vez de
 * gravar estado dentro de um efeito, o que eliminava um render extra a cada
 * montagem e a divergência de hidratação.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    assinar,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    // No servidor não existe viewport. Assumir desktop mantém o HTML inicial
    // igual ao da maioria dos acessos ao painel.
    () => false,
  );
}
