import { CalendarClock, ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { contagemVencida } from "@/features/lembretes/regras";
import { formatarNumero, formatarRelativo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Contagem = {
  membrosEfetivos: number;
  membrosFlutuantes: number;
  membrosEvadidos: number;
};

/**
 * Os três números do grupo, lado a lado, sem depender de cor para distingui-los:
 * cada um leva o próprio rótulo. É o mesmo bloco no cartão da missão e na
 * listagem geral, para que as duas telas leiam a contagem do mesmo jeito.
 */
export function ResumoContagem({
  contagem,
  className,
}: {
  contagem: Contagem;
  className?: string;
}) {
  const partes = [
    { rotulo: "efetivos", valor: contagem.membrosEfetivos },
    { rotulo: "flutuantes", valor: contagem.membrosFlutuantes },
    { rotulo: "evadidos", valor: contagem.membrosEvadidos },
  ];

  return (
    <dl
      className={cn(
        "text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-sm",
        className,
      )}
    >
      {partes.map((parte) => (
        <div key={parte.rotulo} className="flex items-baseline gap-1">
          <dd className="text-foreground tabular font-medium">
            {formatarNumero(parte.valor)}
          </dd>
          <dt>{parte.rotulo}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * Em dia ou pendente — a situação da contagem bimestral.
 *
 * O pendente leva ícone e texto, não só cor: é requisito de acessibilidade, e
 * também o que faz a diferença saltar aos olhos de quem abre a tela uma vez
 * por mês. "Pendente" aqui usa a mesma regra que dispara o lembrete
 * (`contagemVencida`), para a tela e o e-mail nunca discordarem.
 */
export function SituacaoContagem({
  ultimaContagemEm,
  className,
}: {
  ultimaContagemEm: string | null;
  className?: string;
}) {
  if (contagemVencida(ultimaContagemEm)) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-amber-600/40 text-amber-800 dark:border-amber-400/40 dark:text-amber-300",
          className,
        )}
      >
        <CalendarClock className="size-3" aria-hidden />
        Contagem pendente
        {ultimaContagemEm ? (
          <span className="font-normal">
            {" "}
            · última {formatarRelativo(ultimaContagemEm)}
          </span>
        ) : null}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5 text-xs",
        className,
      )}
    >
      <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
      Contagem {formatarRelativo(ultimaContagemEm!)}
    </span>
  );
}
