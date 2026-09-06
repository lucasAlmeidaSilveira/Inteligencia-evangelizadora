import Link from "next/link";
import { UsersRound } from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { centrosParaFiltro } from "@/features/centros/queries";
import { missoesDisponiveis } from "@/features/eventos/queries";
import { LinhaGrupo } from "@/features/grupos/components/linha-grupo";
import { listarGruposVisiveis } from "@/features/grupos/queries";
import { lerFiltrosDeGrupos } from "@/features/grupos/schemas";
import { formatarNumero } from "@/lib/format";

import { FiltrosGruposGerais } from "./filtros";

export const metadata = { title: "Grupos de oração" };

export default async function PaginaGrupos({
  searchParams,
}: PageProps<"/grupos">) {
  const parametros = await searchParams;
  const filtros = lerFiltrosDeGrupos(parametros);

  const [grupos, missoes, centros] = await Promise.all([
    listarGruposVisiveis(filtros),
    missoesDisponiveis(),
    centrosParaFiltro(),
  ]);

  const temFiltro = Boolean(filtros.missaoId || filtros.centroId);
  const mostrarMissao = !filtros.missaoId && missoes.length > 1;

  // Somadas sobre o recorte em tela: um total que ignorasse o filtro
  // contradiria a lista logo abaixo dele.
  const pessoas = grupos.reduce((soma, g) => soma + g.quantidadePessoas, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Grupos de oração"
        descricao="Os grupos de todas as missões que você acompanha. O cadastro de cada um fica na missão a que ele pertence."
      />

      <AreaFiltrada className="space-y-6">
        <FiltrosGruposGerais missoes={missoes} centros={centros} />

        <ResultadosFiltrados className="space-y-3">
          {grupos.length === 0 ? (
            temFiltro ? (
              <EstadoVazio
                Icone={UsersRound}
                titulo="Nenhum grupo com esse recorte"
                descricao="Nenhum grupo de oração corresponde à combinação escolhida. Limpe os filtros para ver todos."
              >
                <Button asChild variant="outline">
                  <Link href="/grupos">Limpar filtros</Link>
                </Button>
              </EstadoVazio>
            ) : (
              <EstadoVazio
                Icone={UsersRound}
                titulo="Nenhum grupo de oração"
                descricao="Cadastre os grupos dentro da missão a que eles pertencem, com seus pastores. O total de pessoas reunidas passa a aparecer nos indicadores."
              >
                <Button asChild variant="outline">
                  <Link href="/missoes">Ir para missões</Link>
                </Button>
              </EstadoVazio>
            )
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {formatarNumero(grupos.length)}{" "}
                {grupos.length === 1 ? "grupo" : "grupos"} reunindo{" "}
                {formatarNumero(pessoas)} pessoas.
              </p>
              <div className="cascata space-y-3">
                {grupos.map((grupo) => (
                  <LinhaGrupo
                    key={grupo.id}
                    grupo={grupo}
                    mostrarMissao={mostrarMissao}
                  />
                ))}
              </div>
            </>
          )}
        </ResultadosFiltrados>
      </AreaFiltrada>
    </div>
  );
}
