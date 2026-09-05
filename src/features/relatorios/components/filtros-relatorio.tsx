"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

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
 *  mesmo que a tela mostra. */
export function FiltrosRelatorio({
  missoes,
  tipos,
  de,
  ate,
}: {
  missoes: { id: string; nome: string }[];
  tipos: { id: string; nome: string; cor: string }[];
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const parametros = useSearchParams();

  function definir(alteracoes: Record<string, string | null>) {
    const novos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor === null || valor === TODOS) novos.delete(chave);
      else novos.set(chave, valor);
    }
    router.push(`/relatorios${novos.size ? `?${novos}` : ""}`);
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

      {missoes.length > 1 ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Missão</Label>
          <Select
            value={ativo("missao")}
            onValueChange={(v) => definir({ missao: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {missoes.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

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
          onClick={() => router.push("/relatorios")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
