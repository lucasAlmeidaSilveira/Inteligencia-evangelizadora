import Link from "next/link";
import { Waypoints } from "lucide-react";

import {
  AreaFiltrada,
  ResultadosFiltrados,
} from "@/components/padroes/area-filtrada";
import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { Button } from "@/components/ui/button";
import { LinhaCentro } from "@/features/centros/components/linha-centro";
import { listarCentrosVisiveis } from "@/features/centros/queries";
import { lerFiltrosDeCentros } from "@/features/centros/schemas";
import { missoesDisponiveis } from "@/features/eventos/queries";
import { formatarNumero } from "@/lib/format";

import { FiltrosCentros } from "./filtros";

export const metadata = { title: "Centros de evangelização" };

export default async function PaginaCentros({
  searchParams,
}: PageProps<"/centros">) {
  const parametros = await searchParams;
  const filtros = lerFiltrosDeCentros(parametros);

  const [centros, missoes] = await Promise.all([
    listarCentrosVisiveis(filtros),
    missoesDisponiveis(),
  ]);

  const temFiltro = Boolean(filtros.missaoId || filtros.tipo);
  // Com uma missão escolhida a coluna repetiria a mesma resposta em todas as
  // linhas; com uma só missão visível, idem.
  const mostrarMissao = !filtros.missaoId && missoes.length > 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Centros de evangelização"
        descricao="Os centros e irradiações de todas as missões que você acompanha. O cadastro de cada um fica na missão a que ele pertence."
      />

      {/* Filtro e resultado sob a mesma área: é o que permite a lista esmaecer
          enquanto o servidor responde. A lista continua renderizada no
          servidor — chega aqui como `children`. */}
      <AreaFiltrada className="space-y-6">
        <FiltrosCentros missoes={missoes} />

        <ResultadosFiltrados className="space-y-3">
          {centros.length === 0 ? (
            temFiltro ? (
              <EstadoVazio
                Icone={Waypoints}
                titulo="Nenhum centro com esse recorte"
                descricao="Nenhum centro de evangelização corresponde à combinação escolhida. Limpe os filtros para ver todos."
              >
                <Button asChild variant="outline">
                  <Link href="/centros">Limpar filtros</Link>
                </Button>
              </EstadoVazio>
            ) : (
              <EstadoVazio
                Icone={Waypoints}
                titulo="Nenhum centro de evangelização"
                descricao="Toda missão tem ao menos o centro principal. Cadastre os demais dentro da missão a que eles pertencem."
              >
                <Button asChild variant="outline">
                  <Link href="/missoes">Ir para missões</Link>
                </Button>
              </EstadoVazio>
            )
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {formatarNumero(centros.length)}{" "}
                {centros.length === 1 ? "centro" : "centros"}.
              </p>
              <div className="cascata space-y-3">
                {centros.map((centro) => (
                  <LinhaCentro
                    key={centro.id}
                    centro={centro}
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
