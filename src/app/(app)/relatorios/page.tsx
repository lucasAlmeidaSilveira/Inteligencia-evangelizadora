import { ChartColumnIncreasing } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Relatórios" };

export default async function PaginaRelatorios() {
  await requerUsuario();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="Consolidações por período, missão e tipo de ação."
      />
      <EstadoVazio
        Icone={ChartColumnIncreasing}
        titulo="Em construção"
        descricao="Os relatórios com exportação estão previstos para a próxima etapa. Enquanto isso, o painel traz os indicadores consolidados e cada missão tem seu próprio histórico na aba Indicadores."
      />
    </div>
  );
}
