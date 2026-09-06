"use client";

import { Fragment } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type Elo = {
  rotulo: string;
  href: Route;
  /** Nome vindo do banco: largura imprevisível, precisa encolher no celular. */
  dinamico?: boolean;
};

/**
 * Trilha de navegação.
 *
 * No celular a barra lateral é um `Sheet` escondido atrás do botão de menu —
 * sem isto, as telas de dentro de uma missão ou ação não têm nenhuma âncora
 * visível de onde se está nem de como subir um nível.
 *
 * Quem é o elo atual se decide pelo caminho, nunca pela posição na lista. Nas
 * telas com abas o último elo é a *entidade*, e a página de verdade é a aba —
 * que já carrega `aria-current="page"` em `NavAbas`. Marcar o último elo como
 * atual por ser o último colocaria dois `aria-current="page"` na mesma tela,
 * apontando para coisas diferentes, e o leitor de tela anunciaria duas páginas
 * atuais. Comparando o caminho, na aba nenhum elo é atual (todos viram links
 * úteis, e o da entidade leva à visão geral) e no índice a entidade é.
 */
export function Trilha({ elos }: { elos: Elo[] }) {
  const caminho = usePathname();

  return (
    // O shadcn fixa `aria-label="breadcrumb"`, em inglês. O spread dele vem
    // depois do atributo, então passar o rótulo aqui o substitui sem precisar
    // editar `components/ui/`, que é gerado.
    <Breadcrumb aria-label="Trilha de navegação">
      {/* `flex-nowrap` no lugar do `flex-wrap` do shadcn: com no máximo três
          elos, quebrar linha rouba mais altura do que o corte do nome rouba
          informação — e o nome inteiro continua no título logo abaixo. */}
      <BreadcrumbList className="flex-nowrap">
        {elos.map((elo, i) => (
          <Fragment key={elo.href}>
            {i > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
            <BreadcrumbItem
              className={cn(elo.dinamico ? "min-w-0" : "shrink-0")}
            >
              {caminho === elo.href ? (
                <BreadcrumbPage className={cn(elo.dinamico && "truncate")}>
                  {elo.rotulo}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  {/* `min-h-6` leva o alvo de toque aos 24px exigidos sem
                      crescer a altura da linha. O sublinhado no hover é o
                      mesmo do link de missão no cabeçalho da ação: cor não
                      pode ser a única pista de que ali se clica. */}
                  <Link
                    href={elo.href}
                    className="inline-flex min-h-6 min-w-0 items-center rounded-sm underline-offset-4 hover:underline"
                  >
                    <span className={cn(elo.dinamico && "truncate")}>
                      {elo.rotulo}
                    </span>
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
