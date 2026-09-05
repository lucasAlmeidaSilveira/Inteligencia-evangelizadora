import {
  EsqueletoCabecalho,
  EsqueletoMetricas,
  EsqueletoTabela,
} from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EsqueletoCabecalho />
      <Skeleton className="h-24 w-full rounded-lg" />
      <EsqueletoMetricas />
      <EsqueletoTabela />
    </div>
  );
}
