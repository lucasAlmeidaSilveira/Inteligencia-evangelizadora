import { redirect } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { FormularioEvento } from "@/features/eventos/components/formulario-evento";
import {
  listarTiposEvento,
  missoesDisponiveis,
} from "@/features/eventos/queries";
import { paraDatetimeLocal } from "@/lib/format";

export const metadata = { title: "Nova ação apostólica" };

export default async function PaginaNovoEvento({
  searchParams,
}: PageProps<"/eventos/novo">) {
  const [parametros, missoes, tipos] = await Promise.all([
    searchParams,
    missoesDisponiveis(),
    listarTiposEvento(),
  ]);

  // Sem missão cadastrada não há o que vincular; sem tipo, nada a escolher.
  if (missoes.length === 0) redirect("/missoes");
  if (tipos.length === 0) redirect("/eventos");

  const missaoSugerida =
    typeof parametros.missao === "string" &&
    missoes.some((m) => m.id === parametros.missao)
      ? parametros.missao
      : (missoes[0]?.id ?? "");

  // Sugestão razoável: começa na próxima hora cheia e dura duas horas.
  const inicio = new Date();
  inicio.setMinutes(0, 0, 0);
  inicio.setHours(inicio.getHours() + 1);
  const fim = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina
        titulo="Nova ação apostólica"
        descricao="Financeiro, documentos e links são adicionados depois de criada."
      />
      <FormularioEvento
        missoes={missoes}
        tipos={tipos}
        valores={{
          missaoId: missaoSugerida,
          tipoEventoId: tipos[0]?.id ?? "",
          titulo: "",
          descricao: "",
          observacoes: "",
          dataInicio: paraDatetimeLocal(inicio),
          dataFim: paraDatetimeLocal(fim),
          local: "",
          endereco: "",
          participantesTotal: "",
          servosEngajados: "",
          status: "planejado",
        }}
      />
    </div>
  );
}
