"use client";

import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__";

/** Filtros na URL: o recorte é compartilhável e a exportação lê exatamente o
 *  mesmo que a tela mostra.
 *
 *  A missão fica de fora: quem a escolhe é o seletor da barra lateral, e o
 *  mesmo foco vale para o painel, o calendário e as ações. */
export function FiltrosRelatorio({
  tipos,
  de,
  ate,
}: {
  tipos: { id: string; nome: string; cor: string }[];
  de: string;
  ate: string;
}) {
  // Dentro de uma transição, para os números e as tabelas esmaecerem enquanto
  // o novo período não chega. Aqui vale ainda mais que na lista de ações: uma
  // data digitada dispara a consulta a cada tecla.
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  function definir(alteracoes: Record<string, string | null>) {
    const novos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor === null || valor === TODOS) novos.delete(chave);
      else novos.set(chave, valor);
    }
    aplicar(`/relatorios${novos.size ? `?${novos}` : ""}`);
  }

  const ativo = (chave: string) => parametros.get(chave) ?? TODOS;
  const temFiltro = [...parametros.keys()].length > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="rel-de" className="text-xs">
          De
        </Label>
        <Input
          id="rel-de"
          type="date"
          value={de}
          onChange={(e) => definir({ de: e.target.value })}
          className="tabular w-40"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rel-ate" className="text-xs">
          Até
        </Label>
        <Input
          id="rel-ate"
          type="date"
          value={ate}
          onChange={(e) => definir({ ate: e.target.value })}
          className="tabular w-40"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Select value={ativo("tipo")} onValueChange={(v) => definir({ tipo: v })}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: t.cor }}
                  />
                  {t.nome}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
        <Checkbox
          checked={parametros.get("cancelados") === "1"}
          onCheckedChange={(v) => definir({ cancelados: v ? "1" : null })}
        />
        Incluir canceladas
      </label>

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 cursor-pointer"
          onClick={() => aplicar("/relatorios")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
