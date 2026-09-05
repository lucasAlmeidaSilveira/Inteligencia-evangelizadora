"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              ativa
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
