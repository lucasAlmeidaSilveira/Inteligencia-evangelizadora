import { notFound } from "next/navigation";

import { centrosParaSelecao } from "@/features/centros/queries";
import { lerFiltroDeCentro } from "@/features/centros/schemas";
import { ListaGrupos } from "@/features/grupos/components/lista-grupos";
import { listarGrupos } from "@/features/grupos/queries";
import { contagemVencida } from "@/features/lembretes/regras";
import { obterMissao } from "@/features/missoes/queries";

export const metadata = { title: "Grupos de oração" };

export default async function PaginaGrupos({
  params,
  searchParams,
}: PageProps<"/missoes/[id]/grupos">) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);

  const missao = await obterMissao(id);
  if (!missao) notFound();

  const centroFiltrado = lerFiltroDeCentro(parametros.centro);
  // Os dois parâmetros do lembrete: um grupo específico para contar agora, ou
  // o recorte "só os vencidos" quando o aviso falava de vários.
  const grupoParaContar = lerUuid(parametros.grupo);
  const apenasPendentes = parametros.contagem === "pendente";

  // Uma consulta só, com os inativos: o filtro precisa deles, e o diálogo
  // recebe abaixo apenas o subconjunto ativo — centro arquivado não recebe
  // vínculo novo.
  const [todos, centros] = await Promise.all([
    listarGrupos(id, { centroId: centroFiltrado }),
    centrosParaSelecao(id, true),
  ]);

  // Recorte feito aqui, sobre a consulta cacheada por missão, e não dentro
  // dela: "vencido" depende do relógio, e uma chave de cache que dependesse de
  // hoje nunca acertaria. A regra é a mesma que dispara o lembrete.
  const grupos = apenasPendentes
    ? todos.filter((g) => g.ativo && contagemVencida(g.ultimaContagemEm))
    : todos;

  return (
    <ListaGrupos
      missaoId={id}
      centros={centros}
      grupos={grupos}
      filtrado={Boolean(centroFiltrado)}
      apenasPendentes={apenasPendentes}
      grupoParaContar={grupoParaContar}
    />
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parâmetro de URL é texto de fora: só vira id se tiver forma de id. */
function lerUuid(valor: string | string[] | undefined) {
  return typeof valor === "string" && UUID.test(valor) ? valor : undefined;
}
