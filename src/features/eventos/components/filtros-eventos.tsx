"use client";

import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
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
 *
 * A missão não está aqui: quem escolhe é o seletor da barra lateral, que vale
 * para o acompanhamento inteiro. Dois controles para a mesma dimensão dariam
 * duas verdades na tela.
 */
export function FiltrosEventos({
  tipos,
}: {
  tipos: { id: string; nome: string; cor: string }[];
}) {
  // `aplicar` é o `router.push` dentro de uma transição: é o que faz a lista
  // esmaecer enquanto o novo recorte não chega, em vez de ficar parada
  // mostrando o recorte antigo como se nada tivesse sido pedido.
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  function definir(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODOS) novos.delete(chave);
    else novos.set(chave, valor);
    aplicar(`/eventos${novos.size ? `?${novos}` : ""}`);
  }

  const ativo = (chave: string) => parametros.get(chave) ?? TODOS;
  const temFiltro = ["tipo", "status"].some((c) => parametros.has(c));

  return (
    <div className="flex flex-wrap items-center gap-2">
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
          onClick={() => aplicar("/eventos")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
