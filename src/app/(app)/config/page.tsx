import { PainelTipos } from "@/features/config/components/painel-tipos";
import { listarTodosOsTipos } from "@/features/config/queries";

export const metadata = { title: "Tipos de ação" };

export default async function PaginaTipos() {
  const tipos = await listarTodosOsTipos();
  return <PainelTipos tipos={tipos} />;
}
