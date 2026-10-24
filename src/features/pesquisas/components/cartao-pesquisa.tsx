import { ClipboardList } from "lucide-react";
import QRCode from "qrcode";

import { MetricaCompacta } from "@/components/padroes/metrica-compacta";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatarNps } from "@/features/eventos/impacto";
import { formatarData } from "@/lib/format";

import type { ComentarioDaPesquisa, PesquisaDoEvento } from "../queries";
import {
  contarRespostas,
  fraseDeLeitura,
  type Satisfacao,
} from "../satisfacao";
import {
  AcoesPesquisaAberta,
  BotaoAbrirPesquisa,
  BotaoReabrirPesquisa,
  BotaoReiniciarPesquisa,
} from "./acoes-pesquisa";
import { DistribuicaoNotas } from "./distribuicao-notas";
import { ListaComentarios } from "./lista-comentarios";

/**
 * A pesquisa de satisfação de uma ação, do ponto de vista do coordenador.
 *
 * `Card` comum, não `CartaoEditavel`: não há modo de edição — é leitura mais
 * ações. Server Component de propósito: o QR é gerado aqui, no servidor, e vai
 * como `data:` URL numa `<img>`; nenhum HTML montado à mão entra na página.
 *
 * Três estados: sem pesquisa, aberta, encerrada (por botão ou por prazo).
 */
export async function CartaoPesquisa({
  eventoId,
  pesquisa,
  satisfacao,
  comentarios,
  base,
}: {
  eventoId: string;
  pesquisa: PesquisaDoEvento | null;
  satisfacao: Satisfacao;
  comentarios: ComentarioDaPesquisa[];
  /** Origem pública (`urlPublica()`); `null` quando não configurada. */
  base: string | null;
}) {
  const link =
    pesquisa && pesquisa.aceitaRespostas && base
      ? `${base}/pesquisa/${pesquisa.token}`
      : null;
  const qr = link
    ? await QRCode.toDataURL(link, {
        width: 512,
        margin: 1,
        errorCorrectionLevel: "M",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="text-muted-foreground size-4" aria-hidden />
          Pesquisa de satisfação
        </CardTitle>
        <CardAction>
          {pesquisa ? (
            pesquisa.aceitaRespostas ? (
              <Badge
                variant="outline"
                className="bg-success/10 text-success border-success/25"
              >
                Aberta até {formatarData(pesquisa.encerraEm)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground border-border"
              >
                Encerrada
              </Badge>
            )
          ) : null}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {!pesquisa ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm text-pretty">
              Gere um link e um QR code para os participantes avaliarem a ação
              de 0 a 10, sem login. A média entra na satisfação e no índice de
              impacto desta ação.
            </p>
            <BotaoAbrirPesquisa eventoId={eventoId} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricaCompacta
                rotulo="Média"
                valor={
                  satisfacao.fonte === "pesquisa"
                    ? formatarNps(satisfacao.nota)
                    : "—"
                }
                detalhe={satisfacao.fonte === "pesquisa" ? "de 0 a 10" : "Sem respostas"}
                tom={satisfacao.fonte === "pesquisa" ? "normal" : "atenuado"}
              />
              <MetricaCompacta
                rotulo="Respostas"
                valor={String(satisfacao.respostas)}
                detalhe={fraseDeLeitura(satisfacao) ?? undefined}
              />
              <MetricaCompacta
                rotulo={pesquisa.aceitaRespostas ? "Encerra em" : "Encerrada"}
                valor={formatarData(pesquisa.encerraEm)}
                detalhe={
                  pesquisa.aceitaRespostas
                    ? "Reabrir estende por 14 dias"
                    : undefined
                }
                tom={pesquisa.aceitaRespostas ? "normal" : "atenuado"}
              />
            </div>

            {satisfacao.respostas > 0 ? (
              <DistribuicaoNotas
                distribuicao={satisfacao.distribuicao}
                total={satisfacao.respostas}
              />
            ) : null}

            {pesquisa.aceitaRespostas ? (
              <div className="space-y-3 border-t pt-4">
                {link ? (
                  <div className="bg-muted rounded-md border p-3">
                    <p className="font-mono text-xs break-all">{link}</p>
                  </div>
                ) : (
                  <p className="text-destructive text-sm text-pretty">
                    O endereço público do sistema não está configurado. Defina
                    a variável <code className="font-mono">APP_URL</code> para
                    gerar o link e o QR code.
                  </p>
                )}
                <AcoesPesquisaAberta eventoId={eventoId} link={link} qr={qr} />
                <p className="text-muted-foreground text-xs text-pretty">
                  O título da ação aparece na página pública. A pesquisa é
                  anônima e aceita mais de uma resposta por pessoa.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-muted-foreground text-sm">
                  O link não aceita mais respostas.
                </p>
                <BotaoReabrirPesquisa eventoId={eventoId} />
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Comentários recentes
                  {satisfacao.respostas > 0
                    ? ` · ${contarRespostas(satisfacao.respostas)} no total`
                    : ""}
                </p>
                {satisfacao.respostas > 0 ? (
                  <BotaoReiniciarPesquisa
                    eventoId={eventoId}
                    respostas={satisfacao.respostas}
                  />
                ) : null}
              </div>
              <ListaComentarios comentarios={comentarios} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
