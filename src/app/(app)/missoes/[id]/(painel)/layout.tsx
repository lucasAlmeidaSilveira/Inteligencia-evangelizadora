import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Pencil } from "lucide-react";

import { EsqueletoAbas } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { obterMissao } from "@/features/missoes/queries";
import { requerUsuario } from "@/server/auth/sessao";

import { NavAbas } from "./nav-abas";

export async function generateMetadata({ params }: LayoutProps<"/missoes/[id]">) {
  const { id } = await params;
  const missao = await obterMissao(id);
  return { title: missao?.nome ?? "Missão" };
}

/** Casca imediata; o cabeçalho carrega em fronteira própria. */
export default async function LayoutMissao({
  children,
  params,
}: LayoutProps<"/missoes/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<CabecalhoCarregando />}>
        <CabecalhoMissao id={id} />
      </Suspense>

      {children}
    </div>
  );
}

async function CabecalhoMissao({ id }: { id: string }) {
  const [missao, usuario] = await Promise.all([
    obterMissao(id),
    requerUsuario(),
  ]);

  // Com RLS ligado, "não existe" e "não é sua" chegam iguais — e devem mesmo.
  if (!missao) notFound();

  const local = [missao.regiao, missao.cidade].filter(Boolean).join(" · ");

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {missao.nome}
            </h1>
            {!missao.ativo ? <Badge variant="secondary">Inativa</Badge> : null}
          </div>
          {local ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5" aria-hidden />
              {local}
            </p>
          ) : null}
        </div>

        {usuario.podeEditarMissao ? (
          <Button asChild variant="outline" className="shrink-0">
            <Link href={`/missoes/${missao.id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
        ) : null}
      </header>

      <NavAbas missaoId={missao.id} />
    </>
  );
}

function CabecalhoCarregando() {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>
      <EsqueletoAbas quantidade={4} />
    </>
  );
}
