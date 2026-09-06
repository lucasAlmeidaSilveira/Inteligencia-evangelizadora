import type { Route } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CartaoMetrica({
  rotulo,
  valor,
  detalhe,
  Icone,
  cor,
  href,
  className,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  Icone?: LucideIcon;
  /**
   * Cor do tipo de ação, no lugar do ícone.
   *
   * Hexadecimal vem do banco — é cadastro do admin, não decisão de design —, e
   * a bolinha é como tipo de ação aparece nos filtros, no calendário e nos
   * relatórios. Um ícone genérico aqui faria o cartão de SVES parecer de outra
   * família que os outros lugares onde o mesmo tipo é mostrado.
   */
  cor?: string;
  /** Presente, o cartão inteiro leva à tela que detalha o número. */
  href?: Route;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-5",
        /* Mesmo idioma de cartão clicável do CartaoMissao e da LinhaEvento: o
           anel aceso mais 2px de elevação. Escrito por extenso porque o
           Tailwind varre o código como texto e não geraria as regras a partir
           de um nome montado. */
        href &&
          "hover:ring-primary/40 focus-within:ring-primary/40 relative transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 active:translate-y-0",
        className,
      )}
    >
      <CardContent className="space-y-2 px-5">
        <div className="text-muted-foreground flex items-center gap-1.5">
          {cor ? (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: cor }}
            />
          ) : Icone ? (
            <Icone className="size-3.5" aria-hidden />
          ) : null}
          {/* O link cobre o cartão inteiro, mas só o rótulo recebe foco: o
              leitor de tela anuncia "Grupos de oração", não o rótulo colado ao
              número. O sublinhado no hover existe porque cor não pode ser a
              única pista de que ali se clica. */}
          <span className="text-xs font-medium">
            {href ? (
              <Link
                href={href}
                className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none"
              >
                {rotulo}
              </Link>
            ) : (
              rotulo
            )}
          </span>
        </div>
        {/* `data-slot="metric"` liga as figuras tabulares definidas em
            globals.css: o número não muda de largura ao atualizar. */}
        <p data-slot="metric" className="text-2xl font-semibold tracking-tight">
          {valor}
        </p>
        {detalhe ? (
          <p className="text-muted-foreground text-xs">{detalhe}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
