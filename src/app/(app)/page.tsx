import { Suspense } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Church,
  HandHeart,
  Plus,
  Sparkles,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import { CartaoMetrica } from "@/components/padroes/cartao-metrica";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import {
  EsqueletoLinhas,
  EsqueletoMetricas,
} from "@/components/padroes/esqueletos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SeloStatus } from "@/features/eventos/components/selo-status";
import { GraficoComparativo } from "@/features/painel/components/grafico-comparativo";
import { GraficoEvolucao } from "@/features/painel/components/grafico-evolucao";
import {
  obterComparativo,
  obterEvolucao,
  obterProximosEventos,
  obterResumo,
} from "@/features/painel/queries";
import { listarMissoes } from "@/features/missoes/queries";
import {
  formatarMoeda,
  formatarNumero,
  formatarRelativo,
} from "@/lib/format";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Painel" };

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/* ─── Seções ─────────────────────────────────────────────────────────────── */

async function Indicadores() {
  const r = await obterResumo();
  const ano = new Date().getFullYear();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          Icone={Church}
          rotulo="Missões ativas"
          valor={formatarNumero(r.missoesAtivas)}
        />
        <CartaoMetrica
          Icone={Users}
          rotulo="Membros"
          valor={formatarNumero(r.membros)}
          detalhe={
            r.membrosEstimados
              ? "Inclui estimativas pelos grupos de oração"
              : undefined
          }
        />
        <CartaoMetrica
          Icone={UsersRound}
          rotulo="Grupos de oração"
          valor={formatarNumero(r.gruposAtivos)}
        />
        <CartaoMetrica
          Icone={UsersRound}
          rotulo="Pessoas em grupos"
          valor={formatarNumero(r.pessoasEmGrupos)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          Icone={Sparkles}
          rotulo="Ações neste mês"
          valor={formatarNumero(r.acoesNoMes)}
        />
        <CartaoMetrica
          Icone={Users}
          rotulo={`Participantes em ${ano}`}
          valor={formatarNumero(r.participantesNoAno)}
        />
        <CartaoMetrica
          Icone={HandHeart}
          rotulo={`Servos engajados em ${ano}`}
          valor={formatarNumero(r.servosNoAno)}
        />
        <CartaoMetrica
          Icone={Wallet}
          rotulo={`Saldo em ${ano}`}
          valor={formatarMoeda(r.saldoNoAno)}
          detalhe={
            r.receitasNoAno > 0 || r.despesasNoAno > 0
              ? `${formatarMoeda(r.receitasNoAno)} em receitas · ${formatarMoeda(r.despesasNoAno)} em despesas`
              : "Sem lançamentos no período"
          }
          className={r.saldoNoAno < 0 ? "border-destructive/40" : undefined}
        />
      </div>
    </div>
  );
}

async function Evolucao() {
  const evolucao = await obterEvolucao();
  return <GraficoEvolucao evolucao={evolucao} />;
}

async function Comparativo() {
  const missoes = await obterComparativo();

  if (missoes.length < 2) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm text-pretty">
        A comparação aparece a partir de duas missões cadastradas.
      </p>
    );
  }

  return <GraficoComparativo missoes={missoes} />;
}

async function ProximasAcoes() {
  const eventos = await obterProximosEventos(6);

  if (eventos.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Nenhuma ação apostólica agendada.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {eventos.map((evento) => (
        <li key={evento.id}>
          <Link
            href={`/eventos/${evento.id}`}
            className="hover:bg-accent/50 flex flex-col gap-1.5 px-1 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: evento.tipoCor }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{evento.titulo}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {evento.tipoNome} · {evento.missaoNome}
                  {evento.local ? ` · ${evento.local}` : ""}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
              <span className="text-muted-foreground text-xs">
                {formatarRelativo(evento.dataInicio)}
              </span>
              <SeloStatus status={evento.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────────── */

export default async function PaginaPainel() {
  const usuario = await requerUsuario();
  const missoes = await listarMissoes({ incluirInativas: usuario.ehAdmin });
  const primeiroNome = usuario.nome.split(" ")[0];

  if (missoes.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {saudacao()}, {primeiroNome}
          </h1>
        </header>

        <EstadoVazio
          Icone={Church}
          titulo="Comece cadastrando uma missão"
          descricao={
            usuario.ehAdmin
              ? "Os indicadores, os gráficos e o calendário aparecem aqui assim que houver missões, grupos de oração e ações apostólicas registradas."
              : "Assim que o administrador vincular você a uma missão, o acompanhamento aparece aqui."
          }
        >
          {usuario.ehAdmin ? (
            <Button asChild>
              <Link href="/missoes/nova">
                <Plus aria-hidden />
                Cadastrar missão
              </Link>
            </Button>
          ) : null}
        </EstadoVazio>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {saudacao()}, {primeiroNome}
          </h1>
          <p className="text-muted-foreground">
            {usuario.ehAdmin
              ? "Panorama de todas as missões."
              : missoes.length === 1
                ? `Acompanhamento da ${missoes[0].nome}.`
                : "Acompanhamento das suas missões."}
          </p>
        </div>

        <Button asChild variant="outline" className="shrink-0">
          <Link href="/calendario">
            <CalendarDays aria-hidden />
            Ver calendário
          </Link>
        </Button>
      </header>

      {/* Cada seção carrega em fronteira própria: a mais lenta não segura as
          outras, e o painel vai se preenchendo em vez de esperar por tudo. */}
      <Suspense fallback={<EsqueletoMetricas quantidade={8} />}>
        <Indicadores />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução de membros</CardTitle>
            <CardDescription>
              A partir das competências registradas em cada missão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Evolucao />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Missões por membros</CardTitle>
            <CardDescription>Da maior para a menor.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Comparativo />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas ações apostólicas</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<EsqueletoLinhas quantidade={3} />}>
            <ProximasAcoes />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
