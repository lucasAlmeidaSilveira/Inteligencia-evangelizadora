import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Sparkles,
  Star,
} from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { CartaoMetrica } from "@/components/padroes/cartao-metrica";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeloStatus } from "@/features/eventos/components/selo-status";
import { focoAtual } from "@/features/missoes/foco";
import {
  lerFiltrosAnuais,
  listarMeses,
  montarRelatorioAnual,
  nomeDoMes,
  paraQueryStringAnual,
  PRIMEIRO_ANO,
  rotuloDosDias,
  type MesDoRelatorio,
} from "@/features/relatorios/anual";
import { FiltrosAnuais } from "@/features/relatorios/components/filtros-anuais";
import { listarAcoesDoAno } from "@/features/relatorios/queries-anual";
import { formatarNumero, formatarPeriodo } from "@/lib/format";
import { diaNoFuso } from "@/lib/fuso";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Relatório anual" };

function TabelaDoMes({
  mes,
  mostrarMissao,
}: {
  mes: MesDoRelatorio;
  mostrarMissao: boolean;
}) {
  return (
    <Card className="py-0">
      <CardHeader className="px-4 pt-4">
        <CardTitle className="text-base">{nomeDoMes(mes.chave)}</CardTitle>
        <CardDescription>
          {formatarNumero(mes.acoes.length)}{" "}
          {mes.acoes.length === 1 ? "ação" : "ações"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Ação</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead className="pr-4">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mes.acoes.map((acao) => (
              <TableRow key={acao.id}>
                {/* O título quebra linha em vez de empurrar a tabela: é a
                    coluna que se lê primeiro, e cortá-la esconderia a ação. */}
                <TableCell className="min-w-56 pl-4 whitespace-normal">
                  <div className="space-y-1">
                    <Link
                      href={`/eventos/${acao.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {acao.titulo}
                    </Link>
                    {mostrarMissao ? (
                      <p className="text-muted-foreground text-xs">
                        {acao.missaoNome}
                      </p>
                    ) : null}
                    {acao.destaqueRegional ? (
                      <Badge
                        variant="outline"
                        className="bg-laranja/10 text-laranja border-laranja/25"
                      >
                        <Star className="fill-current" aria-hidden />
                        Destaque regional
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {/* A cor identifica o tipo, mas o nome vem junto — cor
                      nunca sozinha. */}
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: acao.tipoCor }}
                    />
                    {acao.tipoNome}
                  </span>
                </TableCell>
                <TableCell className="tabular">
                  {formatarPeriodo(acao.dataInicio, acao.dataFim)}
                </TableCell>
                <TableCell className="tabular min-w-40 whitespace-normal">
                  {rotuloDosDias(acao)}
                </TableCell>
                <TableCell className="pr-4">
                  <SeloStatus status={acao.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function PaginaRelatorioAnual({
  searchParams,
}: PageProps<"/relatorios/anual">) {
  const parametros = await searchParams;
  const [usuario, foco] = await Promise.all([requerUsuario(), focoAtual()]);

  // O ano corrente é o de São Paulo: na noite de 31 de dezembro, o servidor
  // em UTC já estaria no ano seguinte.
  const hoje = diaNoFuso(new Date());
  const anoCorrente = Number(hoje.slice(0, 4));
  const filtros = lerFiltrosAnuais(parametros, anoCorrente, foco.missaoId);

  const relatorio = montarRelatorioAnual(
    await listarAcoesDoAno(filtros),
    filtros.ano,
    hoje,
  );
  const { total } = relatorio;
  const vazio = total.acoes === 0;

  // A missão vai em cada linha só no panorama de todas: para quem está preso
  // a uma, ou com uma em foco, ela repetiria a mesma resposta em toda linha.
  const mostrarMissao = usuario.ehAdmin && !foco.missaoId;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CabecalhoPagina
        titulo="Relatório anual"
        descricao={`Todas as ações apostólicas de ${filtros.ano}, mês a mês${foco.missaoNome ? ` · ${foco.missaoNome}` : ""}.`}
        trilha={[
          { rotulo: "Relatórios", href: "/relatorios" },
          { rotulo: "Relatório anual", href: "/relatorios/anual" },
        ]}
      >
        {!vazio ? (
          <Button asChild variant="outline">
            {/* Route Handler: a mesma consulta e a mesma montagem da tela,
                servidas como arquivo. */}
            <a href={`/relatorios/anual/exportar?${paraQueryStringAnual(filtros)}`}>
              <Download aria-hidden />
              Exportar CSV
            </a>
          </Button>
        ) : null}
      </CabecalhoPagina>

      <AreaFiltrada className="space-y-6">
        <FiltrosAnuais
          ano={filtros.ano}
          anoCorrente={anoCorrente}
          primeiroAno={PRIMEIRO_ANO}
        />

        <ResultadosFiltrados className="space-y-6">
          {vazio ? (
            <EstadoVazio
              Icone={ClipboardList}
              titulo={`Nenhuma ação registrada em ${filtros.ano}`}
              descricao={
                filtros.incluirCancelados
                  ? "Escolha outro ano, ou cadastre as ações deste em Ações apostólicas."
                  : "Escolha outro ano, ou cadastre as ações deste em Ações apostólicas. Ações canceladas ficam de fora por padrão — marque a opção acima para incluí-las."
              }
            >
              <Button asChild variant="outline">
                <Link href="/eventos">Ir para ações apostólicas</Link>
              </Button>
            </EstadoVazio>
          ) : (
            <>
              <div className="cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <CartaoMetrica
                  Icone={Sparkles}
                  rotulo="Ações no ano"
                  valor={formatarNumero(total.acoes)}
                  detalhe={
                    total.canceladas > 0
                      ? `Inclui ${formatarNumero(total.canceladas)} ${total.canceladas === 1 ? "cancelada" : "canceladas"}`
                      : undefined
                  }
                />
                {/* "Ainda planejadas" num ano que já passou é ação que
                    aconteceu sem ninguém atualizar a situação — o detalhe é o
                    convite para fechá-las, não um número a mais. */}
                <CartaoMetrica
                  Icone={CheckCircle2}
                  rotulo="Realizadas"
                  valor={formatarNumero(total.realizadas)}
                  detalhe={
                    total.agendadas > 0
                      ? `${formatarNumero(total.agendadas)} ainda planejadas ou em andamento`
                      : undefined
                  }
                />
                <CartaoMetrica
                  Icone={Star}
                  rotulo="Destaques regionais"
                  valor={formatarNumero(total.destaques)}
                />
                <CartaoMetrica
                  Icone={CalendarDays}
                  rotulo="Dias com ação"
                  valor={formatarNumero(total.diasComAcao)}
                  detalhe="Cada dia conta uma vez, mesmo com várias ações"
                />
              </div>

              {/* O mês vazio é dito, não omitido: a tela existe para conferir
                  que nada ficou de fora, e um mês sem nenhuma ação é o
                  primeiro lugar onde procurar um registro esquecido. "Realizada
                  ou agendada", e não "registrada": com as canceladas incluídas,
                  o mês que só tem uma cancelada aparece na lista e ainda assim
                  é citado aqui. */}
              {relatorio.mesesSemAcao.length > 0 ? (
                <p className="text-muted-foreground text-sm text-pretty">
                  Nenhuma ação realizada ou agendada em{" "}
                  {listarMeses(relatorio.mesesSemAcao)}.
                </p>
              ) : null}

              {relatorio.meses.map((mes) => (
                <TabelaDoMes
                  key={mes.chave}
                  mes={mes}
                  mostrarMissao={mostrarMissao}
                />
              ))}
            </>
          )}
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
