import { cn } from "@/lib/utils";

/**
 * Métrica para usar *dentro* de um card, ao lado de outras.
 *
 * `CartaoMetrica` é um `Card` inteiro e não aninha: quatro deles dentro de um
 * card viram quatro caixas dentro de uma caixa. Aqui o agrupamento é o card de
 * fora, e cada número é só rótulo e valor.
 */
export function MetricaCompacta({
  rotulo,
  valor,
  detalhe,
  tom = "normal",
  className,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** `positivo`/`negativo` só para dinheiro — em pessoa, número não é bom nem ruim. */
  tom?: "normal" | "positivo" | "negativo" | "atenuado";
  className?: string;
}) {
  const tons = {
    normal: "text-foreground",
    positivo: "text-success",
    negativo: "text-destructive",
    atenuado: "text-muted-foreground",
  };

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-muted-foreground text-xs font-medium">{rotulo}</p>
      {/* `data-slot="metric"` liga as figuras tabulares de globals.css: os
          números de uma linha ficam alinhados entre si. */}
      <p
        data-slot="metric"
        className={cn("text-lg font-semibold tracking-tight", tons[tom])}
      >
        {valor}
      </p>
      {detalhe ? (
        <p className="text-muted-foreground text-xs">{detalhe}</p>
      ) : null}
    </div>
  );
}
