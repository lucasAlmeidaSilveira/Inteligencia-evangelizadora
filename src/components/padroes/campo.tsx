"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Envolve um controle de formulário com rótulo, ajuda e erro já ligados por
 * `aria-describedby` e `aria-invalid`.
 *
 * Centralizar essa ligação evita o erro mais comum de acessibilidade em
 * formulários: a mensagem de erro existe na tela, mas o leitor de tela nunca
 * a associa ao campo que falhou.
 */
export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string;
  obrigatorio?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => React.ReactNode;
}) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;

  const descrito =
    [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        "aria-describedby": descrito,
        "aria-invalid": erro ? true : undefined,
      })}

      {ajuda && !erro ? (
        <p id={idAjuda} className="text-muted-foreground text-xs">
          {ajuda}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} className="text-destructive text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
