import {
  EsqueletoCabecalho,
  EsqueletoFormulario,
} from "@/components/padroes/esqueletos";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EsqueletoCabecalho comAcao={false} comTrilha larguraTrilha="w-64" />
      <EsqueletoFormulario />
    </div>
  );
}
