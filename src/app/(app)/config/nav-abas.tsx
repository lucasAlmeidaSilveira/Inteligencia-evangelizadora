"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IndicadorAba } from "@/components/padroes/indicador-aba";
import { cn } from "@/lib/utils";

const ABAS = [
  { rotulo: "Tipos de ação", href: "/config" },
  { rotulo: "Categorias financeiras", href: "/config/categorias" },
];

export function NavAbas() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Seções da configuração"
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
    >
      {ABAS.map((aba) => {
        const ativa = caminho === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              /* A borda transparente reserva os 2px do indicador: sem ela a
                 aba ativa ficaria mais alta que as outras. */
              "relative -mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium transition-colors",
              ativa
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
            {ativa ? <IndicadorAba nome="aba-config" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
