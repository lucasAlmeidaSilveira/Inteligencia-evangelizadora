import { PainelCategorias } from "@/features/config/components/painel-categorias";
import { listarTodasAsCategorias } from "@/features/config/queries";

export const metadata = { title: "Categorias financeiras" };

export default async function PaginaCategorias() {
  const categorias = await listarTodasAsCategorias();
  return <PainelCategorias categorias={categorias} />;
}
