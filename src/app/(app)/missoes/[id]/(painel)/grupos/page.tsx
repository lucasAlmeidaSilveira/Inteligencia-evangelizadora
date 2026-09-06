import { notFound } from "next/navigation";

import { centrosParaSelecao } from "@/features/centros/queries";
import { lerFiltroDeCentro } from "@/features/centros/schemas";
import { ListaGrupos } from "@/features/grupos/components/lista-grupos";
import { listarGrupos } from "@/features/grupos/queries";
import { obterMissao } from "@/features/missoes/queries";

export const metadata = { title: "Grupos de oração" };

export default async function PaginaGrupos({
  params,
  searchParams,
}: PageProps<"/missoes/[id]/grupos">) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);

  const missao = await obterMissao(id);
  if (!missao) notFound();

  const centroFiltrado = lerFiltroDeCentro(parametros.centro);

  // Uma consulta só, com os inativos: o filtro precisa deles, e o diálogo
  // recebe abaixo apenas o subconjunto ativo — centro arquivado não recebe
  // vínculo novo.
  const [grupos, centros] = await Promise.all([
    listarGrupos(id, { centroId: centroFiltrado }),
    centrosParaSelecao(id, true),
  ]);

  return (
    <ListaGrupos
      missaoId={id}
      centros={centros}
      grupos={grupos}
      filtrado={Boolean(centroFiltrado)}
    />
  );
}
