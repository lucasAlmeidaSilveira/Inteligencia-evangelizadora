"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMovimentoReduzido } from "@/hooks/use-movimento-reduzido";
import { formatarNumero } from "@/lib/format";

import type { Evolucao } from "../queries";

/** Ordem fixa, nunca reciclada: a cor acompanha a missão, não a posição. */
const CORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Segunda codificação, além da cor — quem não distingue matizes lê o traço. */
const TRACOS = ["0", "6 4", "2 3", "10 4 2 4", "1 4"];

function rotularCompetencia(valor: string) {
  const [ano, mes] = valor.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
}

export function GraficoEvolucao({ evolucao }: { evolucao: Evolucao }) {
  const [comoTabela, setComoTabela] = useState(false);
  const movimentoReduzido = useMovimentoReduzido();

  /*
   * Menos de três competências não formam tendência — a linha sugeriria um
   * movimento que os dados não sustentam. Melhor dizer o que falta.
   */
  if (evolucao.competencias < 3) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <ChartNoAxesCombined className="text-muted-foreground size-6" aria-hidden />
        <div className="max-w-sm space-y-1">
          <p className="text-sm font-medium">
            {evolucao.competencias === 0
              ? "Nenhuma competência registrada"
              : `Apenas ${evolucao.competencias} competência(s) registrada(s)`}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            A linha de evolução aparece a partir de três meses registrados. O
            registro fica na aba Indicadores de cada missão.
          </p>
        </div>
      </div>
    );
  }

  const config: ChartConfig = Object.fromEntries(
    evolucao.series.map((serie, i) => [
      serie.chave,
      { label: serie.nome, color: CORES[i % CORES.length] },
    ]),
  );

  if (comoTabela) {
    return (
      <div className="space-y-3">
        <Botao comoTabela onClick={() => setComoTabela(false)} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                {evolucao.series.map((s) => (
                  <TableHead key={s.chave} className="text-right">
                    {s.nome}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {evolucao.pontos.map((ponto) => (
                <TableRow key={ponto.competencia}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {rotularCompetencia(String(ponto.competencia))}
                  </TableCell>
                  {evolucao.series.map((s) => (
                    <TableCell key={s.chave} data-numeric className="text-right">
                      {ponto[s.chave] === undefined
                        ? "—"
                        : formatarNumero(Number(ponto[s.chave]))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Botao comoTabela={false} onClick={() => setComoTabela(true)} />

      <ChartContainer config={config} className="h-64 w-full">
        <LineChart data={evolucao.pontos} margin={{ left: 4, right: 16, top: 8 }}>
          {/* Grade recessiva: orienta sem competir com os dados. */}
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis
            dataKey="competencia"
            tickFormatter={(v) => rotularCompetencia(String(v))}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickMargin={4}
            className="text-xs tabular-nums"
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                labelFormatter={(v) => rotularCompetencia(String(v))}
              />
            }
          />
          {evolucao.series.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}

          {evolucao.series.map((serie, i) => (
            <Line
              key={serie.chave}
              dataKey={serie.chave}
              type="monotone"
              stroke={CORES[i % CORES.length]}
              strokeWidth={2}
              strokeDasharray={TRACOS[i % TRACOS.length]}
              dot={{ r: 4 }}
              activeDot={{ r: 5 }}
              connectNulls
              /* O Recharts anima em 1500ms por padrão e ignora
                 `prefers-reduced-motion`. Um painel aberto uma vez por mês não
                 pode gastar um segundo e meio desenhando o que o eixo já diz.

                 O desenho é o clip nativo do Recharts. Animar `pathLength`
                 faria o `strokeDasharray` rastejar — e ele é a segunda
                 codificação da série, para quem não distingue os matizes. */
              isAnimationActive={!movimentoReduzido}
              animationDuration={400}
              animationEasing="ease-out"
              animationBegin={i * 80}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function Botao({
  comoTabela,
  onClick,
}: {
  comoTabela: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground cursor-pointer"
        onClick={onClick}
      >
        {comoTabela ? (
          <>
            <ChartNoAxesCombined aria-hidden />
            Ver como gráfico
          </>
        ) : (
          <>
            <Table2 aria-hidden />
            Ver como tabela
          </>
        )}
      </Button>
    </div>
  );
}
