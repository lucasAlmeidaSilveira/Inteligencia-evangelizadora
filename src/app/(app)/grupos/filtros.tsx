"use client";

import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CentroParaFiltro } from "@/features/centros/queries";

const TODOS = "__todos__";

/**
 * Filtros da tela de grupos, escritos na URL.
 *
 * A missão é controle daqui pelo mesmo motivo da tela de centros: aqui a
 * pergunta é onde os grupos estão, e responder só pela missão em foco
 * responderia outra.
 *
 * O centro depende da missão escolhida, e o recorte se faz aqui em vez de uma
 * ida ao servidor a cada troca — o mesmo caminho do formulário de ação
 * apostólica, que já carrega os centros de todas as missões visíveis. Sem
 * missão escolhida, os centros vêm agrupados por missão: nomes como "Centro
 * principal" se repetem entre missões, e sem o agrupamento a lista teria
 * opções idênticas e indistinguíveis.
 */
export function FiltrosGruposGerais({
  missoes,
  centros,
}: {
  missoes: { id: string; nome: string }[];
  centros: CentroParaFiltro[];
}) {
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  const daUrl = (chave: string, conhecidos: string[]) => {
    const valor = parametros.get(chave);
    return valor && conhecidos.includes(valor) ? valor : TODOS;
  };

  const missaoAtual = daUrl(
    "missao",
    missoes.map((m) => m.id),
  );

  /* Trocar de missão limpa o centro: o centro escolhido pertencia à missão
     anterior, e mantê-lo devolveria uma lista sempre vazia — a tela diria
     "nenhum grupo" quando o que houve foi um recorte impossível. */
  function definirMissao(valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    novos.delete("centro");
    if (valor === TODOS) novos.delete("missao");
    else novos.set("missao", valor);
    aplicar(`/grupos${novos.size ? `?${novos}` : ""}`);
  }

  function definirCentro(valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODOS) novos.delete("centro");
    else novos.set("centro", valor);
    aplicar(`/grupos${novos.size ? `?${novos}` : ""}`);
  }

  const centrosVisiveis =
    missaoAtual === TODOS
      ? centros
      : centros.filter((c) => c.missaoId === missaoAtual);

  const centroAtual = daUrl(
    "centro",
    centrosVisiveis.map((c) => c.id),
  );
  const temFiltro = missaoAtual !== TODOS || centroAtual !== TODOS;

  const rotulo = (centro: CentroParaFiltro) =>
    `${centro.ativo ? centro.nome : `${centro.nome} (inativo)`}${
      centro.principal ? " · principal" : ""
    }`;

  /** Os centros na ordem em que vieram, quebrados por missão. */
  const porMissao = centrosVisiveis.reduce<
    { missaoId: string; missaoNome: string; centros: CentroParaFiltro[] }[]
  >((grupos, centro) => {
    const atual = grupos.at(-1);
    if (atual?.missaoId === centro.missaoId) atual.centros.push(centro);
    else
      grupos.push({
        missaoId: centro.missaoId,
        missaoNome: centro.missaoNome,
        centros: [centro],
      });
    return grupos;
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {missoes.length > 1 ? (
        <Select value={missaoAtual} onValueChange={definirMissao}>
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

      {centrosVisiveis.length > 0 ? (
        <Select value={centroAtual} onValueChange={definirCentro}>
          <SelectTrigger
            className="w-auto min-w-52"
            aria-label="Filtrar por centro de evangelização"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os centros</SelectItem>
            {/* Com uma missão escolhida o agrupamento sobra: seria um cabeçalho
                só, repetindo o que o select ao lado já diz. */}
            {missaoAtual === TODOS && missoes.length > 1
              ? porMissao.map((grupo) => (
                  <SelectGroup key={grupo.missaoId}>
                    <SelectLabel>{grupo.missaoNome}</SelectLabel>
                    {grupo.centros.map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {rotulo(centro)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              : centrosVisiveis.map((centro) => (
                  <SelectItem key={centro.id} value={centro.id}>
                    {rotulo(centro)}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      ) : null}

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => aplicar("/grupos")}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
