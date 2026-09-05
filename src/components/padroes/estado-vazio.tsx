import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Tela vazia útil: diz o que falta e oferece o próximo passo, em vez de
 * deixar o usuário diante de uma área em branco sem saber o que fazer.
 */
export function EstadoVazio({
  Icone,
  titulo,
  descricao,
  children,
}: {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="bg-muted text-muted-foreground rounded-full p-3">
          <Icone className="size-6" aria-hidden />
        </div>
        <div className="max-w-sm space-y-1.5">
          <p className="font-medium">{titulo}</p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {descricao}
          </p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
