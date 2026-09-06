import { focoAtual } from "@/features/missoes/foco";
import { nomeDoArquivo, relatorioParaCsv } from "@/features/relatorios/csv";
import { lerFiltros } from "@/features/relatorios/filtros";
import { gerarRelatorio } from "@/features/relatorios/queries";

/**
 * Exportação em CSV.
 *
 * Passa pela mesma consulta da tela, que por sua vez passa pelo RLS: o arquivo
 * nunca contém missão que o usuário não poderia ver na interface. O foco é
 * lido aqui pelo mesmo caminho que a página usa — o cookie viaja no pedido do
 * arquivo, então o recorte do CSV é o da tela sem depender do link.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parametros = Object.fromEntries(url.searchParams.entries());
  const foco = await focoAtual();

  const relatorio = await gerarRelatorio(lerFiltros(parametros, foco.missaoId));
  const csv = relatorioParaCsv(relatorio);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(relatorio)}"`,
      "Cache-Control": "no-store",
    },
  });
}
