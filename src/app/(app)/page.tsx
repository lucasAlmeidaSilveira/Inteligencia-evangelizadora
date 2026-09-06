import { Suspense } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Church,
  HandHeart,
  Plus,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  Waypoints,
} from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
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
import { FiltrosPainel } from "@/features/painel/components/filtros-painel";
import { GraficoComparativo } from "@/features/painel/components/grafico-comparativo";
import { GraficoEvolucao } from "@/features/painel/components/grafico-evolucao";
import {
  obterAcoes,
  obterComparativo,
  obterEventosDoPeriodo,
  obterEvolucao,
  obterPanorama,
  obterProximosEventos,
} from "@/features/painel/queries";
import { focoAtual } from "@/features/missoes/foco";
import { listarMissoes } from "@/features/missoes/queries";
import {
  formatarMoeda,
  formatarNumero,
  formatarRelativo,
} from "@/lib/format";
import { lerPeriodoDoPainel } from "@/features/painel/periodo";
import { intervaloDoMes, rotuloDoMes } from "@/lib/mes";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Painel" };

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** O recorte como sufixo de URL, para os cartões levarem o mês consigo. */
function sufixoDeMes(mes?: string) {
  return mes ? `&mes=${mes}` : "";
}

/* ─── Seções ─────────────────────────────────────────────────────────────── */

async function Panorama({ missaoId }: { missaoId?: string }) {
  const r = await obterPanorama(missaoId);

  return (
    <div className="cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Com uma missão em foco, "Missões" mostraria sempre 1 — um cartão
          gasto para repetir o que o seletor ao lado já diz. */}
      {missaoId ? null : (
        <CartaoMetrica
          Icone={Church}
          rotulo="Missões"
          valor={formatarNumero(r.missoesAtivas)}
          href="/missoes"
        />
      )}
      <CartaoMetrica
        Icone={Users}
        rotulo="Total da Obra"
        valor={formatarNumero(r.membros)}
        detalhe={
          r.membrosEstimados
            ? "Inclui estimativas pelos grupos de oração"
            : undefined
        }
      />
      {/* A missão em foco viaja como filtro para a tela de destino: sem isso
          o cartão mostraria o número de uma missão e abriria a lista de
          todas. As duas telas recortam por `?missao=`, não pelo foco. */}
      <CartaoMetrica
        Icone={Waypoints}
        rotulo="Centros de evangelização"
        valor={formatarNumero(r.centrosAtivos)}
        href={missaoId ? `/centros?missao=${missaoId}` : "/centros"}
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
        href={missaoId ? `/grupos?missao=${missaoId}` : "/grupos"}
      />
    </div>
  );
}

async function Acoes({ missaoId, mes }: { missaoId?: string; mes?: string }) {
  const r = await obterAcoes(missaoId, mes);
  const sufixo = sufixoDeMes(mes);

  /* Média por ação, não um segundo número solto: "1.284 participantes" não
     diz se foram muitas ações pequenas ou poucas grandes, e é essa a diferença
     que o coordenador procura ao comparar dois meses. */
  const media =
    r.realizadas > 0 ? Math.round(r.participantes / r.realizadas) : 0;

  const proporcaoNovos =
    r.participantes > 0
      ? Math.round((r.participantesNovos / r.participantes) * 100)
      : null;

  return (
    /* `--cascata-inicio` continua a contagem da fileira de cima em vez de
       reiniciá-la: as duas são uma sequência de leitura só. */
    <div className="cascata grid gap-4 [--cascata-inicio:140ms] sm:grid-cols-2 xl:grid-cols-4">
      {/* Os destaques vêm primeiro porque são a pergunta que o painel existe
          para responder — quantos seminários e retiros a missão fez. */}
      {r.destacados.map((tipo) => (
        <CartaoMetrica
          key={tipo.id}
          cor={tipo.cor}
          rotulo={tipo.nome}
          valor={formatarNumero(tipo.acoes)}
          detalhe={
            tipo.participantes > 0
              ? `${formatarNumero(tipo.participantes)} participantes`
              : undefined
          }
          href={`/eventos?tipo=${tipo.id}&status=realizado${sufixo}`}
        />
      ))}

      {/* Leva a /eventos com o mesmo recorte: sem o `?mes=` e o `?status=`, o
          cartão diria um número e a tela de destino mostraria outro — a lista
          inteira, de todos os meses e situações. */}
      <CartaoMetrica
        Icone={CheckCircle2}
        rotulo="Ações realizadas"
        valor={formatarNumero(r.realizadas)}
        detalhe={
          r.agendadas > 0
            ? `${formatarNumero(r.agendadas)} ainda agendadas`
            : undefined
        }
        href={`/eventos?status=realizado${sufixo}`}
      />
      <CartaoMetrica
        Icone={Users}
        rotulo="Participantes"
        valor={formatarNumero(r.participantes)}
        detalhe={
          media > 0 ? `Média de ${formatarNumero(media)} por ação` : undefined
        }
      />
      <CartaoMetrica
        Icone={UserPlus}
        rotulo="Novos participantes"
        valor={formatarNumero(r.participantesNovos)}
        detalhe={
          proporcaoNovos !== null
            ? `${proporcaoNovos}% dos participantes`
            : undefined
        }
      />
      <CartaoMetrica
        Icone={HandHeart}
        rotulo="Servos engajados"
        valor={formatarNumero(r.servos)}
      />
      <CartaoMetrica
        Icone={Wallet}
        rotulo="Saldo"
        valor={formatarMoeda(r.saldo)}
        detalhe={
          r.receitas > 0 || r.despesas > 0
            ? `${formatarMoeda(r.receitas)} em receitas · ${formatarMoeda(r.despesas)} em despesas`
            : "Sem lançamentos no período"
        }
        className={r.saldo < 0 ? "border-destructive/40" : undefined}
      />
    </div>
  );
}

async function Evolucao({
  missaoId,
  mes,
}: {
  missaoId?: string;
  mes?: string;
}) {
  const evolucao = await obterEvolucao(12, missaoId, mes);
  return <GraficoEvolucao evolucao={evolucao} />;
}

/* O ranking não estreita com o foco: a pergunta que ele responde é onde a
   missão está em relação às outras, e filtrar apagaria justamente a resposta.
   O recorte vira destaque. O mês, esse sim, vale — ele muda a régua, não o
   conjunto comparado. */
async function Comparativo({
  destaque,
  mes,
}: {
  destaque?: string;
  mes?: string;
}) {
  const { missoes, semRegistro } = await obterComparativo(mes);

  if (missoes.length < 2) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm text-pretty">
        {mes
          ? "Faltam competências registradas nesse mês para comparar as missões."
          : "A comparação aparece a partir de duas missões cadastradas."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <GraficoComparativo missoes={missoes} destaque={destaque} />
      {/* Missão fora do ranking por falta de indicador precisa ser dita: sem
          isso, a que sumiu pareceria ter deixado de existir. */}
      {semRegistro > 0 ? (
        <p className="text-muted-foreground text-xs text-pretty">
          {semRegistro === 1
            ? "1 missão ficou de fora por não ter competência registrada até esse mês."
            : `${formatarNumero(semRegistro)} missões ficaram de fora por não terem competência registrada até esse mês.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A agenda do recorte.
 *
 * Sem mês, são as próximas — a pergunta de quem abre o painel hoje. Com um mês
 * escolhido, "próximas" não quer dizer nada: em março do ano passado não há
 * nada à frente, e a lista viria vazia como se a missão não tivesse feito
 * nada. Aí passa a listar o que aconteceu naquele mês.
 */
async function Agenda({ missaoId, mes }: { missaoId?: string; mes?: string }) {
  const intervalo = mes ? intervaloDoMes(mes) : undefined;
  const eventos = intervalo
    ? await obterEventosDoPeriodo(intervalo.de, intervalo.ate, missaoId)
    : await obterProximosEventos(6, missaoId);

  if (eventos.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {mes
          ? "Nenhuma ação apostólica nesse mês."
          : "Nenhuma ação apostólica agendada."}
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

export default async function PaginaPainel({
  searchParams,
}: PageProps<"/">) {
  const parametros = await searchParams;
  const usuario = await requerUsuario();
  const [missoes, foco] = await Promise.all([
    listarMissoes(usuario.ehAdmin),
    focoAtual(),
  ]);
  const primeiroNome = usuario.nome.split(" ")[0];

  /* O mês vem da URL e a missão do cookie: o recorte de período é para ser
     mandado por mensagem, o de missão é de quem está trabalhando. Sem
     parâmetro o painel abre no mês corrente; `undefined` aqui é "todo o
     período", pedido explicitamente. */
  const mes = lerPeriodoDoPainel(parametros.mes);

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

      {/* Filtro e conteúdo sob a mesma área: é o que permite o painel esmaecer
          enquanto o servidor responde, em vez de deixar os números do recorte
          anterior na tela como se nada tivesse sido pedido. As seções continuam
          renderizadas no servidor — chegam aqui como `children`. */}
      <AreaFiltrada className="space-y-6">
        <ResultadosFiltrados className="space-y-6">
          {/* O rótulo da fileira não é decoração: membros, centros e grupos
              valem hoje e não mudam com o mês. Sem ele, "Total da Obra: 1.240"
              sob "Setembro de 2026" se leria como 1.240 pessoas em setembro. */}
          <section className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-medium">Hoje</h2>
            {/* Cada seção carrega em fronteira própria: a mais lenta não segura
                as outras, e o painel vai se preenchendo em vez de esperar por
                tudo. */}
            <Suspense
              fallback={<EsqueletoMetricas quantidade={foco.missaoId ? 3 : 4} />}
            >
              <Panorama missaoId={foco.missaoId} />
            </Suspense>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-muted-foreground text-xs font-medium">
                {mes ? rotuloDoMes(mes) : "Todo o período"}
              </h2>
              <FiltrosPainel />
            </div>
            <Suspense fallback={<EsqueletoMetricas quantidade={7} />}>
              <Acoes missaoId={foco.missaoId} mes={mes} />
            </Suspense>
          </section>

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
                  <Evolucao missaoId={foco.missaoId} mes={mes} />
                </Suspense>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Missões por membros</CardTitle>
                <CardDescription>
                  {mes
                    ? `Da maior para a menor, pela competência de ${rotuloDoMes(mes).toLowerCase()}.`
                    : "Da maior para a menor."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                  <Comparativo destaque={foco.missaoId} mes={mes} />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {mes
                  ? `Ações apostólicas de ${rotuloDoMes(mes).toLowerCase()}`
                  : "Próximas ações apostólicas"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<EsqueletoLinhas quantidade={3} />}>
                <Agenda missaoId={foco.missaoId} mes={mes} />
              </Suspense>
            </CardContent>
          </Card>
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
