import {
  EsqueletoCabecalho,
  EsqueletoLinhas,
} from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EsqueletoCabecalho comAcao={false} />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-52" />
      </div>
      <Skeleton className="h-4 w-60" />
      <EsqueletoLinhas quantidade={4} />
    </div>
  );
}
