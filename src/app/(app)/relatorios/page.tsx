import Link from "next/link";
import { ChartColumnIncreasing, Download, Gauge } from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { CartaoMetrica } from "@/components/padroes/cartao-metrica";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarIndice, formatarNps } from "@/features/eventos/impacto";
import { listarTiposEvento } from "@/features/eventos/queries";
import { focoAtual } from "@/features/missoes/foco";
import { FiltrosRelatorio } from "@/features/relatorios/components/filtros-relatorio";
import { lerFiltros, paraQueryString } from "@/features/relatorios/filtros";
import {
  gerarRelatorio,
  type LinhaRelatorio,
} from "@/features/relatorios/queries";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import { chaveDoDia, paraSeletor } from "@/lib/periodo";

export const metadata = { title: "Relatórios" };

function Tabela({
  titulo,
  linhas,
  total,
  comCor = false,
}: {
  titulo: string;
  linhas: LinhaRelatorio[];
  total: Omit<LinhaRelatorio, "id" | "nome" | "cor">;
  comCor?: boolean;
}) {
  return (
    <Card className="py-0">
      <CardHeader className="px-4 pt-4">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
              <TableHead className="text-right">Participantes</TableHead>
              <TableHead className="text-right">Servos</TableHead>
              <TableHead className="text-right">Receitas</TableHead>
              <TableHead className="text-right">Despesas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              {/* Médias, não somas — e só das ações que têm o dado. O
                  travessão é "sem informação", nunca zero. */}
              <TableHead className="text-right">
                <abbr title="Satisfação média, de 0 a 10" className="no-underline">
                  NPS
                </abbr>
              </TableHead>
              <TableHead className="text-right">
                <abbr
                  title="Índice de Impacto Evangelizador médio, de 0 a 100"
                  className="no-underline"
                >
                  Impacto
                </abbr>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {comCor && linha.cor ? (
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: linha.cor }}
                      />
                    ) : null}
                    {linha.nome}
                  </span>
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {formatarNumero(linha.acoes)}
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {formatarNumero(linha.participantes)}
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {formatarNumero(linha.servos)}
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {formatarMoeda(linha.receitas)}
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {formatarMoeda(linha.despesas)}
                </TableCell>
                <TableCell
                  data-numeric
                  className={
                    linha.saldo < 0
                      ? "text-destructive text-right font-medium"
                      : "text-right font-medium"
                  }
                >
                  {formatarMoeda(linha.saldo)}
                </TableCell>
                <CelulaMedia
                  valor={formatarNps(linha.nps)}
                  base={linha.comNps}
                  de={linha.acoes}
                />
                <CelulaMedia
                  valor={formatarIndice(linha.impacto)}
                  base={linha.comImpacto}
                  de={linha.acoes}
                />
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell data-numeric className="text-right font-medium">
                {formatarNumero(total.acoes)}
              </TableCell>
              <TableCell data-numeric className="text-right font-medium">
                {formatarNumero(total.participantes)}
              </TableCell>
              <TableCell data-numeric className="text-right font-medium">
                {formatarNumero(total.servos)}
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell
                data-numeric
                className={
                  total.saldo < 0
                    ? "text-destructive text-right font-medium"
                    : "text-right font-medium"
                }
              >
                {formatarMoeda(total.saldo)}
              </TableCell>
              <CelulaMedia
                valor={formatarNps(total.nps)}
                base={total.comNps}
                de={total.acoes}
                negrito
              />
              <CelulaMedia
                valor={formatarIndice(total.impacto)}
                base={total.comImpacto}
                de={total.acoes}
                negrito
              />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Média com a base por baixo: "8,4" sobre "3 de 12" diz que nove ações não
 * tiveram pesquisa — sem isso, a média de uma ação só pareceria a da missão.
 */
function CelulaMedia({
  valor,
  base,
  de,
  negrito = false,
}: {
  valor: string;
  base: number;
  de: number;
  negrito?: boolean;
}) {
  return (
    <TableCell data-numeric className="text-right">
      <span className={negrito ? "font-medium" : undefined}>{valor}</span>
      {base > 0 && base < de ? (
        <span className="text-muted-foreground block text-xs">
          {base} de {de}
        </span>
      ) : null}
    </TableCell>
  );
}

export default async function PaginaRelatorios({
  searchParams,
}: PageProps<"/relatorios">) {
  const parametros = await searchParams;
  const foco = await focoAtual();
  const filtros = lerFiltros(parametros, foco.missaoId);

  const [relatorio, tipos] = await Promise.all([
    gerarRelatorio(filtros),
    listarTiposEvento(),
  ]);

  const vazio = relatorio.total.acoes === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao={`De ${formatarData(filtros.de)} a ${formatarData(filtros.ate)}${foco.missaoNome ? ` · ${foco.missaoNome}` : ""}.`}
      >
        {!vazio ? (
          <Button asChild variant="outline">
            {/* Route Handler: a mesma consulta da tela, servida como arquivo. */}
            <a href={`/relatorios/exportar?${paraQueryString(filtros)}`}>
              <Download aria-hidden />
              Exportar CSV
            </a>
          </Button>
        ) : null}
      </CabecalhoPagina>

      <AreaFiltrada className="space-y-6">
        {/* `hoje` vem daqui, e não do navegador: os atalhos do seletor são
            ancorados nele, e o servidor renderiza em UTC enquanto o cliente
            está em São Paulo — perto da virada do dia os dois montariam
            atalhos diferentes para o mesmo HTML. */}
        <FiltrosRelatorio
          tipos={tipos}
          periodo={paraSeletor(filtros)}
          hoje={chaveDoDia(new Date())}
        />

        <ResultadosFiltrados className="space-y-6">
          {vazio ? (
            <EstadoVazio
              Icone={ChartColumnIncreasing}
              titulo="Nenhuma ação no período"
              descricao="Ajuste as datas ou os filtros. Ações canceladas ficam de fora por padrão — marque a opção acima para incluí-las."
            >
              <Button asChild variant="outline">
                <Link href="/relatorios">Voltar ao período padrão</Link>
              </Button>
            </EstadoVazio>
          ) : (
            <>
              <div className="cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <CartaoMetrica
                  rotulo="Ações apostólicas"
                  valor={formatarNumero(relatorio.total.acoes)}
                />
                <CartaoMetrica
                  rotulo="Impacto evangelizador"
                  Icone={Gauge}
                  valor={formatarIndice(relatorio.total.impacto)}
                  detalhe={
                    relatorio.total.impacto === null
                      ? "Nenhuma ação com dados para o índice"
                      : `Média de ${relatorio.total.comImpacto} de ${relatorio.total.acoes} ações · NPS médio ${formatarNps(relatorio.total.nps)}`
                  }
                />
                <CartaoMetrica
                  rotulo="Participantes"
                  valor={formatarNumero(relatorio.total.participantes)}
                />
                <CartaoMetrica
                  rotulo="Servos engajados"
                  valor={formatarNumero(relatorio.total.servos)}
                />
                <CartaoMetrica
                  rotulo="Saldo do período"
                  valor={formatarMoeda(relatorio.total.saldo)}
                  detalhe={`${formatarMoeda(relatorio.total.receitas)} em receitas · ${formatarMoeda(relatorio.total.despesas)} em despesas`}
                  className={
                    relatorio.total.saldo < 0
                      ? "border-destructive/40"
                      : undefined
                  }
                />
              </div>

              <Tabela
                titulo="Por missão"
                linhas={relatorio.porMissao}
                total={relatorio.total}
              />

              <Tabela
                titulo="Por tipo de ação"
                linhas={relatorio.porTipo}
                total={relatorio.total}
                comCor
              />
            </>
          )}
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
