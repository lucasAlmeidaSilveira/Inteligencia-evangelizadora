import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { centrosDasMissoesVisiveis } from "@/features/centros/queries";
import { FormularioEvento } from "@/features/eventos/components/formulario-evento";
import { opcoesDeCentro } from "@/features/eventos/opcoes-de-centro";
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

  // O centro e o local atuais entram mesmo arquivados — sem eles, os selects
  // abririam vazios e salvar desvincularia a ação sem ninguém pedir.
  const opcoes = opcoesDeCentro(centros, evento);
  // Com um centro como local, `local` e `endereco` vêm resolvidos com os dados
  // dele; o texto livre da ação, nesse caso, está vazio.
  const textoLivre = evento.localCentroId === null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Fora do grupo `(painel)`: sem o cabeçalho e as abas da ação, é a
          trilha que preserva o nome e o caminho de volta. */}
      <CabecalhoPagina
        trilha={[
          { rotulo: "Ações apostólicas", href: "/eventos" },
          {
            rotulo: evento.titulo,
            href: `/eventos/${evento.id}`,
            dinamico: true,
          },
          { rotulo: "Editar ação", href: `/eventos/${evento.id}/editar` },
        ]}
        titulo="Editar ação"
        descricao={evento.titulo}
      />
      <FormularioEvento
        eventoId={evento.id}
        missoes={missoes}
        centros={opcoes.centros}
        locais={opcoes.locais}
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
          localCentroId: evento.localCentroId ?? "",
          local: textoLivre ? (evento.local ?? "") : "",
          endereco: textoLivre ? (evento.endereco ?? "") : "",
          responsavelNome: evento.responsavelNome ?? "",
          participantesInscritos: evento.participantesInscritos,
          participantesTotal: evento.participantesTotal,
          participantesNovos: evento.participantesNovos,
          participantesPermaneceram: evento.participantesPermaneceram,
          servosEngajados: evento.servosEngajados,
          // Vazio, não "0": em branco é "sem pesquisa"; zero é a pior nota.
          nps: evento.nps ?? "",
          // Vazio, não "0,00": o input em branco é o que diz "não orçado".
          orcamentoPrevisto: evento.orcamentoPrevisto ?? "",
          status: evento.status,
          destaqueRegional: evento.destaqueRegional,
        }}
      />
    </div>
  );
}
