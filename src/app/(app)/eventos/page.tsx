import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { FiltrosEventos } from "@/features/eventos/components/filtros-eventos";
import { LinhaEvento } from "@/features/eventos/components/linha-evento";
import {
  listarEventos,
  listarTiposEvento,
  missoesDisponiveis,
  type FiltrosEvento,
} from "@/features/eventos/queries";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Ações apostólicas" };

const STATUS_VALIDOS = [
  "planejado",
  "em_andamento",
  "realizado",
  "cancelado",
] as const;

export default async function PaginaEventos({
  searchParams,
}: PageProps<"/eventos">) {
  const parametros = await searchParams;

  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" && valor ? valor : undefined;
  };

  const status = STATUS_VALIDOS.find((s) => s === texto("status"));

  const filtros: FiltrosEvento = {
    missaoId: texto("missao"),
    tipoEventoId: texto("tipo"),
    status,
  };

  const [usuario, eventos, missoes, tipos] = await Promise.all([
    requerUsuario(),
    listarEventos(filtros),
    missoesDisponiveis(),
    listarTiposEvento(),
  ]);

  const temFiltro = Object.values(filtros).some(Boolean);
  const podeCriar = missoes.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Ações apostólicas"
        descricao={
          usuario.ehAdmin
            ? "Eventos de todas as missões."
            : "Eventos da sua missão."
        }
      >
        {podeCriar ? (
          <Button asChild>
            <Link href="/eventos/novo">
              <Plus aria-hidden />
              Nova ação
            </Link>
          </Button>
        ) : null}
      </CabecalhoPagina>

      <FiltrosEventos missoes={missoes} tipos={tipos} />

      {eventos.length === 0 ? (
        temFiltro ? (
          <EstadoVazio
            Icone={Sparkles}
            titulo="Nenhuma ação com esses filtros"
            descricao="Nenhuma ação apostólica corresponde à combinação escolhida. Limpe os filtros para ver todas."
          >
            <Button asChild variant="outline">
              <Link href="/eventos">Limpar filtros</Link>
            </Button>
          </EstadoVazio>
        ) : (
          <EstadoVazio
            Icone={Sparkles}
            titulo="Nenhuma ação apostólica registrada"
            descricao={
              podeCriar
                ? "Cadastre a primeira ação para acompanhar participantes, servos engajados e prestação de contas."
                : "Cadastre uma missão antes de registrar ações apostólicas."
            }
          >
            {podeCriar ? (
              <Button asChild>
                <Link href="/eventos/novo">
                  <Plus aria-hidden />
                  Cadastrar ação
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/missoes">Ir para missões</Link>
              </Button>
            )}
          </EstadoVazio>
        )
      ) : (
        <div className="space-y-3">
          {eventos.map((evento) => (
            <LinhaEvento
              key={evento.id}
              evento={evento}
              mostrarMissao={missoes.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
