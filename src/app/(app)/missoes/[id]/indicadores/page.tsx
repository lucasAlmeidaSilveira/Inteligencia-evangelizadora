import { notFound } from "next/navigation";
import { ChartNoAxesCombined, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarIndicadores, obterMissao } from "@/features/missoes/queries";
import { formatarCompetencia, formatarNumero } from "@/lib/format";

import { DialogoCompetencia } from "./dialogo-competencia";

/** Variação em relação ao mês registrado anteriormente. */
function Variacao({ atual, anterior }: { atual: number; anterior?: number }) {
  if (anterior === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const delta = atual - anterior;

  if (delta === 0) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Minus className="size-3" aria-hidden />
        estável
      </span>
    );
  }

  const subiu = delta > 0;
  const Icone = subiu ? TrendingUp : TrendingDown;

  return (
    <span
      className={
        subiu
          ? "text-success inline-flex items-center gap-1 text-xs font-medium"
          : "text-destructive inline-flex items-center gap-1 text-xs font-medium"
      }
    >
      <Icone className="size-3" aria-hidden />
      {subiu ? "+" : "−"}
      {formatarNumero(Math.abs(delta))}
    </span>
  );
}

export const metadata = { title: "Indicadores" };

export default async function PaginaIndicadores({
  params,
}: PageProps<"/missoes/[id]/indicadores">) {
  const { id } = await params;
  const missao = await obterMissao(id);
  if (!missao) notFound();

  // Vem em ordem decrescente: o mais recente primeiro, que é como se lê.
  const registros = await listarIndicadores(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          O registro de competência é opcional. Cada mês registrado vira um
          ponto na linha de evolução da missão — sem ele, o número atual
          sobrescreve o anterior e a comparação se perde.
        </p>
        <DialogoCompetencia missaoId={id} />
      </div>

      {registros.length === 0 ? (
        <EstadoVazio
          Icone={ChartNoAxesCombined}
          titulo="Nenhuma competência registrada"
          descricao="Registre o mês atual para começar o histórico. Um único registro já serve de ponto de partida para as comparações futuras."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Membros</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead className="text-right">Grupos</TableHead>
                  <TableHead className="text-right">Em grupos</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((registro, indice) => {
                  // A lista é decrescente, então o "anterior" é o próximo item.
                  const anterior = registros[indice + 1];
                  return (
                    <TableRow key={registro.competencia}>
                      <TableCell className="font-medium whitespace-nowrap capitalize">
                        {formatarCompetencia(registro.competencia)}
                      </TableCell>
                      <TableCell data-numeric className="text-right">
                        {formatarNumero(registro.membrosTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Variacao
                          atual={registro.membrosTotal}
                          anterior={anterior?.membrosTotal}
                        />
                      </TableCell>
                      <TableCell data-numeric className="text-right">
                        {formatarNumero(registro.gruposTotal)}
                      </TableCell>
                      <TableCell data-numeric className="text-right">
                        {formatarNumero(registro.pessoasGruposTotal)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                        {registro.observacao ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
