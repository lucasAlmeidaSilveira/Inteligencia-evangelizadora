export function CabecalhoPagina({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  /** Ações da página — botão primário, filtros. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
    </header>
  );
}
