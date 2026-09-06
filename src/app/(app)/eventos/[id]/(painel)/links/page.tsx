import { notFound } from "next/navigation";

import { PainelLinks } from "@/features/eventos/components/painel-links";
import { obterEventoCompleto } from "@/features/eventos/queries";

export const metadata = { title: "Links úteis" };

export default async function PaginaLinks({
  params,
}: PageProps<"/eventos/[id]/links">) {
  const { id } = await params;
  const dados = await obterEventoCompleto(id);
  if (!dados) notFound();

  return <PainelLinks eventoId={id} links={dados.links} />;
}
