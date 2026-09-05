"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { STATUS_EVENTO } from "../schemas";

const TODOS = "__todos__";

/**
 * Filtros na URL, não em estado de componente: o recorte fica compartilhável,
 * sobrevive ao recarregar e ao botão voltar.
 */
export function FiltrosEventos({
  missoes,
  tipos,
}: {
  missoes: { id: string; nome: string }[];
  tipos: { id: string; nome: string; cor: string }[];
}) {
  const router = useRouter();
  const parametros = useSearchParams();

  function definir(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODOS) novos.delete(chave);
    else novos.set(chave, valor);
    router.push(`/eventos${novos.size ? `?${novos}` : ""}`);
  }

  const ativo = (chave: string) => parametros.get(chave) ?? TODOS;
  const temFiltro = ["missao", "tipo", "status"].some((c) =>
    parametros.has(c),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {missoes.length > 1 ? (
        <Select
          value={ativo("missao")}
          onValueChange={(v) => definir("missao", v)}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filtrar por missão">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as missões</SelectItem>
            {missoes.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select value={ativo("tipo")} onValueChange={(v) => definir("tipo", v)}>
        <SelectTrigger className="w-auto min-w-36" aria-label="Filtrar por tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os tipos</SelectItem>
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

      <Select
        value={ativo("status")}
        onValueChange={(v) => definir("status", v)}
      >
        <SelectTrigger className="w-auto min-w-36" aria-label="Filtrar por situação">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as situações</SelectItem>
          {STATUS_EVENTO.map((s) => (
            <SelectItem key={s.valor} value={s.valor}>
              {s.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => router.push("/eventos")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
