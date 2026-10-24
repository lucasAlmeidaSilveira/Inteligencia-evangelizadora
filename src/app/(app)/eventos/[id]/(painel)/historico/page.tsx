import { notFound } from "next/navigation";
import { z } from "zod";

import { PainelHistorico } from "@/features/eventos/components/painel-historico";
import {
  listarHistorico,
  obterEventoCompleto,
} from "@/features/eventos/queries";

export const metadata = { title: "Histórico" };

export default async function PaginaHistorico({
  params,
}: PageProps<"/eventos/[id]/historico">) {
  const { id } = await params;

  // Fora do formato, o id chegaria ao banco como comparação com coluna uuid e
  // derrubaria a página com erro de sintaxe, em vez de um 404.
  if (!z.uuid().safeParse(id).success) notFound();

  /* `obterEventoCompleto` é a mesma chamada do layout — o `cache` do React a
     devolve sem nova transação. Aqui ela serve ao 404 e ao `criadoEm`, que
     fecha a linha do tempo das ações anteriores ao histórico. */
  const [dados, entradas] = await Promise.all([
    obterEventoCompleto(id),
    listarHistorico(id),
  ]);
  if (!dados) notFound();

  return (
    <PainelHistorico entradas={entradas} criadoEm={dados.evento.criadoEm} />
  );
}
