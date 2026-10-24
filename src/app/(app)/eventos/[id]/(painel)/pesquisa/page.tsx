import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { z } from "zod";

import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { MetricaCompacta } from "@/components/padroes/metrica-compacta";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatarNps } from "@/features/eventos/impacto";
import { obterEventoCompleto } from "@/features/eventos/queries";
import {
  COMENTARIOS_POR_PAGINA,
  type PaginaDeComentarios,
} from "@/features/pesquisas/agregados";
import { BotaoAbrirPesquisa } from "@/features/pesquisas/components/acoes-pesquisa";
import { DistribuicaoNotas } from "@/features/pesquisas/components/distribuicao-notas";
import { ListaComentarios } from "@/features/pesquisas/components/lista-comentarios";
import { listarComentarios } from "@/features/pesquisas/queries";
import {
  contarComentarios,
  FAIXAS_DE_NOTA,
  type FaixaDeNota,
} from "@/features/pesquisas/satisfacao";
import {
  enderecoDosComentarios,
  lerFiltrosDeComentarios,
} from "@/features/pesquisas/schemas";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pesquisa de satisfação" };

/** Âncora da lista: trocar de página leva ao topo dela, não ao topo da tela. */
const ANCORA = "comentarios";

/**
 * A pesquisa inteira de uma ação: o resumo e todos os comentários, vinte por
 * página, filtráveis pela faixa de nota.
 *
 * O card da visão geral mostra só os cinco mais recentes — é de relance.
 * Aqui é onde o coordenador lê o que os participantes escreveram e modera um
 * por um. Filtro e página vivem na URL, como os demais filtros do sistema:
 * "os comentários de 0 a 6 desta ação" vira um link que se manda para alguém.
 */
export default async function PaginaPesquisaDaAcao({
  params,
  searchParams,
}: PageProps<"/eventos/[id]/pesquisa">) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);

  // Fora do formato, o id chegaria ao banco como comparação com coluna uuid e
  // derrubaria a página com erro de sintaxe, em vez de um 404.
  if (!z.uuid().safeParse(id).success) notFound();

  const { faixa, pagina } = lerFiltrosDeComentarios(parametros);

  const [dados, lista] = await Promise.all([
    obterEventoCompleto(id),
    listarComentarios(id, faixa, pagina),
  ]);
  if (!dados) notFound();

  const { evento, pesquisa } = dados;
  const { satisfacao } = evento;

  if (!pesquisa) {
    return (
      <EstadoVazio
        Icone={ClipboardList}
        titulo="Esta ação ainda não tem pesquisa de satisfação"
        descricao="Abra a pesquisa para gerar o link e o QR code. Os participantes respondem sem login, e as notas e os comentários aparecem aqui."
      >
        <BotaoAbrirPesquisa eventoId={id} />
      </EstadoVazio>
    );
  }

  const faixaEscolhida = FAIXAS_DE_NOTA.find((f) => f.valor === faixa);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricaCompacta
              rotulo="Média"
              valor={
                satisfacao.fonte === "pesquisa"
                  ? formatarNps(satisfacao.nota)
                  : "—"
              }
              detalhe={
                satisfacao.fonte === "pesquisa" ? "de 0 a 10" : "Sem respostas"
              }
              tom={satisfacao.fonte === "pesquisa" ? "normal" : "atenuado"}
            />
            <MetricaCompacta
              rotulo="Respostas"
              valor={String(satisfacao.respostas)}
            />
            <MetricaCompacta
              rotulo="Comentários"
              valor={String(satisfacao.comentarios)}
            />
            <MetricaCompacta
              rotulo={pesquisa.aceitaRespostas ? "Aberta até" : "Encerrada"}
              valor={formatarData(pesquisa.encerraEm)}
              tom={pesquisa.aceitaRespostas ? "normal" : "atenuado"}
            />
          </div>

          {satisfacao.respostas > 0 ? (
            <DistribuicaoNotas
              distribuicao={satisfacao.distribuicao}
              total={satisfacao.respostas}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card id={ANCORA} className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-base">Comentários</CardTitle>
          <CardDescription className="text-pretty">
            {contarComentarios(satisfacao)}. Quem só marcou a nota conta na
            média, mas não aparece nesta lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {lista.porFaixa.todas > 0 ? (
            <FiltroPorNota
              eventoId={id}
              faixa={faixa}
              porFaixa={lista.porFaixa}
            />
          ) : null}

          <ListaComentarios
            comentarios={lista.itens}
            vazio={
              faixaEscolhida
                ? `Nenhum comentário com nota de ${faixaEscolhida.rotulo}.`
                : "Nenhum comentário ainda."
            }
          />

          {lista.paginas > 1 ? (
            <Paginacao eventoId={id} faixa={faixa} lista={lista} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Links, não botões: o recorte é estado da URL, e cada opção é um endereço
 * que se abre em outra aba ou se manda para alguém. Trocar a faixa volta à
 * primeira página — a página 3 de "todas" não existe em "0 a 6".
 *
 * A opção escolhida é preenchida *e* marcada com `aria-current`: o
 * preenchimento é forma, não só matiz, e o leitor de tela ouve qual está
 * ativa.
 */
function FiltroPorNota({
  eventoId,
  faixa,
  porFaixa,
}: {
  eventoId: string;
  faixa: FaixaDeNota | null;
  porFaixa: PaginaDeComentarios["porFaixa"];
}) {
  const opcoes = [
    { valor: null, rotulo: "Todas as notas", quantidade: porFaixa.todas },
    ...FAIXAS_DE_NOTA.map((f) => ({
      valor: f.valor,
      rotulo: f.rotulo,
      quantidade: porFaixa[f.valor],
    })),
  ];

  return (
    <nav aria-label="Filtrar comentários por nota" className="flex flex-wrap gap-2">
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === faixa;
        return (
          <Link
            key={opcao.valor ?? "todas"}
            href={enderecoDosComentarios(eventoId, opcao.valor)}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors active:translate-y-px",
              ativa
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-background text-foreground hover:bg-muted",
            )}
          >
            {opcao.rotulo}
            <span
              className={cn(
                "tabular-nums",
                ativa ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {opcao.quantidade}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Paginacao({
  eventoId,
  faixa,
  lista,
}: {
  eventoId: string;
  faixa: FaixaDeNota | null;
  lista: PaginaDeComentarios;
}) {
  const { pagina, paginas, total, itens } = lista;
  const primeiro = (pagina - 1) * COMENTARIOS_POR_PAGINA + 1;
  const ultimo = primeiro + itens.length - 1;
  const endereco = (n: number) =>
    `${enderecoDosComentarios(eventoId, faixa, n)}#${ANCORA}`;

  return (
    <nav
      aria-label="Páginas de comentários"
      className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
    >
      {pagina > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={endereco(pagina - 1)} rel="prev">
            <ChevronLeft aria-hidden />
            Anterior
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden />
          Anterior
        </Button>
      )}

      <p className="text-muted-foreground text-sm tabular-nums">
        Página {pagina} de {paginas}
        <span className="hidden sm:inline">
          {" "}
          · {primeiro} a {ultimo} de {total}
        </span>
      </p>

      {pagina < paginas ? (
        <Button asChild variant="outline" size="sm">
          <Link href={endereco(pagina + 1)} rel="next">
            Próxima
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Próxima
          <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
