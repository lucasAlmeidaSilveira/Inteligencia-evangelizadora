import {
  EsqueletoCabecalho,
  EsqueletoMetricas,
} from "@/components/padroes/esqueletos";

/** Fallback geral da área autenticada, para rotas sem esqueleto próprio. */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <EsqueletoCabecalho comAcao={false} />
      <EsqueletoMetricas />
    </div>
  );
}
