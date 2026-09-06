"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMovimentoReduzido } from "@/hooks/use-movimento-reduzido";
import { formatarNumero } from "@/lib/format";

import type { BarraMissao } from "../queries";

/*
 * Uma cor só, de propósito.
 *
 * A cor aqui não carrega identidade — todas as barras medem a mesma coisa, e o
 * que se lê é magnitude. Pintar cada missão de um tom diferente sugeriria que a
 * cor significa algo, e quebraria na décima missão, quando a paleta acaba.
 * A identidade fica no rótulo ao lado de cada barra.
 *
 * A única exceção é `destaque`, que não nomeia uma missão: diz "esta é a que
 * você está olhando". Continua sendo uma cor só, com as demais recuadas.
 */
const config = {
  membros: { label: "Membros", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GraficoComparativo({
  missoes,
  destaque,
}: {
  missoes: BarraMissao[];
  /** Missão em foco. Sem ela, todas as barras pesam igual. */
  destaque?: string;
}) {
  // Antes do retorno curto abaixo: hook não pode ficar atrás de condicional.
  const movimentoReduzido = useMovimentoReduzido();

  // Comparar uma coisa com nada não é comparação.
  if (missoes.length < 2) return null;

  const dados = missoes.slice(0, 12);
  const sobraram = missoes.length - dados.length;
  const emDestaque = destaque
    ? missoes.find((m) => m.id === destaque)
    : undefined;
  // Recuar as outras só funciona se houver algo de que recuar: uma missão em
  // foco fora das 12 maiores deixaria o gráfico inteiro apagado sem motivo.
  const recuar = Boolean(emDestaque && dados.some((m) => m.id === destaque));

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
            /* A opacidade das barras não pode ser o único sinal do destaque —
               quem não distingue os dois tons continua achando a missão pelo
               nome em negrito. */
            tick={({ x, y, index, payload }: YAxisTickContentProps) => (
              <text
                x={x}
                y={y}
                dy={4}
                textAnchor="end"
                /* O `!` vence o `fill-muted-foreground` que o ChartContainer
                   aplica a todo tick por seletor descendente. */
                className={
                  recuar && dados[index]?.id === destaque
                    ? "fill-foreground! text-xs font-medium"
                    : "fill-muted-foreground text-xs"
                }
              >
                {String(payload?.value ?? "")}
              </text>
            )}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.08 }}
            content={<ChartTooltipContent hideLabel />}
          />
          {/* Extremidade arredondada só na ponta do dado; a base fica ancorada. */}
          <Bar
            dataKey="membros"
            fill="var(--color-membros)"
            radius={[0, 4, 4, 0]}
            /* Crescer a partir do eixo é a única animação que diz o que o
               gráfico mede: magnitude a partir de zero. O padrão do Recharts
               são 1500ms — tempo demais para uma leitura de relance, e o
               rótulo numérico na ponta viaja junto com a barra o tempo todo. */
            isAnimationActive={!movimentoReduzido}
            animationDuration={350}
            animationEasing="ease-out"
          >
            {dados.map((missao) => (
              <Cell
                key={missao.id}
                fillOpacity={recuar && missao.id !== destaque ? 0.35 : 1}
              />
            ))}
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

      {recuar && emDestaque ? (
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">{emDestaque.nome}</span>{" "}
          está em destaque; as demais aparecem para situar a comparação.
        </p>
      ) : null}

      {sobraram > 0 ? (
        <p className="text-muted-foreground text-xs">
          Mostrando as 12 maiores de {formatarNumero(missoes.length)} missões.
          {emDestaque && !recuar
            ? ` ${emDestaque.nome}, em foco, fica fora dessa faixa.`
            : ""}
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
