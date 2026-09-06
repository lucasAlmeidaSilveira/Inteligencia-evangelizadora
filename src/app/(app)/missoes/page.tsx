import Link from "next/link";
import { Church, Plus } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { CartaoMissao } from "@/features/missoes/components/cartao-missao";
import { listarMissoes } from "@/features/missoes/queries";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Missões" };

export default async function PaginaMissoes() {
  const usuario = await requerUsuario();
  // Admin também vê as arquivadas; o responsável, só as ativas.
  const missoes = await listarMissoes(usuario.ehAdmin);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CabecalhoPagina
        titulo="Missões"
        descricao={
          usuario.ehAdmin
            ? "Todas as missões acompanhadas."
            : "As missões sob sua responsabilidade."
        }
      >
        {usuario.ehAdmin ? (
          <Button asChild>
            <Link href="/missoes/nova">
              <Plus aria-hidden />
              Nova missão
            </Link>
          </Button>
        ) : null}
      </CabecalhoPagina>

      {missoes.length === 0 ? (
        <EstadoVazio
          Icone={Church}
          titulo="Nenhuma missão cadastrada"
          descricao={
            usuario.ehAdmin
              ? "Cadastre a primeira missão para começar a acompanhar membros, grupos de oração e ações apostólicas."
              : "Assim que o administrador vincular você a uma missão, ela aparecerá aqui."
          }
        >
          {usuario.ehAdmin ? (
            <Button asChild>
              <Link href="/missoes/nova">
                <Plus aria-hidden />
                Cadastrar missão
              </Link>
            </Button>
          ) : null}
        </EstadoVazio>
      ) : (
        <div className="cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {missoes.map((missao) => (
            <CartaoMissao key={missao.id} missao={missao} />
          ))}
        </div>
      )}
    </div>
  );
}
