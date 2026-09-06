import { notFound } from "next/navigation";

import { PainelFinanceiro } from "@/features/eventos/components/painel-financeiro";
import {
  listarCategorias,
  obterEventoCompleto,
} from "@/features/eventos/queries";

export const metadata = { title: "Financeiro" };

export default async function PaginaFinanceiro({
  params,
}: PageProps<"/eventos/[id]/financeiro">) {
  const { id } = await params;
  // `obterEventoCompleto` já veio do cache do layout: nenhuma ida extra.
  const [dados, categorias] = await Promise.all([
    obterEventoCompleto(id),
    listarCategorias(),
  ]);

  if (!dados) notFound();

  return (
    <PainelFinanceiro
      eventoId={id}
      lancamentos={dados.lancamentos}
      categorias={categorias}
    />
  );
}
