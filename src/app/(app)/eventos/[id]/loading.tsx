import { EsqueletoMetricas } from "@/components/padroes/esqueletos";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Só a área de conteúdo: o cabeçalho da ação tem fronteira própria. */
export default function Carregando() {
  return (
    <div className="space-y-6">
      <EsqueletoMetricas />
      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 pt-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
