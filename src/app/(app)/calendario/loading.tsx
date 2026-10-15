import { EsqueletoCabecalho } from "@/components/padroes/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <EsqueletoCabecalho />
      {/* Título do mês e o atalho para o relatório do ano: a linha tem a
          altura do botão (32px), não a do título. */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-[560px] w-full rounded-lg" />
    </div>
  );
}
