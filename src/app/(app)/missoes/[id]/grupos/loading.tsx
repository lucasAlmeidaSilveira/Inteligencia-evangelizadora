import { EsqueletoCartoes } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <EsqueletoCartoes quantidade={2} className="md:grid-cols-2" />
    </div>
  );
}
