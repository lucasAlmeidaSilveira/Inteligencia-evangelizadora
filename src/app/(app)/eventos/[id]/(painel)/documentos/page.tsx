import { notFound } from "next/navigation";

import { PainelDocumentos } from "@/features/eventos/components/painel-documentos";
import { obterEventoCompleto } from "@/features/eventos/queries";

export const metadata = { title: "Documentos" };

export default async function PaginaDocumentos({
  params,
}: PageProps<"/eventos/[id]/documentos">) {
  const { id } = await params;
  const dados = await obterEventoCompleto(id);
  if (!dados) notFound();

  return <PainelDocumentos eventoId={id} documentos={dados.documentos} />;
}
