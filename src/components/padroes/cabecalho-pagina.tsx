import { Trilha, type Elo } from "@/components/padroes/trilha";

export function CabecalhoPagina({
  titulo,
  descricao,
  trilha,
  children,
}: {
  titulo: string;
  descricao?: string;
  /** Caminho até aqui. Só nas telas que têm ancestral — ver `Trilha`. */
  trilha?: Elo[];
  /** Ações da página — botão primário, filtros. */
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      {trilha ? <Trilha elos={trilha} /> : null}
      {/* A trilha fica acima da linha inteira, não dentro da coluna do título:
          com `sm:items-start`, o botão de ação alinharia pelo topo da trilha e
          ficaria um degrau acima do título que ele acompanha. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descricao ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {descricao}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
