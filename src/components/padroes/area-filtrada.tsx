"use client";

import { createContext, use, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Filtro que escreve na URL, com retorno visível enquanto o servidor responde.
 *
 * Sem isto, trocar um filtro não muda nada na tela até a resposta chegar:
 * `router.push` fora de uma transição não expõe pendência, e a barra de 2px no
 * topo fica fora do campo de visão de quem está no meio de uma lista longa.
 * Quem escolheu fica sem saber se o sistema ouviu, e escolhe de novo.
 *
 * O contexto existe porque quem dispara (o seletor) e quem responde (a lista)
 * são irmãos, não pai e filho. A lista continua sendo renderizada no servidor:
 * ela chega aqui como `children` e nunca entra no pacote do navegador.
 */

const Contexto = createContext<{
  pendente: boolean;
  aplicar: (url: string) => void;
} | null>(null);

export function useFiltro() {
  const valor = use(Contexto);
  if (!valor) {
    throw new Error("useFiltro precisa estar dentro de <AreaFiltrada>.");
  }
  return valor;
}

export function AreaFiltrada({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <Contexto
      value={{ pendente, aplicar: (url) => iniciar(() => router.push(url)) }}
    >
      <div className={className}>{children}</div>
    </Contexto>
  );
}

/** Região que esmaece enquanto o novo recorte não chega. */
export function ResultadosFiltrados({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pendente } = useFiltro();

  return (
    <div
      /* O esmaecimento é sinal visual; `aria-busy` é o mesmo sinal para quem
         usa leitor de tela. Cor — ou opacidade — nunca sozinha. */
      aria-busy={pendente || undefined}
      className={cn(
        "transition-opacity duration-150 ease-out",
        /* 0,55 é o piso. Abaixo disso o texto da lista deixa de ser legível, e
           esmaecer viraria esconder: o resultado anterior ainda é a resposta
           válida até o novo chegar. */
        pendente && "pointer-events-none opacity-55",
        className,
      )}
    >
      {children}
    </div>
  );
}
