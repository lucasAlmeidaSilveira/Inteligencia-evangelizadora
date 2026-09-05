import { Settings } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { requerAdmin } from "@/server/auth/sessao";

export const metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  await requerAdmin();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Tipos de ação, categorias financeiras e acesso dos responsáveis."
      />
      <EstadoVazio
        Icone={Settings}
        titulo="Em construção"
        descricao="A tela de configuração está prevista para a próxima etapa. Por ora, tipos de evento e categorias financeiras são definidos pelo seed do banco, e novos usuários entram por linha de comando."
      />
    </div>
  );
}
