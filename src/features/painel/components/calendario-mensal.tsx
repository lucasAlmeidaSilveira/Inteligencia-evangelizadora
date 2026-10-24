"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import * as m from "motion/react-m";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  rotuloDoStatus,
  SeloStatus,
} from "@/features/eventos/components/selo-status";
import { formatarPeriodo } from "@/lib/format";
import { CURVA, DURACAO } from "@/lib/movimento";
import { cn } from "@/lib/utils";

import { diasDaAcao, diasDaGrade, ocorreNoDia, rotuloDoDia } from "../grade";
import type { EventoAgenda } from "../queries";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAXIMO_VISIVEL = 3;

export function CalendarioMensal({
  mes,
  hoje,
  eventos,
}: {
  /** O mês exibido, como `"2026-09"`. Chave e não `Date`: ver `lib/fuso.ts`. */
  mes: string;
  /** Hoje em São Paulo, como `"2026-10-14"`. Vem do servidor pelo mesmo
   *  motivo dos atalhos de período: perto da meia-noite, servidor e navegador
   *  discordariam sobre qual célula acender. */
  hoje: string;
  eventos: EventoAgenda[];
}) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  /*
   * Direção da viagem entre meses.
   *
   * O título muda mas a forma da grade é idêntica, então entrar pelo lado
   * certo é a única pista de que se avançou ou voltou. A direção sai da
   * comparação entre o mês novo e o anterior, e não de qual botão foi clicado:
   * o botão voltar do navegador também troca o mês. Chaves `"AAAA-MM"` se
   * comparam como texto na ordem do calendário.
   *
   * Estado ajustado durante a renderização, que é o padrão para "valor
   * anterior" — em efeito, isto seria o antipadrão `set-state-in-effect` que a
   * barra de progresso também evita.
   *
   * `0` é a primeira renderização e vale "sem animação": com `initial={false}`
   * a Motion não escreve `opacity: 0` no HTML do servidor, e a grade aparece
   * mesmo que o JavaScript não chegue.
   */
  const [mesAnterior, setMesAnterior] = useState(mes);
  const [direcao, setDirecao] = useState(0);

  if (mes !== mesAnterior) {
    setDirecao(mes > mesAnterior ? 1 : -1);
    setMesAnterior(mes);
  }

  const dias = diasDaGrade(mes);

  // O dia de cada ação se calcula uma vez, não a cada uma das 42 células.
  const comDias = eventos.map(diasDaAcao);
  const doDia = (chave: string) => comDias.filter((e) => ocorreNoDia(e, chave));
  const eventosAbertos = diaAberto ? doDia(diaAberto) : [];

  return (
    <>
      {/* A grade inteira entra, nunca célula por célula: 42 células escalonadas
          viram uma onda atravessando a tela. */}
      <m.div
        key={mes}
        initial={direcao === 0 ? false : { opacity: 0, x: 8 * direcao }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURACAO.chegada, ease: CURVA.chegada }}
        className="overflow-hidden rounded-lg border"
      >
        <div className="bg-muted/40 grid grid-cols-7 border-b">
          {DIAS.map((dia) => (
            <div
              key={dia}
              className="text-muted-foreground px-2 py-2 text-center text-xs font-medium capitalize"
            >
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const ehHoje = dia.chave === hoje;
            const lista = doDia(dia.chave);
            const visiveis = lista.slice(0, MAXIMO_VISIVEL);
            const restantes = lista.length - visiveis.length;

            return (
              <div
                key={dia.chave}
                className={cn(
                  "min-h-24 border-r border-b p-1.5 last:border-r-0 sm:min-h-28",
                  !dia.doMes && "bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => lista.length > 0 && setDiaAberto(dia.chave)}
                  disabled={lista.length === 0}
                  aria-label={`${dia.numero} — ${lista.length} ação(ões)`}
                  className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                    lista.length > 0 && "hover:bg-accent cursor-pointer",
                    ehHoje && "bg-primary text-primary-foreground font-semibold",
                    !ehHoje && !dia.doMes && "text-muted-foreground/60",
                    !ehHoje && dia.doMes && "text-foreground",
                  )}
                >
                  {dia.numero}
                </button>

                <div className="space-y-1">
                  {visiveis.map((evento) => (
                    <Tooltip key={evento.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/eventos/${evento.id}`}
                          className="hover:bg-accent flex items-center gap-1 rounded px-1 py-0.5 text-left"
                        >
                          {/* A cor identifica o tipo, mas o título vem junto —
                              identidade nunca depende só de matiz. */}
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: evento.tipoCor }}
                          />
                          <span
                            className={cn(
                              "truncate text-[11px] leading-tight",
                              evento.status === "cancelado" &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {evento.titulo}
                          </span>
                          {/* A estrela, e não só o laranja, é o que distingue o
                              destaque — e ela fica depois da data passar: a
                              ação realizada é a que o regional consolida. Fica
                              no fim da linha para o título truncar antes
                              dela. */}
                          {evento.destaqueRegional ? (
                            <>
                              <Star
                                aria-hidden
                                className="text-laranja size-2.5 shrink-0 fill-current"
                              />
                              <span className="sr-only">
                                (destaque regional)
                              </span>
                            </>
                          ) : null}
                        </Link>
                      </TooltipTrigger>
                      <ResumoDaAcao evento={evento} />
                    </Tooltip>
                  ))}

                  {restantes > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDiaAberto(dia.chave)}
                      className="text-muted-foreground hover:text-foreground w-full cursor-pointer px-1 text-left text-[11px]"
                    >
                      +{restantes} {restantes === 1 ? "outra" : "outras"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </m.div>

      <Dialog
        open={Boolean(diaAberto)}
        onOpenChange={(v) => !v && setDiaAberto(null)}
      >
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {diaAberto ? rotuloDoDia(diaAberto) : ""}
            </DialogTitle>
            <DialogDescription>
              {eventosAbertos.length}{" "}
              {eventosAbertos.length === 1
                ? "ação apostólica"
                : "ações apostólicas"}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 py-2">
            {eventosAbertos.map((evento) => (
              <li key={evento.id}>
                <Link
                  href={`/eventos/${evento.id}`}
                  className="hover:bg-accent block rounded-md border p-3 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: evento.tipoCor }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          evento.status === "cancelado" && "line-through",
                        )}
                      >
                        {evento.titulo}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {evento.tipoNome} · {evento.missaoNome}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatarPeriodo(evento.dataInicio, evento.dataFim)}
                      </p>
                      {evento.local ? (
                        <p className="text-muted-foreground text-xs">
                          {evento.local}
                        </p>
                      ) : null}
                      {/* A situação diz se a ação já aconteceu; o destaque,
                          que ela segue indo ao regional depois disso. */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        <SeloStatus status={evento.status} />
                        {evento.destaqueRegional ? (
                          <Badge
                            variant="outline"
                            className="bg-laranja/10 text-laranja border-laranja/25"
                          >
                            <Star className="fill-current" aria-hidden />
                            Destaque regional
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

/*
 * O resumo que a célula não comporta: o título ali trunca em poucas letras, e
 * missão, tipo e local só apareciam abrindo o dia. Substitui o `title` nativo,
 * que mostrava só o título e, junto com este, abriria duas dicas ao mesmo
 * tempo.
 *
 * Tooltip e não HoverCard porque o Tooltip do Radix liga o conteúdo ao link
 * por `aria-describedby` e abre também no foco do teclado; o HoverCard, pela
 * documentação do próprio Radix, é só para quem usa mouse e fica fora do
 * alcance do teclado. No toque ele não abre, e não precisa: o toque já leva à
 * ação, e o diálogo do dia mostra o mesmo resumo.
 *
 * Os rótulos são os da página da ação, para a mesma informação não ter dois
 * nomes.
 */
function ResumoDaAcao({ evento }: { evento: EventoAgenda }) {
  return (
    <TooltipContent
      sideOffset={4}
      className="flex-col items-start gap-1.5 py-2 text-left"
    >
      <p className="font-medium">{evento.titulo}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-background/70">Tipo da ação</dt>
        <dd className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: evento.tipoCor }}
          />
          {evento.tipoNome}
        </dd>
        <dt className="text-background/70">Missão</dt>
        <dd>{evento.missaoNome}</dd>
        <dt className="text-background/70">Período</dt>
        <dd>{formatarPeriodo(evento.dataInicio, evento.dataFim)}</dd>
        {evento.local ? (
          <>
            <dt className="text-background/70">Local</dt>
            <dd className="wrap-break-word">{evento.local}</dd>
          </>
        ) : null}
        {/* Na célula, a ação cancelada só se distingue pelo risco no título;
            aqui a situação vem escrita. */}
        <dt className="text-background/70">Situação</dt>
        <dd>{rotuloDoStatus(evento.status)}</dd>
      </dl>
      {evento.destaqueRegional ? (
        <p className="flex items-center gap-1.5">
          <Star aria-hidden className="text-laranja size-3 fill-current" />
          Destaque regional
        </p>
      ) : null}
    </TooltipContent>
  );
}
