import { SearchX } from "lucide-react";

/** Token desconhecido, vencido por troca de link, ou URL digitada errada. */
export default function PesquisaNaoEncontrada() {
  return (
    <div className="space-y-4 text-center">
      <span className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
        <SearchX className="text-muted-foreground size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">
        Pesquisa não encontrada
      </h1>
      <p className="text-muted-foreground text-sm text-pretty">
        Confira o link ou peça um novo a quem organizou a ação.
      </p>
    </div>
  );
}
