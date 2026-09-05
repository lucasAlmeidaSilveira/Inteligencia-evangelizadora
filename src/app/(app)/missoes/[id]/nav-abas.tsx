"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Abas como rotas de verdade, não estado de componente: cada seção tem URL
 * própria, funciona com voltar do navegador e pode ser compartilhada.
 */
export function NavAbas({ missaoId }: { missaoId: string }) {
  const caminho = usePathname();
  const base = `/missoes/${missaoId}`;

  const abas = [
    { rotulo: "Visão geral", href: base },
    { rotulo: "Grupos de oração", href: `${base}/grupos` },
    { rotulo: "Indicadores", href: `${base}/indicadores` },
  ];

  return (
    <nav
      aria-label="Seções da missão"
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
    >
      {abas.map((aba) => {
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
