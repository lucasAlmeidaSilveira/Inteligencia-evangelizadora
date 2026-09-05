import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { StatusEvento } from "@/server/db/schema";

/** Cada status tem cor e rótulo próprios — mas nunca só cor: o rótulo carrega
 *  o significado para quem não distingue matizes. */
const ESTILOS: Record<StatusEvento, { rotulo: string; classe: string }> = {
  planejado: {
    rotulo: "Planejado",
    classe: "bg-info/10 text-info border-info/25",
  },
  em_andamento: {
    rotulo: "Em andamento",
    classe: "bg-warning/10 text-warning border-warning/25",
  },
  realizado: {
    rotulo: "Realizado",
    classe: "bg-success/10 text-success border-success/25",
  },
  cancelado: {
    rotulo: "Cancelado",
    classe: "bg-muted text-muted-foreground border-border line-through",
  },
};

export function SeloStatus({
  status,
  className,
}: {
  status: StatusEvento;
  className?: string;
}) {
  const estilo = ESTILOS[status];
  return (
    <Badge variant="outline" className={cn(estilo.classe, className)}>
      {estilo.rotulo}
    </Badge>
  );
}
