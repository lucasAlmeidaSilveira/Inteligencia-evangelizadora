import {
  EsqueletoCabecalho,
  EsqueletoLinhas,
} from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EsqueletoCabecalho />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <EsqueletoLinhas quantidade={4} />
    </div>
  );
}
