import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";

import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca — some no mobile, onde a tarefa é entrar, não admirar */}
      <section className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gold)" }}
        />
        <p className="font-brand text-2xl tracking-tight">
          Inteligência&nbsp;Evangelizadora
        </p>

        <div className="relative max-w-md space-y-4">
          <h1 className="font-brand text-4xl leading-tight text-balance">
            Cada missão tem uma história de crescimento.
          </h1>
          <p className="text-primary-foreground/70 text-lg leading-relaxed text-pretty">
            Acompanhe membros, grupos de oração e ações apostólicas das missões
            de São Paulo em um só lugar.
          </p>
        </div>

        <p className="text-primary-foreground/50 relative text-sm">
          Acesso restrito aos responsáveis cadastrados.
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-brand text-primary text-xl tracking-tight">
              Inteligência&nbsp;Evangelizadora
            </p>
          </div>

          <div className="mb-8 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="text-muted-foreground text-sm">
              Use o e-mail cadastrado pelo administrador.
            </p>
          </div>

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
