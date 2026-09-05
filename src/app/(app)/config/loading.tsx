import { EsqueletoAbas, EsqueletoCabecalho } from "@/components/padroes/esqueletos";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EsqueletoCabecalho comAcao={false} />
      <EsqueletoAbas />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="gap-0 py-3">
            <CardContent className="flex items-center gap-3 px-4">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="size-9 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
