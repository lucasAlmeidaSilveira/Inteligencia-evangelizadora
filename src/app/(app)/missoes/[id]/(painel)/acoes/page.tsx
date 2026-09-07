import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { FiltrosEventos } from "@/features/eventos/components/filtros-eventos";
import { LinhaEvento } from "@/features/eventos/components/linha-evento";
import { listarEventos, listarTiposEvento } from "@/features/eventos/queries";
import { lerFiltrosDeEvento } from "@/features/eventos/schemas";
import { obterMissao } from "@/features/missoes/queries";
import { formatarNumero } from "@/lib/format";
import { chaveDoDia, paraSeletor } from "@/lib/periodo";

export const metadata = { title: "Ações apostólicas" };

export default async function PaginaAcoesDaMissao({
  params,
  searchParams,
}: PageProps<"/missoes/[id]/acoes">) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);

  const missao = await obterMissao(id);
  if (!missao) notFound();

  const filtros = lerFiltrosDeEvento(parametros);
  const temFiltro = Boolean(
    filtros.tipoEventoId || filtros.status || filtros.destaque || filtros.de,
  );

  /* Ao contrário de /eventos, a missão vem da rota e não de `focoAtual()`:
     aqui se está dentro de uma missão nomeada na URL, e trocar o foco na barra
     lateral não muda esta lista. É o que permite abrir as ações de uma missão
     sem perder o recorte que se estava acompanhando em outra tela. */
  const [eventos, tipos] = await Promise.all([
    listarEventos({ missaoId: id, ...filtros }),
    listarTiposEvento(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {eventos.length === 0
            ? temFiltro
              ? "Nenhuma ação neste recorte."
              : "Nenhuma ação apostólica registrada."
            : `${formatarNumero(eventos.length)} ação(ões) apostólica(s).`}
        </p>
        {/* A missão já vem escolhida no formulário: /eventos/novo lê `?missao=`. */}
        <Button asChild>
          <Link href={`/eventos/novo?missao=${id}`}>
            <Plus aria-hidden />
            Nova ação
          </Link>
        </Button>
      </div>

      {/* Filtro e resultado sob a mesma área: é o que permite a lista esmaecer
          enquanto o servidor responde. A lista continua renderizada no
          servidor — chega aqui como `children`. */}
      <AreaFiltrada className="space-y-6">
        {/* `hoje` vem do servidor: os atalhos do seletor são ancorados nele, e
            o servidor renderiza em UTC enquanto o cliente está em São Paulo —
            perto da virada do dia os dois montariam atalhos diferentes para o
            mesmo HTML. */}
        <FiltrosEventos
          base={`/missoes/${id}/acoes`}
          tipos={tipos}
          periodo={paraSeletor(filtros)}
          hoje={chaveDoDia(new Date())}
        />

        <ResultadosFiltrados>
          {eventos.length === 0 ? (
            temFiltro ? (
              <EstadoVazio
                Icone={Sparkles}
                titulo="Nenhuma ação com esse recorte"
                descricao={`Nenhuma ação apostólica da ${missao.nome} corresponde à combinação escolhida. Limpe os filtros para ver todas.`}
              >
                <Button asChild variant="outline">
                  <Link href={`/missoes/${id}/acoes`}>Limpar filtros</Link>
                </Button>
              </EstadoVazio>
            ) : (
              <EstadoVazio
                Icone={Sparkles}
                titulo="Nenhuma ação apostólica"
                descricao="Cadastre a primeira ação desta missão para acompanhar participantes, servos engajados e prestação de contas."
              >
                <Button asChild>
                  <Link href={`/eventos/novo?missao=${id}`}>
                    <Plus aria-hidden />
                    Cadastrar ação
                  </Link>
                </Button>
              </EstadoVazio>
            )
          ) : (
            <div className="cascata space-y-3">
              {eventos.map((evento) => (
                <LinhaEvento
                  key={evento.id}
                  evento={evento}
                  // A missão é o contexto da tela inteira: repetir o nome em
                  // cada linha seria a mesma resposta em todas elas.
                  mostrarMissao={false}
                />
              ))}
            </div>
          )}
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
