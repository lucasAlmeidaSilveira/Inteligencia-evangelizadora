import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { centrosDasMissoesVisiveis } from "@/features/centros/queries";
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
  const [evento, missoes, tipos, centros] = await Promise.all([
    obterEvento(id),
    missoesDisponiveis(),
    listarTiposEvento(),
    centrosDasMissoesVisiveis(),
  ]);

  if (!evento) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina titulo="Editar ação" descricao={evento.titulo} />
      <FormularioEvento
        eventoId={evento.id}
        missoes={missoes}
        // O centro da ação pode estar arquivado e fora da lista; sem
        // acrescentá-lo, o select abriria em "Diretamente na missão" e
        // salvaria a ação desvinculada sem ninguém pedir.
        centros={
          evento.centroId &&
          evento.centroNome &&
          evento.centroTipo &&
          !centros.some((c) => c.id === evento.centroId)
            ? [
                ...centros,
                {
                  id: evento.centroId,
                  missaoId: evento.missaoId,
                  nome: `${evento.centroNome} (inativo)`,
                  tipo: evento.centroTipo,
                  // Nunca é o principal: esse vem sempre na lista, mesmo
                  // arquivado, justamente porque `centroId` é obrigatório.
                  principal: false,
                  ativo: false,
                },
              ]
            : centros
        }
        tipos={tipos}
        valores={{
          missaoId: evento.missaoId,
          centroId: evento.centroId ?? "",
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
