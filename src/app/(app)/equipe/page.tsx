import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { PainelUsuarios } from "@/features/config/components/painel-usuarios";
import {
  listarMissoesParaVinculo,
  listarUsuarios,
} from "@/features/config/queries";
import { requerQuemConvida } from "@/server/auth/sessao";

export const metadata = { title: "Equipe" };

export default async function PaginaEquipe() {
  // Admin master e responsáveis de missão. O RLS recorta o que cada um vê.
  const usuario = await requerQuemConvida();

  const [usuarios, missoes] = await Promise.all([
    listarUsuarios(),
    usuario.ehAdmin ? listarMissoesParaVinculo() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Equipe"
        descricao={
          usuario.ehAdmin
            ? "Quem tem acesso ao sistema, em todas as missões."
            : "Quem tem acesso aos dados da sua missão."
        }
      />
      <PainelUsuarios
        usuarios={usuarios}
        missoes={missoes}
        quemConvida={{
          id: usuario.id,
          ehAdmin: usuario.ehAdmin,
          missaoId: usuario.missaoId,
          missaoNome: usuario.missaoNome,
        }}
      />
    </div>
  );
}
