import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { TipoCentro } from "@/server/db/schema";

/**
 * As duas cores vêm do carisma, não do gosto: o azul é a estrutura que
 * acumula, o laranja marca a saída e o envio — e a irradiação é literalmente a
 * missão saindo de um centro.
 *
 * O selo aparece nos dois tipos, sempre com o rótulo escrito. Mostrá-lo só na
 * irradiação economizaria um pixel e faria "sem selo" significar alguma coisa,
 * o que ninguém adivinha; e a cor sozinha não diferencia para quem não
 * distingue matizes.
 */
const ESTILOS: Record<TipoCentro, { rotulo: string; classe: string }> = {
  centro_evangelizacao: {
    rotulo: "Centro de Evangelização",
    classe: "bg-info/10 text-info border-info/25",
  },
  irradiacao: {
    rotulo: "Irradiação",
    classe: "bg-laranja/10 text-laranja border-laranja/25",
  },
};

export function SeloTipoCentro({
  tipo,
  className,
}: {
  tipo: TipoCentro;
  className?: string;
}) {
  const estilo = ESTILOS[tipo];
  return (
    <Badge variant="outline" className={cn(estilo.classe, className)}>
      {estilo.rotulo}
    </Badge>
  );
}
