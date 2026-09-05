"use client";

import { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { BarraProgresso } from "@/components/navegacao/barra-progresso";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  // Instanciado dentro do componente: um QueryClient em módulo seria
  // compartilhado entre requisições no servidor, vazando cache entre usuários.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {/* A barra lê searchParams, que só resolve no cliente. */}
        <Suspense fallback={null}>
          <BarraProgresso />
        </Suspense>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
