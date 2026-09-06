"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CentroParaSelecao } from "@/features/centros/queries";
import { SEM_CENTRO } from "@/features/centros/schemas";

const TODOS = "__todos__";

/**
 * Filtro na URL, não em estado de componente: o recorte fica compartilhável,
 * sobrevive ao recarregar e ao botão voltar — o mesmo que os filtros das ações
 * apostólicas fazem.
 *
 * "Diretamente na missão" não é o mesmo que "todos". Com o vínculo opcional,
 * os grupos sem centro são um conjunto de verdade, e é justamente onde o
 * coordenador vai procurar o que ainda não organizou em frentes.
 */
export function FiltrosGrupos({ centros }: { centros: CentroParaSelecao[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();

  function definir(valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODOS) novos.delete("centro");
    else novos.set("centro", valor);
    router.push(`${caminho}${novos.size ? `?${novos}` : ""}`);
  }

  /* Um `?centro=` adulterado deixaria o gatilho em branco, sem opção
     correspondente — e a tela mostra tudo nesse caso, então "Todos" é o
     rótulo honesto. */
  const daUrl = parametros.get("centro");
  const conhecido =
    daUrl === SEM_CENTRO || centros.some((c) => c.id === daUrl);
  const atual = daUrl && conhecido ? daUrl : TODOS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={atual} onValueChange={definir}>
        <SelectTrigger
          className="w-auto min-w-52"
          aria-label="Filtrar por centro de evangelização"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os centros</SelectItem>
          <SelectItem value={SEM_CENTRO}>Diretamente na missão</SelectItem>
          <SelectSeparator />
          {centros.map((centro) => (
            <SelectItem key={centro.id} value={centro.id}>
              {centro.ativo ? centro.nome : `${centro.nome} (inativo)`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {atual !== TODOS ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => definir(TODOS)}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
