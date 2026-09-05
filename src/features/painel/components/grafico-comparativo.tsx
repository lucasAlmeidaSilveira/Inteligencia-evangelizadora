"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatarNumero } from "@/lib/format";

import type { BarraMissao } from "../queries";

/*
 * Uma cor só, de propósito.
 *
 * A cor aqui não carrega identidade — todas as barras medem a mesma coisa, e o
 * que se lê é magnitude. Pintar cada missão de um tom diferente sugeriria que a
 * cor significa algo, e quebraria na décima missão, quando a paleta acaba.
 * A identidade fica no rótulo ao lado de cada barra.
 */
const config = {
  membros: { label: "Membros", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GraficoComparativo({ missoes }: { missoes: BarraMissao[] }) {
  // Comparar uma coisa com nada não é comparação.
  if (missoes.length < 2) return null;

  const dados = missoes.slice(0, 12);
  const sobraram = missoes.length - dados.length;

  return (
    <div className="space-y-3">
      <ChartContainer
        config={config}
        className="w-full"
        style={{ height: `${Math.max(dados.length * 38 + 24, 140)}px` }}
      >
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
          barCategoryGap={2}
        >
          <CartesianGrid horizontal={false} strokeOpacity={0.4} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nome"
            tickLine={false}
            axisLine={false}
            width={140}
            tickMargin={4}
            className="text-xs"
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.08 }}
            content={<ChartTooltipContent hideLabel />}
          />
          {/* Extremidade arredondada só na ponta do dado; a base fica ancorada. */}
          <Bar dataKey="membros" fill="var(--color-membros)" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="membros"
              position="right"
              offset={8}
              className="fill-foreground text-xs tabular-nums"
              formatter={(valor) => formatarNumero(Number(valor ?? 0))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      {sobraram > 0 ? (
        <p className="text-muted-foreground text-xs">
          Mostrando as 12 maiores de {formatarNumero(missoes.length)} missões.
        </p>
      ) : null}

      {missoes.some((m) => m.estimado) ? (
        <p className="text-muted-foreground text-xs">
          Missões sem total de membros informado aparecem com a soma dos grupos
          de oração.
        </p>
      ) : null}
    </div>
  );
}
