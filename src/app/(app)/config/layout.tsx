import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { requerAdmin } from "@/server/auth/sessao";

import { NavAbas } from "./nav-abas";

export default async function LayoutConfig({
  children,
}: LayoutProps<"/config">) {
  // Toda esta área é privativa do administrador geral.
  await requerAdmin();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="O que aqui se define aparece nos formulários, no calendário e nos relatórios."
      />
      <NavAbas />
      {children}
    </div>
  );
}
