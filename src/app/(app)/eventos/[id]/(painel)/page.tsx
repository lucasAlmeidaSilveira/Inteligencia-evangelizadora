import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, HandHeart, Link2, MapPin } from "lucide-react";

import { MetricaCompacta } from "@/components/padroes/metrica-compacta";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SeloTipoCentro } from "@/features/centros/components/selo-tipo-centro";
import { SeloStatus } from "@/features/eventos/components/selo-status";
import { compararOrcamento } from "@/features/eventos/financeiro";
import {
  calcularParticipacao,
  formatarTaxa,
} from "@/features/eventos/participacao";
import { obterEventoCompleto } from "@/features/eventos/queries";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPeriodo,
  formatarTamanhoArquivo,
} from "@/lib/format";

/** Quantos itens de documento e link cabem antes de virar ruído. */
const PREVIA = 4;

export default async function PaginaVisaoGeralEvento({
  params,
}: PageProps<"/eventos/[id]">) {
  const { id } = await params;

  /* A mesma chamada que o layout já fez — o `cache` do React devolve o
     resultado sem nova transação. É o que torna os blocos de documentos e
     links abaixo gratuitos: os dados já estavam aqui. */
  const dados = await obterEventoCompleto(id);
  if (!dados) notFound();

  const { evento, documentos, links } = dados;
  const { receitas, despesas, saldo } = evento.financeiro;

  const participacao = calcularParticipacao(evento);
  const orcamento = compararOrcamento(evento.orcamentoPrevisto, despesas);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Informações da ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Info rotulo="Tipo da ação">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: evento.tipoCor }}
                />
                {evento.tipoNome}
              </span>
            </Info>

            <Info rotulo="Missão">
              <Link
                href={`/missoes/${evento.missaoId}`}
                className="rounded-sm underline-offset-4 hover:underline"
              >
                {evento.missaoNome}
              </Link>
            </Info>

            <Info rotulo="Centro de evangelização">
              <span className="flex flex-wrap items-center gap-2">
                <span className="break-words">{evento.centroNome}</span>
                <SeloTipoCentro tipo={evento.centroTipo} />
              </span>
            </Info>

            <Info rotulo="Responsável">
              {evento.responsavelNome ?? (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </Info>

            <Info rotulo="Período">
              {formatarPeriodo(evento.dataInicio, evento.dataFim)}
            </Info>

            {evento.local || evento.endereco ? (
              <Info rotulo="Local">
                <span className="flex gap-2">
                  <MapPin
                    className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block break-words">
                      {evento.local ?? evento.endereco}
                    </span>
                    {evento.local && evento.endereco ? (
                      <span className="text-muted-foreground block break-words">
                        {evento.endereco}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Info>
            ) : null}

            <Info rotulo="Situação">
              <SeloStatus status={evento.status} />
            </Info>

            <Info rotulo="Registro">
              <span className="text-muted-foreground">
                Criada em {formatarData(evento.criadoEm)} · atualizada em{" "}
                {formatarData(evento.atualizadoEm)}
              </span>
            </Info>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                <MetricaCompacta
                  rotulo="Inscritos"
                  valor={formatarNumero(participacao.inscritos)}
                />
                <MetricaCompacta
                  rotulo="Presentes"
                  valor={formatarNumero(participacao.presentes)}
                />
                <MetricaCompacta
                  rotulo="Novos"
                  valor={formatarNumero(participacao.novos)}
                />
                <MetricaCompacta
                  rotulo="Permaneceram"
                  valor={formatarNumero(participacao.permaneceram)}
                />
                {/* A taxa é o número que a missão de fato acompanha: quantos
                    dos que vieram seguiram num grupo de oração depois. */}
                <MetricaCompacta
                  rotulo="Permanência"
                  valor={formatarTaxa(participacao.taxaPermanencia)}
                  detalhe={
                    participacao.taxaPermanencia === null
                      ? "Sem presentes informados"
                      : undefined
                  }
                />
              </div>

              <p className="text-muted-foreground flex items-center gap-1.5 border-t pt-3 text-sm">
                <HandHeart className="size-3.5 shrink-0" aria-hidden />
                <span className="tabular font-medium">
                  {formatarNumero(evento.servosEngajados)}
                </span>
                {evento.servosEngajados === 1
                  ? "servo engajado"
                  : "servos engajados"}
                {participacao.taxaComparecimento !== null ? (
                  <span className="before:mx-2 before:content-['·']">
                    {formatarTaxa(participacao.taxaComparecimento)} de
                    comparecimento
                  </span>
                ) : null}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financeiro</CardTitle>
              <CardAction>
                <Link
                  href={`/eventos/${evento.id}/financeiro`}
                  className="text-primary flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline"
                >
                  Ver lançamentos
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricaCompacta
                  rotulo="Previsto"
                  valor={
                    orcamento.previsto === null
                      ? "—"
                      : formatarMoeda(orcamento.previsto)
                  }
                  detalhe={
                    orcamento.previsto === null ? "Não orçado" : undefined
                  }
                  tom={orcamento.previsto === null ? "atenuado" : "normal"}
                />
                <MetricaCompacta
                  rotulo="Receitas"
                  valor={formatarMoeda(receitas)}
                />
                <MetricaCompacta
                  rotulo="Despesas"
                  valor={formatarMoeda(despesas)}
                />
                {/* Saldo negativo leva cor e sinal: cor sozinha não diferencia
                    para quem não distingue matizes. */}
                <MetricaCompacta
                  rotulo="Saldo"
                  valor={formatarMoeda(saldo)}
                  tom={saldo < 0 ? "negativo" : "positivo"}
                  detalhe={saldo < 0 ? "No vermelho" : undefined}
                />
              </div>

              {orcamento.previsto !== null ? (
                <BarraOrcamento
                  percentual={orcamento.percentual}
                  restante={orcamento.restante}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
            {documentos.length > PREVIA ? (
              <CardAction>
                <AtalhoAba href={`/eventos/${evento.id}/documentos`}>
                  Ver todos ({documentos.length})
                </AtalhoAba>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {documentos.length === 0 ? (
              <ListaVazia
                Icone={FileText}
                texto="Nenhum documento anexado."
                href={`/eventos/${evento.id}/documentos`}
                acao="Anexar"
              />
            ) : (
              <ul className="space-y-3">
                {documentos.slice(0, PREVIA).map((documento) => (
                  <li key={documento.id} className="flex gap-2.5 text-sm">
                    <FileText
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate">{documento.nome}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatarTamanhoArquivo(documento.tamanhoBytes)} ·{" "}
                        {formatarData(documento.criadoEm)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links úteis</CardTitle>
            {links.length > PREVIA ? (
              <CardAction>
                <AtalhoAba href={`/eventos/${evento.id}/links`}>
                  Ver todos ({links.length})
                </AtalhoAba>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <ListaVazia
                Icone={Link2}
                texto="Nenhum link cadastrado."
                href={`/eventos/${evento.id}/links`}
                acao="Adicionar"
              />
            ) : (
              <ul className="space-y-3">
                {links.slice(0, PREVIA).map((link) => (
                  <li key={link.id} className="flex gap-2.5 text-sm">
                    <Link2
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate rounded-sm underline-offset-4 hover:underline"
                      >
                        {link.titulo}
                      </a>
                      <p className="text-muted-foreground truncate text-xs">
                        {link.descricao ?? link.url}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {evento.descricao || evento.observacoes ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {evento.descricao ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {evento.descricao}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {evento.observacoes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {evento.observacoes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Info({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{rotulo}</p>
      <div className="break-words">{children}</div>
    </div>
  );
}

/**
 * Previsto × executado. A barra não é decoração: mostra de relance se a ação
 * está dentro do que se planejou gastar, que é a pergunta da prestação de
 * contas. Estouro vira `destructive` **e** ganha a palavra "acima" — a cor
 * sozinha não conta a história.
 */
function BarraOrcamento({
  percentual,
  restante,
}: {
  percentual: number | null;
  restante: number | null;
}) {
  if (percentual === null || restante === null) return null;

  const estourou = restante < 0;
  const preenchido = Math.min(percentual, 100);

  return (
    <div className="space-y-1.5 border-t pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {Math.round(percentual)}% do orçamento executado
        </span>
        <span
          className={
            estourou
              ? "text-destructive tabular font-medium"
              : "text-muted-foreground tabular"
          }
        >
          {estourou
            ? `${formatarMoeda(Math.abs(restante))} acima do previsto`
            : `${formatarMoeda(restante)} disponíveis`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${Math.round(percentual)} por cento do orçamento executado`}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={estourou ? "bg-destructive h-full" : "bg-primary h-full"}
          style={{ width: `${preenchido}%` }}
        />
      </div>
    </div>
  );
}

function AtalhoAba({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-primary flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * Vazio dentro de card, não `EstadoVazio` — aquele é um card inteiro com 56px
 * de respiro, e aqui já estamos dentro de um. Mesma ideia, escala menor.
 */
function ListaVazia({
  Icone,
  texto,
  href,
  acao,
}: {
  Icone: typeof FileText;
  texto: string;
  href: string;
  acao: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <span className="bg-muted flex size-9 items-center justify-center rounded-full">
        <Icone className="text-muted-foreground size-4" aria-hidden />
      </span>
      <p className="text-muted-foreground text-sm">{texto}</p>
      <Link
        href={href}
        className="text-primary rounded-sm text-sm font-medium underline-offset-4 hover:underline"
      >
        {acao}
      </Link>
    </div>
  );
}
