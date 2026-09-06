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
import { TIPOS_CENTRO } from "@/features/centros/schemas";

const TODOS = "__todos__";

/**
 * Filtros da tela de centros, escritos na URL.
 *
 * A missão é um controle daqui, ao contrário do que acontece em /eventos: esta
 * tela existe para ver os centros de todas as missões lado a lado, e amarrá-la
 * ao foco da barra lateral responderia outra pergunta. O seletor de foco
 * continua valendo para painel, calendário, ações e relatórios.
 */
export function FiltrosCentros({
  missoes,
}: {
  /** Vazio ou com uma só: o select some — não há o que escolher. */
  missoes: { id: string; nome: string }[];
}) {
  // `aplicar` é o `router.push` dentro de uma transição: é o que faz a lista
  // esmaecer enquanto o novo recorte não chega.
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  function definir(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODOS) novos.delete(chave);
    else novos.set(chave, valor);
    aplicar(`/centros${novos.size ? `?${novos}` : ""}`);
  }

  /* Um parâmetro adulterado deixaria o gatilho em branco, sem opção
     correspondente — e a tela mostra tudo nesse caso, então "todos" é o rótulo
     honesto. */
  const escolhido = (chave: string, conhecidos: string[]) => {
    const daUrl = parametros.get(chave);
    return daUrl && conhecidos.includes(daUrl) ? daUrl : TODOS;
  };

  const missaoAtual = escolhido(
    "missao",
    missoes.map((m) => m.id),
  );
  const tipoAtual = escolhido("tipo", [...TIPOS_CENTRO.map((t) => t.valor)]);
  const temFiltro = missaoAtual !== TODOS || tipoAtual !== TODOS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {missoes.length > 1 ? (
        <Select
          value={missaoAtual}
          onValueChange={(v) => definir("missao", v)}
        >
          <SelectTrigger
            className="w-auto min-w-44"
            aria-label="Filtrar por missão"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as missões</SelectItem>
            {missoes.map((missao) => (
              <SelectItem key={missao.id} value={missao.id}>
                {missao.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select value={tipoAtual} onValueChange={(v) => definir("tipo", v)}>
        <SelectTrigger className="w-auto min-w-44" aria-label="Filtrar por tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os tipos</SelectItem>
          {TIPOS_CENTRO.map((tipo) => (
            <SelectItem key={tipo.valor} value={tipo.valor}>
              {tipo.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => aplicar("/centros")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
