"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Banco fora do ar ou consulta que passou dos 3 segundos: o participante vê
 * uma frase e um botão, não a tela genérica do Next. Nada do erro — e nada
 * da URL — é escrito aqui.
 */
export default function ErroNaPesquisa({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <span className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
        <TriangleAlert className="text-muted-foreground size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">
        Não foi possível abrir a pesquisa
      </h1>
      <p className="text-muted-foreground text-sm text-pretty">
        Tente de novo em instantes. Se continuar, avise quem organizou a ação.
      </p>
      <Button variant="outline" className="cursor-pointer" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
