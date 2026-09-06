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
  Waypoints,
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
import { focoAtual } from "@/features/missoes/foco";
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

async function Indicadores({ missaoId }: { missaoId?: string }) {
  const r = await obterResumo(missaoId);
  const ano = new Date().getFullYear();

  return (
    <div className="space-y-4">
      {/* As duas fileiras são uma sequência só: `--cascata-inicio` na segunda
          continua a contagem da primeira, em vez de reiniciá-la. Oito cartões
          entrando na ordem de leitura contam que o painel foi montado para ser
          lido nessa ordem. */}
      <div className="cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Com uma missão em foco, "Missões" mostraria sempre 1 — um
            cartão gasto para repetir o que o seletor ao lado já diz. */}
        {missaoId ? (
          <CartaoMetrica
            Icone={Sparkles}
            rotulo={`Ações em ${ano}`}
            valor={formatarNumero(r.acoesNoAno)}
          />
        ) : (
          <CartaoMetrica
            Icone={Church}
            rotulo="Missões"
            valor={formatarNumero(r.missoesAtivas)}
          />
        )}
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
          Icone={Waypoints}
          rotulo="Centros de evangelização"
          valor={formatarNumero(r.centrosAtivos)}
        />
        {/* "Pessoas em grupos" era um cartão inteiro para um número que só faz
            sentido ao lado da contagem de grupos — como detalhe ele fica junto
            do que qualifica, e a fileira continua com quatro. */}
        <CartaoMetrica
          Icone={UsersRound}
          rotulo="Grupos de oração"
          valor={formatarNumero(r.gruposAtivos)}
          detalhe={
            r.pessoasEmGrupos > 0
              ? `${formatarNumero(r.pessoasEmGrupos)} pessoas reunidas`
              : undefined
          }
        />
      </div>

      <div className="cascata grid gap-4 [--cascata-inicio:140ms] sm:grid-cols-2 xl:grid-cols-4">
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

async function Evolucao({ missaoId }: { missaoId?: string }) {
  const evolucao = await obterEvolucao(12, missaoId);
  return <GraficoEvolucao evolucao={evolucao} />;
}

/* O ranking não estreita com o foco: a pergunta que ele responde é onde a
   missão está em relação às outras, e filtrar apagaria justamente a resposta.
   O recorte vira destaque. */
async function Comparativo({ destaque }: { destaque?: string }) {
  const missoes = await obterComparativo();

  if (missoes.length < 2) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm text-pretty">
        A comparação aparece a partir de duas missões cadastradas.
      </p>
    );
  }

  return <GraficoComparativo missoes={missoes} destaque={destaque} />;
}

async function ProximasAcoes({ missaoId }: { missaoId?: string }) {
  const eventos = await obterProximosEventos(6, missaoId);

  if (eventos.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Nenhuma ação apostólica agendada.
      </p>
    );
  }

  return (
    <ul className="cascata divide-y">
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
                  {evento.tipoNome}
                  {missaoId ? "" : ` · ${evento.missaoNome}`}
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
  const [missoes, foco] = await Promise.all([
    listarMissoes({ incluirInativas: usuario.ehAdmin }),
    focoAtual(),
  ]);
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
            {foco.missaoNome
              ? `Acompanhamento da ${foco.missaoNome}.`
              : usuario.ehAdmin
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
        <Indicadores missaoId={foco.missaoId} />
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
              <Evolucao missaoId={foco.missaoId} />
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
              <Comparativo destaque={foco.missaoId} />
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
            <ProximasAcoes missaoId={foco.missaoId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
