import { notFound } from "next/navigation";

import { ListaCentros } from "@/features/centros/components/lista-centros";
import { listarCentros } from "@/features/centros/queries";
import { obterMissao } from "@/features/missoes/queries";

export const metadata = { title: "Centros de evangelização" };

export default async function PaginaCentros({
  params,
}: PageProps<"/missoes/[id]/centros">) {
  const { id } = await params;

  const missao = await obterMissao(id);
  if (!missao) notFound();

  const centros = await listarCentros(id);

  return <ListaCentros missaoId={id} centros={centros} />;
}
