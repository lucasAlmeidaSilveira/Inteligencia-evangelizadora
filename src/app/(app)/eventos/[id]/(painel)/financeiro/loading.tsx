import { EsqueletoTabela } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-28" />
          ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <EsqueletoTabela />
    </div>
  );
}
