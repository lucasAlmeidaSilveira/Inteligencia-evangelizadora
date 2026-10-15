import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Star } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { CalendarioMensal } from "@/features/painel/components/calendario-mensal";
import { diasDaAcao, rotuloDoMes, tocaOMes } from "@/features/painel/grade";
import { obterEventosDoPeriodo } from "@/features/painel/queries";
import { listarTiposEvento } from "@/features/eventos/queries";
import { focoAtual } from "@/features/missoes/foco";
import { diaNoFuso } from "@/lib/fuso";
import { deslocarMes, lerChaveDeMes } from "@/lib/mes";

export const metadata = { title: "Calendário" };

export default async function PaginaCalendario({
  searchParams,
}: PageProps<"/calendario">) {
  const parametros = await searchParams;

  /* O mês vem da URL, não de estado: o recorte é compartilhável e volta com o
     botão do navegador. Fica como chave até a grade — ver `lib/fuso.ts` —, e o
     mês corrente é o de São Paulo: no servidor em UTC, a partir das 21h do
     último dia `new Date()` já estaria no mês seguinte. */
  const hoje = diaNoFuso(new Date());
  const mes = lerChaveDeMes(parametros.mes) ?? hoje.slice(0, 7);
  const [ano, numero] = mes.split("-").map(Number);

  /* Sem filtro de situação nem de data relativa a hoje: ação realizada, em
     andamento ou cancelada aparece no dia em que aconteceu, para sempre. O
     calendário é também o histórico — é nele que o coordenador volta a 6 de
     setembro para achar o seminário daquele domingo.

     Busca uma semana a mais de cada lado: a grade mostra dias vizinhos, e um
     evento que começa no fim do mês anterior precisa aparecer neles. A folga
     também cobre o fuso — os limites saem em UTC e a grade é de São Paulo,
     três horas atrás —, e é em `Date.UTC` para a chave do cache ser a mesma em
     qualquer servidor. */
  const de = new Date(Date.UTC(ano, numero - 1, -7));
  const ate = new Date(Date.UTC(ano, numero, 7, 23, 59, 59, 999));

  const foco = await focoAtual();

  const [eventos, tipos] = await Promise.all([
    obterEventosDoPeriodo(de, ate, foco.missaoId),
    listarTiposEvento(),
  ]);

  // A contagem usa o mesmo critério da grade, por dia em São Paulo: o número
  // no cabeçalho e as ações desenhadas não podem discordar na virada do mês.
  const noMes = eventos.map(diasDaAcao).filter((e) => tocaOMes(e, mes));
  const titulo = rotuloDoMes(mes);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CabecalhoPagina
        titulo="Calendário"
        descricao={`${noMes.length} ${noMes.length === 1 ? "ação apostólica" : "ações apostólicas"} em ${titulo}${foco.missaoNome ? ` · ${foco.missaoNome}` : ""}.`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon">
            <Link
              href={`/calendario?mes=${deslocarMes(mes, -1)}`}
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
              href={`/calendario?mes=${deslocarMes(mes, 1)}`}
              aria-label="Próximo mês"
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </CabecalhoPagina>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium capitalize">{titulo}</h2>
        {/* O ano do mês exibido, não o corrente: quem folheia 2025 e quer a
            lista daquele ano não deveria cair em 2026. Ao lado do título, e
            não com a navegação, porque é saída para outra tela — e porque no
            celular a fileira de cima não comporta mais um botão. */}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/relatorios/anual?ano=${ano}`}>
            <ClipboardList aria-hidden />
            Relatório de {ano}
          </Link>
        </Button>
      </div>

      <CalendarioMensal mes={mes} hoje={hoje} eventos={eventos} />

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
          {/* A estrela entra na legenda como os tipos: quem vê o símbolo na
              grade precisa achar o que ele quer dizer sem abrir a ação. */}
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Star className="text-laranja size-2.5 fill-current" aria-hidden />
            Destaque regional
          </span>
        </div>
      ) : null}
    </div>
  );
}
