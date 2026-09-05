"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavAbas({
  eventoId,
  contagens,
}: {
  eventoId: string;
  contagens: { lancamentos: number; documentos: number; links: number };
}) {
  const caminho = usePathname();
  const base = `/eventos/${eventoId}`;

  const abas = [
    { rotulo: "Visão geral", href: base, contagem: undefined },
    {
      rotulo: "Financeiro",
      href: `${base}/financeiro`,
      contagem: contagens.lancamentos,
    },
    {
      rotulo: "Documentos",
      href: `${base}/documentos`,
      contagem: contagens.documentos,
    },
    { rotulo: "Links úteis", href: `${base}/links`, contagem: contagens.links },
  ];

  return (
    <nav
      aria-label="Seções da ação apostólica"
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
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              ativa
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {aba.rotulo}
            {aba.contagem ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
                {aba.contagem}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
