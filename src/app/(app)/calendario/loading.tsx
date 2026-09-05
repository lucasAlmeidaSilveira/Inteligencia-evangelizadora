import { EsqueletoCabecalho } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <EsqueletoCabecalho />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-[560px] w-full rounded-lg" />
    </div>
  );
}
