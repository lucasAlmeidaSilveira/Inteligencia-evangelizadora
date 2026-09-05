import { EsqueletoMetricas } from "@/components/padroes/esqueletos";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Só a área de conteúdo: o cabeçalho da missão tem fronteira própria. */
export default function Carregando() {
  return (
    <div className="space-y-6">
      <EsqueletoMetricas />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
