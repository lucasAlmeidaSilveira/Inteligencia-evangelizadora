import { Suspense } from "react";
import type { Metadata } from "next";

import { Marca } from "@/components/marca";
import { Revelar } from "@/components/padroes/revelar";
import { Skeleton } from "@/components/ui/skeleton";

import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    /* A tela inteira recuada de 12px no desktop: as duas metades viram placas
       apoiadas sobre o campo de luz do fundo, em vez de dois retângulos
       coladas nas bordas da janela. É a mesma cena dos cartões e da barra
       lateral — a página de entrada não pode ser feita de outro material que
       o sistema que ela abre. */
    <main className="grid min-h-dvh gap-3 lg:grid-cols-[1.1fr_1fr] lg:p-3">
      {/* Painel de marca — some no mobile, onde a tarefa é entrar, não admirar */}
      <section className="bg-marca-azul text-marca-tinta relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:rounded-3xl [--marca-acento:var(--marca-luz)]">
        {/* O fogo missionário atrás do azul da contemplação — a única peça
            decorativa da tela, e por isso ela pode ser generosa.

            700ms e uma escala quase imperceptível: é a única entrada longa do
            sistema inteiro. Aqui cabe porque não há dado nenhum na tela ainda,
            e porque esta é a primeira impressão de quem chega. Em nenhum outro
            lugar o laranja se move. */}
        <div
          aria-hidden
          className="animate-in fade-in-0 zoom-in-95 fill-mode-both pointer-events-none absolute -top-48 -right-40 size-[40rem] rounded-full opacity-45 blur-3xl duration-700 ease-out"
          style={{ background: "var(--marca-luz)" }}
        />

        {/* Marca, promessa e rodapé entram em sequência de 80ms: a ordem conta
            quem somos, o que o sistema faz e para quem ele é. */}
        <Revelar className="relative" distancia={2}>
          <Marca />
        </Revelar>

        <Revelar
          className="relative max-w-md space-y-4"
          atraso={80}
          distancia={2}
        >
          <h1 className="font-brand text-4xl leading-tight text-balance">
            Cada missão tem uma história de crescimento.
          </h1>
          <p className="text-marca-tinta/70 text-lg leading-relaxed text-pretty">
            Acompanhe membros, grupos de oração e ações apostólicas das missões
            de São Paulo em um só lugar.
          </p>
        </Revelar>

        <Revelar
          como="p"
          className="text-marca-tinta/50 relative text-sm"
          atraso={160}
          distancia={2}
        >
          Acesso restrito aos responsáveis cadastrados.
        </Revelar>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        {/* O formulário sobre vidro: é a única coisa a fazer nesta tela, e a
            placa é o que a separa do fundo. */}
        <div className="vidro w-full max-w-sm p-6 sm:p-8">
          <div className="mb-8 lg:hidden">
            <Marca className="text-primary" />
          </div>

          <Revelar className="mb-8 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="text-muted-foreground text-sm">
              Use o e-mail cadastrado pelo administrador.
            </p>
          </Revelar>

          {/* useSearchParams() só resolve no cliente. O esqueleto reserva a
              altura exata do formulário para a tela não saltar ao hidratar. */}
          <Suspense
            fallback={
              <div className="space-y-5" aria-hidden>
                <Skeleton className="h-[62px] w-full" />
                <Skeleton className="h-[62px] w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            }
          >
            <FormularioLogin />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
