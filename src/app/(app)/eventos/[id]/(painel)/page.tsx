import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Link2 } from "lucide-react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centrosDasMissoesVisiveis } from "@/features/centros/queries";
import { CartaoFinanceiro } from "@/features/eventos/components/cartao-financeiro";
import { CartaoInformacoes } from "@/features/eventos/components/cartao-informacoes";
import { CartaoParticipacao } from "@/features/eventos/components/cartao-participacao";
import { CartaoTextos } from "@/features/eventos/components/cartao-textos";
import {
  listarTiposEvento,
  obterEventoCompleto,
} from "@/features/eventos/queries";
import { AcoesDocumento } from "@/features/eventos/components/acoes-documento";
import { formatarData, formatarTamanhoArquivo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Quantos itens de documento e link cabem antes de virar ruído. */
const PREVIA = 4;

export default async function PaginaVisaoGeralEvento({
  params,
}: PageProps<"/eventos/[id]">) {
  const { id } = await params;

  /* A mesma chamada que o layout já fez — o `cache` do React devolve o
     resultado sem nova transação. É o que torna os blocos de documentos e
     links abaixo gratuitos: os dados já estavam aqui.

     Tipos e centros vêm por causa da edição em tela: os dois selects do card
     de informações precisam das opções. Ambas as listas são cacheadas e
     compartilhadas com o formulário de /editar. */
  const [dados, tipos, centros] = await Promise.all([
    obterEventoCompleto(id),
    listarTiposEvento(),
    centrosDasMissoesVisiveis(),
  ]);
  if (!dados) notFound();

  const { evento, documentos, links } = dados;

  /* Só os centros desta missão: a FK composta `(centro_id, missao_id)` recusa
     os de outra, e oferecê-los no select seria oferecer um erro. O centro da
     própria ação entra mesmo se estiver arquivado e fora da lista — sem isso
     o select abriria vazio e trocaria o centro sem ninguém pedir. */
  const centrosDaMissao = centros.filter((c) => c.missaoId === evento.missaoId);
  const centrosDisponiveis = centrosDaMissao.some(
    (c) => c.id === evento.centroId,
  )
    ? centrosDaMissao
    : [
        ...centrosDaMissao,
        {
          id: evento.centroId,
          nome: `${evento.centroNome} (inativo)`,
          principal: false,
        },
      ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoInformacoes
          eventoId={evento.id}
          className="lg:col-span-1"
          tipos={tipos}
          centros={centrosDisponiveis}
          informacoes={{
            centroId: evento.centroId,
            centroNome: evento.centroNome,
            centroTipo: evento.centroTipo,
            tipoEventoId: evento.tipoEventoId,
            tipoNome: evento.tipoNome,
            tipoCor: evento.tipoCor,
            missaoId: evento.missaoId,
            missaoNome: evento.missaoNome,
            dataInicio: evento.dataInicio,
            dataFim: evento.dataFim,
            local: evento.local,
            endereco: evento.endereco,
            responsavelNome: evento.responsavelNome,
            status: evento.status,
            criadoEm: evento.criadoEm,
            atualizadoEm: evento.atualizadoEm,
          }}
        />

        <div className="space-y-4 lg:col-span-2">
          <CartaoParticipacao
            eventoId={evento.id}
            valores={{
              participantesInscritos: evento.participantesInscritos,
              participantesTotal: evento.participantesTotal,
              participantesNovos: evento.participantesNovos,
              participantesPermaneceram: evento.participantesPermaneceram,
              servosEngajados: evento.servosEngajados,
            }}
          />

          <CartaoFinanceiro
            eventoId={evento.id}
            orcamentoPrevisto={evento.orcamentoPrevisto}
            financeiro={evento.financeiro}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mesmo idioma de cartão clicável do CartaoMetrica e da LinhaEvento:
            anel aceso mais 2px de elevação, escrito por extenso porque o
            Tailwind varre o código como texto e não geraria as regras a partir
            de um nome montado. O `relative` ancora o link que cobre o cartão. */}
        <Card className="hover:ring-primary/40 focus-within:ring-primary/40 relative transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 active:translate-y-0">
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
            {/* O atalho agora aparece sempre, não só acima de PREVIA: era ele
                o único caminho para a aba, e com 1 a 4 arquivos — o caso comum —
                o cartão não tinha saída nenhuma. É também o link que cobre o
                cartão inteiro, e o único do cabeçalho: o leitor de tela anuncia
                "Ver todos (3)", que diz para onde se vai, e não "Documentos". */}
            <CardAction>
              <AtalhoAba href={`/eventos/${evento.id}/documentos`} cobreOCartao>
                {documentos.length > 0
                  ? `Ver todos (${documentos.length})`
                  : "Anexar"}
              </AtalhoAba>
            </CardAction>
          </CardHeader>
          <CardContent>
            {documentos.length === 0 ? (
              /* Sem link próprio: o cartão inteiro já leva à aba, e um segundo
                 `<a>` por cima do overlay só duplicaria a parada do teclado. */
              <ListaVazia Icone={FileText} texto="Nenhum documento anexado." />
            ) : (
              <ul className="space-y-3">
                {documentos.slice(0, PREVIA).map((documento) => (
                  <li
                    key={documento.id}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <FileText
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{documento.nome}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatarTamanhoArquivo(documento.tamanhoBytes)} ·{" "}
                        {formatarData(documento.criadoEm)}
                      </p>
                    </div>
                    {/* `relative` só no grupo de botões, nunca no `<li>` todo:
                        é o que os faz pintar acima do overlay do link e receber
                        o clique. No item inteiro, clicar no nome do arquivo
                        deixaria de levar à aba. Sem ele, os botões ficam por
                        baixo do overlay e param de funcionar — falha silenciosa
                        que nenhum teste pega. */}
                    <div className="relative flex shrink-0 items-center gap-0.5">
                      <AcoesDocumento documento={documento} tamanho="icon-sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links úteis</CardTitle>
            {links.length > PREVIA ? (
              <CardAction>
                <AtalhoAba href={`/eventos/${evento.id}/links`}>
                  Ver todos ({links.length})
                </AtalhoAba>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <ListaVazia
                Icone={Link2}
                texto="Nenhum link cadastrado."
                href={`/eventos/${evento.id}/links`}
                acao="Adicionar"
              />
            ) : (
              <ul className="space-y-3">
                {links.slice(0, PREVIA).map((link) => (
                  <li key={link.id} className="flex gap-2.5 text-sm">
                    <Link2
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate rounded-sm underline-offset-4 hover:underline"
                      >
                        {link.titulo}
                      </a>
                      <p className="text-muted-foreground truncate text-xs">
                        {link.descricao ?? link.url}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CartaoTextos
        eventoId={evento.id}
        descricao={evento.descricao}
        observacoes={evento.observacoes}
      />
    </div>
  );
}

function AtalhoAba({
  href,
  children,
  cobreOCartao = false,
}: {
  href: string;
  children: React.ReactNode;
  /** Estende a área de clique ao cartão inteiro. Exige `relative` no `Card`. */
  cobreOCartao?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-primary flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline",
        cobreOCartao && "after:absolute after:inset-0",
      )}
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * Vazio dentro de card, não `EstadoVazio` — aquele é um card inteiro com 56px
 * de respiro, e aqui já estamos dentro de um. Mesma ideia, escala menor.
 */
function ListaVazia({
  Icone,
  texto,
  href,
  acao,
}: {
  Icone: typeof FileText;
  texto: string;
  /** Omitidos quando o próprio cartão já é o link — dois `<a>` para o mesmo
   *  destino seriam duas paradas de teclado dizendo a mesma coisa. */
  href?: string;
  acao?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <span className="bg-muted flex size-9 items-center justify-center rounded-full">
        <Icone className="text-muted-foreground size-4" aria-hidden />
      </span>
      <p className="text-muted-foreground text-sm">{texto}</p>
      {href && acao ? (
        <Link
          href={href}
          className="text-primary rounded-sm text-sm font-medium underline-offset-4 hover:underline"
        >
          {acao}
        </Link>
      ) : null}
    </div>
  );
}
