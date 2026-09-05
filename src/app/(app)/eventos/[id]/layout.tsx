import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Church, Pencil } from "lucide-react";

import { EsqueletoAbas } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";
import { SeloStatus } from "@/features/eventos/components/selo-status";
import { obterEventoCompleto } from "@/features/eventos/queries";
import { formatarPeriodo } from "@/lib/format";

import { AcoesEvento } from "./acoes-evento";
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
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
          </div>

          <p className="text-muted-foreground text-sm">
            {evento.tipoNome} ·{" "}
            {formatarPeriodo(evento.dataInicio, evento.dataFim)}
          </p>

          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Church className="size-3.5" aria-hidden />
            <Link
              href={`/missoes/${evento.missaoId}`}
              className="rounded-sm underline-offset-4 hover:underline"
            >
              {evento.missaoNome}
            </Link>
          </p>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex shrink-0 gap-1">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="size-9" />
        </div>
      </div>
      <EsqueletoAbas quantidade={4} />
    </>
  );
}
