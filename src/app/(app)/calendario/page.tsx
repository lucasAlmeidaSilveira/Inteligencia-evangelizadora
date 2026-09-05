import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { CalendarioMensal } from "@/features/painel/components/calendario-mensal";
import { obterEventosDoPeriodo } from "@/features/painel/queries";
import { listarTiposEvento } from "@/features/eventos/queries";

export const metadata = { title: "Calendário" };

/** O mês vem da URL, não de estado: o recorte é compartilhável e volta com o
 *  botão do navegador. */
function mesDaUrl(valor: unknown) {
  if (typeof valor === "string" && /^\d{4}-\d{2}$/.test(valor)) {
    const [ano, mes] = valor.split("-").map(Number);
    return new Date(ano, mes - 1, 1);
  }
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

const paraParametro = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

export default async function PaginaCalendario({
  searchParams,
}: PageProps<"/calendario">) {
  const parametros = await searchParams;
  const mes = mesDaUrl(parametros.mes);

  const anterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);
  const proximo = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);

  // Busca uma semana a mais de cada lado: a grade mostra dias vizinhos, e um
  // evento que começa no fim do mês anterior precisa aparecer neles.
  const de = new Date(mes.getFullYear(), mes.getMonth(), -7);
  const ate = new Date(mes.getFullYear(), mes.getMonth() + 1, 7, 23, 59, 59);

  const [eventos, tipos] = await Promise.all([
    obterEventosDoPeriodo(de, ate),
    listarTiposEvento(),
  ]);

  const noMes = eventos.filter(
    (e) =>
      new Date(e.dataInicio) <= new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59) &&
      new Date(e.dataFim) >= mes,
  );

  const titulo = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(mes);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CabecalhoPagina
        titulo="Calendário"
        descricao={`${noMes.length} ${noMes.length === 1 ? "ação apostólica" : "ações apostólicas"} em ${titulo}.`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon">
            <Link
              href={`/calendario?mes=${paraParametro(anterior)}`}
              aria-label="Mês anterior"
            >
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/calendario">Hoje</Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link
              href={`/calendario?mes=${paraParametro(proximo)}`}
              aria-label="Próximo mês"
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </CabecalhoPagina>

      <h2 className="text-lg font-medium capitalize">{titulo}</h2>

      <CalendarioMensal mes={mes} eventos={eventos} />

      {tipos.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-4">
          {tipos.map((tipo) => (
            <span
              key={tipo.id}
              className="text-muted-foreground flex items-center gap-1.5 text-xs"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: tipo.cor }}
              />
              {tipo.nome}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
