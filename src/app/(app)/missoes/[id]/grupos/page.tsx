import { notFound } from "next/navigation";

import { ListaGrupos } from "@/features/grupos/components/lista-grupos";
import { listarGrupos } from "@/features/grupos/queries";
import { obterMissao } from "@/features/missoes/queries";

export const metadata = { title: "Grupos de oração" };

export default async function PaginaGrupos({
  params,
}: PageProps<"/missoes/[id]/grupos">) {
  const { id } = await params;

  const missao = await obterMissao(id);
  if (!missao) notFound();

  const grupos = await listarGrupos(id);

  return <ListaGrupos missaoId={id} grupos={grupos} />;
}
