"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CentroParaSelecao } from "@/features/centros/queries";

const TODOS = "__todos__";

/**
 * Filtro na URL, não em estado de componente: o recorte fica compartilhável,
 * sobrevive ao recarregar e ao botão voltar — o mesmo que os filtros das ações
 * apostólicas fazem.
 *
 * Não há opção "sem centro": todo grupo pertence a algum, e o que não foi
 * separado em outra frente está no principal — que aparece aqui pelo nome
 * dele, no topo da lista.
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
  const conhecido = centros.some((c) => c.id === daUrl);
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
          {centros.map((centro) => (
            <SelectItem key={centro.id} value={centro.id}>
              {centro.ativo ? centro.nome : `${centro.nome} (inativo)`}
              {centro.principal ? " · principal" : ""}
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
