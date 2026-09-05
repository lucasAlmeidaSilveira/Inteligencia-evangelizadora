import { EsqueletoTabela } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-9 w-48 shrink-0" />
      </div>
      <EsqueletoTabela />
    </div>
  );
}
