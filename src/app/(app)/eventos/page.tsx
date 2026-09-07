import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
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
import { lerFiltrosDeEvento } from "@/features/eventos/schemas";
import { focoAtual } from "@/features/missoes/foco";
import { chaveDoDia, paraSeletor } from "@/lib/periodo";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Ações apostólicas" };

export default async function PaginaEventos({
  searchParams,
}: PageProps<"/eventos">) {
  const parametros = await searchParams;

  // A missão vem do seletor da barra lateral, não da URL: é o mesmo recorte
  // que vale para o painel, o calendário e os relatórios.
  const [usuario, foco] = await Promise.all([requerUsuario(), focoAtual()]);

  const filtros: FiltrosEvento = {
    missaoId: foco.missaoId,
    ...lerFiltrosDeEvento(parametros),
  };

  const [eventos, missoes, tipos] = await Promise.all([
    listarEventos(filtros),
    missoesDisponiveis(),
    listarTiposEvento(),
  ]);

  const temFiltro = Boolean(
    filtros.tipoEventoId || filtros.status || filtros.destaque || filtros.de,
  );
  const podeCriar = missoes.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Ações apostólicas"
        descricao={
          foco.missaoNome
            ? `Eventos da ${foco.missaoNome}.`
            : usuario.ehAdmin
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

      {/* Filtro e resultado ficam sob a mesma área: é o que permite a lista
          esmaecer enquanto o servidor responde. A lista continua renderizada
          no servidor — chega aqui como `children`. */}
      <AreaFiltrada className="space-y-6">
        {/* `hoje` vem do servidor: os atalhos do seletor são ancorados nele, e
            o servidor renderiza em UTC enquanto o cliente está em São Paulo —
            perto da virada do dia os dois montariam atalhos diferentes para o
            mesmo HTML. */}
        <FiltrosEventos
          base="/eventos"
          tipos={tipos}
          periodo={paraSeletor(filtros)}
          hoje={chaveDoDia(new Date())}
        />

        <ResultadosFiltrados>
          {eventos.length === 0 ? (
            temFiltro || foco.missaoNome ? (
              <EstadoVazio
                Icone={Sparkles}
                titulo="Nenhuma ação com esse recorte"
                descricao={
                  foco.missaoNome
                    ? `Nenhuma ação apostólica da ${foco.missaoNome} corresponde ao que está selecionado. Troque a missão em foco na barra lateral ou ajuste os filtros.`
                    : "Nenhuma ação apostólica corresponde à combinação escolhida. Limpe os filtros para ver todas."
                }
              >
                {temFiltro ? (
                  <Button asChild variant="outline">
                    <Link href="/eventos">Limpar filtros</Link>
                  </Button>
                ) : null}
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
            <div className="cascata space-y-3">
              {eventos.map((evento) => (
                <LinhaEvento
                  key={evento.id}
                  evento={evento}
                  // Com uma missão em foco a coluna repetiria a mesma resposta
                  // em todas as linhas.
                  mostrarMissao={!foco.missaoId && missoes.length > 1}
                />
              ))}
            </div>
          )}
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
