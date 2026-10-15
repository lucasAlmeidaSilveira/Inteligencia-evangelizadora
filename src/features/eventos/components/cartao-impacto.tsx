import { Gauge } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  faixaDoImpacto,
  formatarIndice,
  PESOS_DO_IMPACTO,
  ROTULOS_DO_IMPACTO,
  type ComponenteDoImpacto,
  type Impacto,
} from "../impacto";

/**
 * O índice de uma ação e de onde ele veio.
 *
 * Só leitura, de propósito: o índice é derivado da participação, da nota de
 * satisfação e dos lançamentos, e cada um desses se edita no próprio card.
 * Mostrar os componentes lado a lado é o que permite ao coordenador ver qual
 * deles puxa a nota para baixo — um número sozinho não orienta decisão.
 */
export function CartaoImpacto({ impacto }: { impacto: Impacto }) {
  const faixa = faixaDoImpacto(impacto.indice);
  const parcial = impacto.indice !== null && impacto.faltam.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="text-muted-foreground size-4" aria-hidden />
          Índice de Impacto Evangelizador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p
            data-slot="metric"
            className="text-4xl font-semibold tracking-tight"
            aria-label={
              impacto.indice === null
                ? "Índice sem informação"
                : `Índice ${formatarIndice(impacto.indice)} de 100`
            }
          >
            {formatarIndice(impacto.indice)}
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              / 100
            </span>
          </p>
          {/* Faixa com palavra e cor: a cor nunca é o único diferenciador. */}
          {faixa ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                faixa.tom === "positivo" && "border-success/30 text-success",
                faixa.tom === "negativo" &&
                  "border-destructive/30 text-destructive",
                faixa.tom === "normal" && "text-muted-foreground",
              )}
            >
              Impacto {faixa.rotulo.toLowerCase()}
              {parcial ? " · parcial" : ""}
            </span>
          ) : null}
        </div>

        {impacto.indice === null ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Ainda sem informação. Preencha a participação, a nota de
            satisfação e os lançamentos financeiros da ação para calcular.
          </p>
        ) : parcial ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Calculado sem{" "}
            {listar(impacto.faltam.map((c) => ROTULOS_DO_IMPACTO[c].toLowerCase()))}
            . O que falta não conta como zero: os pesos são redistribuídos
            entre o que foi informado.
          </p>
        ) : null}

        <ul className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PESOS_DO_IMPACTO) as ComponenteDoImpacto[]).map(
            (nome) => (
              <Componente
                key={nome}
                nome={nome}
                nota={impacto.componentes[nome]}
              />
            ),
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Componente({
  nome,
  nota,
}: {
  nome: ComponenteDoImpacto;
  nota: number | null;
}) {
  const peso = PESOS_DO_IMPACTO[nome];

  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          {ROTULOS_DO_IMPACTO[nome]}
          <span className="text-muted-foreground text-xs"> · peso {peso}%</span>
        </span>
        <span
          data-slot="metric"
          className={cn(
            "font-medium",
            nota === null && "text-muted-foreground font-normal",
          )}
        >
          {nota === null ? "sem informação" : formatarIndice(nota)}
        </span>
      </div>
      <div
        role="img"
        aria-label={
          nota === null
            ? `${ROTULOS_DO_IMPACTO[nome]}: sem informação`
            : `${ROTULOS_DO_IMPACTO[nome]}: ${formatarIndice(nota)} de 100`
        }
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        {nota === null ? null : (
          <div className="bg-primary h-full" style={{ width: `${nota}%` }} />
        )}
      </div>
    </li>
  );
}

/** "a", "a e b", "a, b e c". */
function listar(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
