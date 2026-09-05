import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CartaoMetrica({
  rotulo,
  valor,
  detalhe,
  Icone,
  className,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  Icone?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-5", className)}>
      <CardContent className="space-y-2 px-5">
        <div className="text-muted-foreground flex items-center gap-1.5">
          {Icone ? <Icone className="size-3.5" aria-hidden /> : null}
          <span className="text-xs font-medium">{rotulo}</span>
        </div>
        {/* `data-slot="metric"` liga as figuras tabulares definidas em
            globals.css: o número não muda de largura ao atualizar. */}
        <p data-slot="metric" className="text-2xl font-semibold tracking-tight">
          {valor}
        </p>
        {detalhe ? (
          <p className="text-muted-foreground text-xs">{detalhe}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
