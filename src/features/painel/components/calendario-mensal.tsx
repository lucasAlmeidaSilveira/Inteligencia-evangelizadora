"use client";

import { useState } from "react";
import Link from "next/link";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import * as m from "motion/react-m";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatarPeriodo } from "@/lib/format";
import { CURVA, DURACAO } from "@/lib/movimento";
import { cn } from "@/lib/utils";

import type { EventoAgenda } from "../queries";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAXIMO_VISIVEL = 3;

/** Um evento ocupa todos os dias entre início e fim, inclusive a virada do mês. */
function ocorreNoDia(evento: EventoAgenda, dia: Date) {
  return (
    new Date(evento.dataInicio) <= endOfDay(dia) &&
    new Date(evento.dataFim) >= startOfDay(dia)
  );
}

export function CalendarioMensal({
  mes,
  eventos,
}: {
  /** Primeiro dia do mês exibido. */
  mes: Date;
  eventos: EventoAgenda[];
}) {
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);

  /*
   * Direção da viagem entre meses.
   *
   * O título muda mas a forma da grade é idêntica, então entrar pelo lado
   * certo é a única pista de que se avançou ou voltou. A direção sai da
   * comparação entre o mês novo e o anterior, e não de qual botão foi clicado:
   * o botão voltar do navegador também troca o mês.
   *
   * Estado ajustado durante a renderização, que é o padrão para "valor
   * anterior" — em efeito, isto seria o antipadrão `set-state-in-effect` que a
   * barra de progresso também evita.
   *
   * `0` é a primeira renderização e vale "sem animação": com `initial={false}`
   * a Motion não escreve `opacity: 0` no HTML do servidor, e a grade aparece
   * mesmo que o JavaScript não chegue.
   */
  const [mesAnterior, setMesAnterior] = useState(mes.getTime());
  const [direcao, setDirecao] = useState(0);

  if (mes.getTime() !== mesAnterior) {
    setDirecao(mes.getTime() > mesAnterior ? 1 : -1);
    setMesAnterior(mes.getTime());
  }

  // A grade sempre começa no domingo e termina no sábado, para as semanas
  // ficarem completas — dias vizinhos entram esmaecidos.
  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { locale: ptBR }),
    end: endOfWeek(endOfMonth(mes), { locale: ptBR }),
  });

  const doDia = (dia: Date) => eventos.filter((e) => ocorreNoDia(e, dia));
  const eventosAbertos = diaAberto ? doDia(diaAberto) : [];

  return (
    <>
      {/* A grade inteira entra, nunca célula por célula: 42 células escalonadas
          viram uma onda atravessando a tela. */}
      <m.div
        key={mes.toISOString()}
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
            const doMes = isSameMonth(dia, mes);
            const hoje = isToday(dia);
            const lista = doDia(dia);
            const visiveis = lista.slice(0, MAXIMO_VISIVEL);
            const restantes = lista.length - visiveis.length;

            return (
              <div
                key={dia.toISOString()}
                className={cn(
                  "min-h-24 border-r border-b p-1.5 last:border-r-0 sm:min-h-28",
                  !doMes && "bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => lista.length > 0 && setDiaAberto(dia)}
                  disabled={lista.length === 0}
                  aria-label={`${dia.getDate()} — ${lista.length} ação(ões)`}
                  className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                    lista.length > 0 && "hover:bg-accent cursor-pointer",
                    hoje && "bg-primary text-primary-foreground font-semibold",
                    !hoje && !doMes && "text-muted-foreground/60",
                    !hoje && doMes && "text-foreground",
                  )}
                >
                  {dia.getDate()}
                </button>

                <div className="space-y-1">
                  {visiveis.map((evento) => (
                    <Link
                      key={evento.id}
                      href={`/eventos/${evento.id}`}
                      title={evento.titulo}
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
                    </Link>
                  ))}

                  {restantes > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDiaAberto(dia)}
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
              {diaAberto
                ? new Intl.DateTimeFormat("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  }).format(diaAberto)
                : ""}
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

export { isSameDay };
