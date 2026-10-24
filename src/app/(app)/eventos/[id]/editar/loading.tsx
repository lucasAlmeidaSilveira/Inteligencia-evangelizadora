import {
  EsqueletoCabecalho,
  EsqueletoFormulario,
} from "@/components/padroes/esqueletos";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EsqueletoCabecalho comAcao={false} comTrilha larguraTrilha="w-64" />
      {/* Quatro cartões: na edição, a participação vem à parte da descrição. */}
      <EsqueletoFormulario blocos={4} />
    </div>
  );
}
