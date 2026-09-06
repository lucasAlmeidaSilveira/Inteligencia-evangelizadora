"use client";

import { Suspense } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";

import { BarraProgresso } from "@/components/navegacao/barra-progresso";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRANSICAO_PADRAO } from "@/lib/movimento";

/*
 * Os recursos da Motion descem num chunk próprio, depois da hidratação — só o
 * `m` (6 kB) fica no bundle comum. É seguro carregar assim porque nada que
 * decide visibilidade de conteúdo depende da Motion: se este chunk falhar, a
 * página fica sem animação, não sem texto.
 */
const carregarRecursos = () =>
  import("@/lib/movimento-recursos").then((r) => r.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* O padrão da Motion é `reducedMotion="never"`: sem esta linha ela
          ignora a preferência do sistema por completo. E o bloco
          `prefers-reduced-motion` do globals.css não a alcança, porque ela
          anima por `style` inline e WAAPI, não por CSS — a acessibilidade
          quebraria em silêncio, sem quebrar teste nem tela.

          Com `"user"`, transform e layout deixam de animar e opacidade e cor
          continuam. É a degradação certa: a WCAG 2.3.3 mira movimento, não
          fade.

          `strict` faz o `m` recusar `motion.div` em desenvolvimento. É o que
          impede o bundle de voltar aos 34,9 kB sem ninguém perceber. */}
      <MotionConfig reducedMotion="user" transition={TRANSICAO_PADRAO}>
        <LazyMotion features={carregarRecursos} strict>
          {/* A barra lê searchParams, que só resolve no cliente. */}
          <Suspense fallback={null}>
            <BarraProgresso />
          </Suspense>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" />
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  );
}
