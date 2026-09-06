import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Pencil, Star, UserRound, Waypoints } from "lucide-react";

import { EsqueletoAbas } from "@/components/padroes/esqueletos";
import { Trilha } from "@/components/padroes/trilha";
import { Skeleton } from "@/components/ui/skeleton";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeloTipoCentro } from "@/features/centros/components/selo-tipo-centro";
import { SeloStatus } from "@/features/eventos/components/selo-status";
import { obterEventoCompleto } from "@/features/eventos/queries";
import { formatarPeriodo } from "@/lib/format";

import { AcoesEvento } from "./acoes-evento";
import { InterruptorDestaque } from "./interruptor-destaque";
import { NavAbas } from "./nav-abas";

export async function generateMetadata({ params }: LayoutProps<"/eventos/[id]">) {
  const { id } = await params;
  const dados = await obterEventoCompleto(id);
  return { title: dados?.evento.titulo ?? "Ação apostólica" };
}

/**
 * O layout devolve a casca de imediato e deixa o cabeçalho carregar em
 * separado. Sem isso, buscar os dados aqui seguraria a navegação inteira: o
 * `loading.tsx` de baixo só entra em cena depois que o layout resolve.
 */
export default async function LayoutEvento({
  children,
  params,
}: LayoutProps<"/eventos/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Suspense fallback={<CabecalhoCarregando />}>
        <CabecalhoEvento id={id} />
      </Suspense>

      {children}
    </div>
  );
}

async function CabecalhoEvento({ id }: { id: string }) {
  const dados = await obterEventoCompleto(id);

  // Com RLS ligado, "não existe" e "não é sua" chegam iguais — e devem mesmo.
  if (!dados) notFound();

  const { evento, lancamentos, documentos, links } = dados;

  return (
    <>
      {/* Todo degrau é rota real — um caminho que não leva a lugar nenhum
          ensina o coordenador a não clicar no caminho.

          A missão fica no meio porque, desde que a linha da igreja saiu do
          cabeçalho, este é o único lugar da tela que diz de quem é a ação. */}
      <Trilha
        elos={[
          { rotulo: "Ações apostólicas", href: "/eventos" },
          {
            rotulo: evento.missaoNome,
            href: `/missoes/${evento.missaoId}`,
            dinamico: true,
          },
          {
            rotulo: evento.titulo,
            href: `/eventos/${evento.id}`,
            dinamico: true,
          },
        ]}
      />

      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ background: evento.tipoCor }}
              />
              <h1 className="text-2xl font-semibold tracking-tight">
                {evento.titulo}
              </h1>
              <SeloStatus status={evento.status} />
              {evento.destaqueRegional ? (
                <Badge
                  variant="outline"
                  className="bg-laranja/10 text-laranja border-laranja/25"
                >
                  <Star className="fill-current" aria-hidden />
                  Destaque regional
                </Badge>
              ) : null}
            </div>

            {/* Período, centro e responsável de uma vez: são as três perguntas
                que se faz antes de abrir qualquer aba. */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {formatarPeriodo(evento.dataInicio, evento.dataFim)}
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <Waypoints className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{evento.centroNome}</span>
                <SeloTipoCentro tipo={evento.centroTipo} />
              </span>
              {evento.responsavelNome ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{evento.responsavelNome}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline">
              <Link href={`/eventos/${evento.id}/editar`}>
                <Pencil aria-hidden />
                Editar
              </Link>
            </Button>
            <AcoesEvento
              eventoId={evento.id}
              titulo={evento.titulo}
              temDocumentos={documentos.length > 0}
            />
          </div>
        </div>

        <InterruptorDestaque
          eventoId={evento.id}
          destaque={evento.destaqueRegional}
        />
      </header>

      <NavAbas
        eventoId={evento.id}
        contagens={{
          lancamentos: lancamentos.length,
          documentos: documentos.length,
          links: links.length,
        }}
      />
    </>
  );
}

function CabecalhoCarregando() {
  return (
    <>
      {/* Mesma altura do link da trilha: 16px de barra e 4px de folga. */}
      <Skeleton className="my-1 h-4 w-72" />
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="flex shrink-0 gap-1">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="size-9" />
          </div>
        </div>
        <Skeleton className="h-6 w-56" />
      </div>
      <EsqueletoAbas quantidade={4} />
    </>
  );
}
