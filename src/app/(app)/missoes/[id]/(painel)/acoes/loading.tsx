import { EsqueletoLinhas } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Os três controles de filtro, nas larguras que eles têm de verdade. */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-36" />
      </div>
      <EsqueletoLinhas quantidade={4} />
    </div>
  );
}
