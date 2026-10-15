import { focoAtual } from "@/features/missoes/foco";
import {
  lerFiltrosAnuais,
  montarRelatorioAnual,
  nomeDoArquivoAnual,
  relatorioAnualParaCsv,
} from "@/features/relatorios/anual";
import { listarAcoesDoAno } from "@/features/relatorios/queries-anual";
import { diaNoFuso } from "@/lib/fuso";

/**
 * O relatório anual em CSV.
 *
 * Mesma consulta, mesmo foco e mesma montagem da tela: o arquivo nunca tem uma
 * ação que a página não mostrou, nem deixa de ter uma que ela mostrou. E passa
 * pelo RLS como ela, então nunca contém missão que o usuário não poderia ver.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parametros = Object.fromEntries(url.searchParams.entries());
  const foco = await focoAtual();

  const hoje = diaNoFuso(new Date());
  const filtros = lerFiltrosAnuais(
    parametros,
    Number(hoje.slice(0, 4)),
    foco.missaoId,
  );
  const relatorio = montarRelatorioAnual(
    await listarAcoesDoAno(filtros),
    filtros.ano,
    hoje,
  );

  return new Response(relatorioAnualParaCsv(relatorio, foco.missaoNome), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivoAnual(relatorio)}"`,
      "Cache-Control": "no-store",
    },
  });
}
