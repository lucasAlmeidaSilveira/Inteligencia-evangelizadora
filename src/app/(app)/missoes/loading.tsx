import {
  EsqueletoCabecalho,
  EsqueletoCartoes,
} from "@/components/padroes/esqueletos";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <EsqueletoCabecalho />
      <EsqueletoCartoes quantidade={3} />
    </div>
  );
}
