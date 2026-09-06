import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueletos com as mesmas alturas do conteúdo real.
 *
 * Não é preciosismo: um esqueleto de altura diferente faz a página saltar
 * quando os dados chegam, e o olho perde o ponto onde estava lendo.
 */

export function EsqueletoCabecalho({ comAcao = true }: { comAcao?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      {comAcao ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </div>
  );
}

export function EsqueletoMetricas({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <Card key={i} className="gap-0 py-5">
          <CardContent className="space-y-2 px-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EsqueletoCartoes({
  quantidade = 3,
  className = "sm:grid-cols-2 xl:grid-cols-3",
}: {
  quantidade?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: quantidade }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
            {/* Espelha a grade 2×2 do CartaoMissao: quatro métricas em duas
                colunas. Mudar uma das duas faz a página saltar. */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EsqueletoLinhas({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: quantidade }, (_, i) => (
        <Card key={i} className="gap-0 py-4">
          <CardContent className="space-y-3 px-4">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-1.5 size-2.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                </div>
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <div className="flex gap-5 pl-5.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EsqueletoAbas({ quantidade = 3 }: { quantidade?: number }) {
  return (
    <div className="flex gap-4 border-b pb-2.5">
      {Array.from({ length: quantidade }, (_, i) => (
        <Skeleton key={i} className="h-5 w-24" />
      ))}
    </div>
  );
}

export function EsqueletoFormulario({ blocos = 3 }: { blocos?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: blocos }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-5 pt-6">
            <Skeleton className="h-5 w-36" />
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}

export function EsqueletoTabela({ linhas = 5 }: { linhas?: number }) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-4 border-b pb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex gap-4 py-1">
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
