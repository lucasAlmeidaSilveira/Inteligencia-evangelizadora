import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { FormularioEvento } from "@/features/eventos/components/formulario-evento";
import {
  listarTiposEvento,
  missoesDisponiveis,
  obterEvento,
} from "@/features/eventos/queries";
import { paraDatetimeLocal } from "@/lib/format";

export const metadata = { title: "Editar ação apostólica" };

export default async function PaginaEditarEvento({
  params,
}: PageProps<"/eventos/[id]/editar">) {
  const { id } = await params;
  const [evento, missoes, tipos] = await Promise.all([
    obterEvento(id),
    missoesDisponiveis(),
    listarTiposEvento(),
  ]);

  if (!evento) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina titulo="Editar ação" descricao={evento.titulo} />
      <FormularioEvento
        eventoId={evento.id}
        missoes={missoes}
        tipos={tipos}
        valores={{
          missaoId: evento.missaoId,
          tipoEventoId: evento.tipoEventoId,
          titulo: evento.titulo,
          descricao: evento.descricao ?? "",
          observacoes: evento.observacoes ?? "",
          dataInicio: paraDatetimeLocal(evento.dataInicio),
          dataFim: paraDatetimeLocal(evento.dataFim),
          local: evento.local ?? "",
          endereco: evento.endereco ?? "",
          participantesTotal: evento.participantesTotal,
          servosEngajados: evento.servosEngajados,
          status: evento.status,
        }}
      />
    </div>
  );
}
