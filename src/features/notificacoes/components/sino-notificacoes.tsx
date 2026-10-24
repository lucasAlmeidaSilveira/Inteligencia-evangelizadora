"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatarRelativo } from "@/lib/format";
import { cn } from "@/lib/utils";

import { marcarNotificacaoLida, marcarTodasLidas } from "../actions";
import type { NotificacaoListada } from "../queries";

/**
 * O sino do cabeçalho: contagem de não lidas e a lista das últimas.
 *
 * Cada item é um link — o lembrete de contagem leva à tela do grupo com o
 * diálogo já aberto. Clicar marca como lida antes de navegar, em transição,
 * para a navegação não esperar o banco. O não lido tem ponto **e** peso de
 * fonte: cor sozinha não distingue nada para quem não a enxerga.
 */
export function SinoNotificacoes({
  itens,
  naoLidas,
}: {
  itens: NotificacaoListada[];
  naoLidas: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [, iniciar] = useTransition();

  const rotulo =
    naoLidas === 0
      ? "Notificações"
      : `Notificações, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`;

  function abrir(notificacao: NotificacaoListada) {
    setAberto(false);
    if (notificacao.lidaEm) return;
    iniciar(async () => {
      const resultado = await marcarNotificacaoLida(notificacao.id);
      if (!resultado.ok) toast.error(resultado.erro);
    });
  }

  function lerTodas() {
    iniciar(async () => {
      const resultado = await marcarTodasLidas();
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative cursor-pointer"
          aria-label={rotulo}
        >
          <Bell className="size-4" aria-hidden />
          {naoLidas > 0 ? (
            <span
              aria-hidden
              className="bg-primary text-primary-foreground tabular absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold"
            >
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-medium">Notificações</h2>
          {naoLidas > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-7 cursor-pointer text-xs"
              onClick={lerTodas}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todas como lidas
            </Button>
          ) : null}
        </div>

        {itens.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            Nenhuma notificação por enquanto. Os lembretes de contagem dos
            grupos de oração aparecem aqui.
          </p>
        ) : (
          <ScrollArea className="max-h-[60dvh]">
            <ul className="divide-y">
              {itens.map((notificacao) => {
                const lida = Boolean(notificacao.lidaEm);
                const conteudo = (
                  <>
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          lida ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span
                          className={cn(
                            "block text-sm leading-snug",
                            lida ? "text-foreground/80" : "font-medium",
                          )}
                        >
                          {lida ? null : (
                            <span className="sr-only">Não lida: </span>
                          )}
                          {notificacao.titulo}
                        </span>
                        <span className="text-muted-foreground block text-xs leading-snug">
                          {notificacao.mensagem}
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          {formatarRelativo(notificacao.criadoEm)}
                        </span>
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={notificacao.id}>
                    {notificacao.url ? (
                      <Link
                        href={notificacao.url}
                        onClick={() => abrir(notificacao)}
                        className="hover:bg-accent focus-visible:bg-accent block px-4 py-3 transition-colors focus-visible:outline-none"
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrir(notificacao)}
                        className="hover:bg-accent focus-visible:bg-accent block w-full cursor-pointer px-4 py-3 text-left transition-colors focus-visible:outline-none"
                      >
                        {conteudo}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
