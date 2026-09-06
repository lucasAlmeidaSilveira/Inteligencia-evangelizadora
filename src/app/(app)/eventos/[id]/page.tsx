import { notFound } from "next/navigation";
import {
  CalendarDays,
  HandHeart,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";

import { CartaoMetrica } from "@/components/padroes/cartao-metrica";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { obterEventoCompleto } from "@/features/eventos/queries";
import { formatarMoeda, formatarNumero, formatarPeriodo } from "@/lib/format";

export default async function PaginaVisaoGeralEvento({
  params,
}: PageProps<"/eventos/[id]">) {
  const { id } = await params;
  const dados = await obterEventoCompleto(id);
  if (!dados) notFound();
  const { evento } = dados;

  const { receitas, despesas, saldo } = evento.financeiro;
  const temMovimento = receitas > 0 || despesas > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          Icone={Users}
          rotulo="Participantes"
          valor={formatarNumero(evento.participantesTotal)}
          detalhe={
            evento.participantesTotal === 0
              ? "Ainda não informado"
              : undefined
          }
        />
        <CartaoMetrica
          Icone={HandHeart}
          rotulo="Servos engajados"
          valor={formatarNumero(evento.servosEngajados)}
          detalhe={
            evento.servosEngajados === 0 ? "Ainda não informado" : undefined
          }
        />
        <CartaoMetrica
          Icone={TrendingUp}
          rotulo="Receitas"
          valor={formatarMoeda(receitas)}
        />
        <CartaoMetrica
          Icone={TrendingDown}
          rotulo="Despesas"
          valor={formatarMoeda(despesas)}
        />
      </div>

      {temMovimento ? (
        <Card
          className={
            saldo < 0 ? "border-destructive/40 gap-0 py-5" : "gap-0 py-5"
          }
        >
          <CardContent className="flex flex-wrap items-baseline justify-between gap-3 px-5">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-4" aria-hidden />
              <span className="text-sm font-medium">Saldo da ação</span>
            </div>
            <p
              data-slot="metric"
              className={
                saldo < 0
                  ? "text-destructive text-2xl font-semibold"
                  : "text-success text-2xl font-semibold"
              }
            >
              {formatarMoeda(saldo)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <CalendarDays
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <div className="space-y-0.5">
                <p className="text-muted-foreground text-xs">Período</p>
                <p className="text-sm">
                  {formatarPeriodo(evento.dataInicio, evento.dataFim)}
                </p>
              </div>
            </div>

            {evento.centroNome ? (
              <div className="flex gap-3">
                <Waypoints
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-muted-foreground text-xs">
                    Centro de evangelização
                  </p>
                  <p className="text-sm break-words">{evento.centroNome}</p>
                </div>
              </div>
            ) : null}

            {evento.local || evento.endereco ? (
              <div className="flex gap-3">
                <MapPin
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-muted-foreground text-xs">Local</p>
                  <p className="text-sm break-words">
                    {evento.local ?? evento.endereco}
                  </p>
                  {evento.local && evento.endereco ? (
                    <p className="text-muted-foreground text-sm break-words">
                      {evento.endereco}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {evento.descricao ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Descrição</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {evento.descricao}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

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
    </div>
  );
}
