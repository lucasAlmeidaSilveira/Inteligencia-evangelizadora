import {
  EsqueletoCabecalho,
  EsqueletoMetricas,
  EsqueletoTabela,
} from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EsqueletoCabecalho comTrilha larguraTrilha="w-52" />
      {/* A barra do ano: botões de 36px mais o respiro de 16px de cada lado. */}
      <Skeleton className="h-17.5 w-full rounded-lg" />
      <EsqueletoMetricas />
      <EsqueletoTabela />
    </div>
  );
}
