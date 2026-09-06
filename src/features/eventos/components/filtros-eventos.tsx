"use client";

import { useSearchParams } from "next/navigation";
import { Star, X } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lerChaveDeMes, mesesDoFiltro, rotuloDoMes } from "@/lib/mes";

import { STATUS_EVENTO } from "../schemas";

const TODOS = "__todos__";

/**
 * Filtros na URL, não em estado de componente: o recorte fica compartilhável,
 * sobrevive ao recarregar e ao botão voltar.
 *
 * A missão não é um controle daqui. Em /eventos quem escolhe é o seletor da
 * barra lateral, que vale para o acompanhamento inteiro; dentro de uma missão
 * ela é a própria rota. Nos dois casos, um select de missão ao lado destes
 * daria duas verdades na tela.
 *
 * Daí `base`: o recorte se escreve na tela onde se está. Sem ela, filtrar
 * dentro de uma missão jogaria o usuário para fora dela, em /eventos.
 */
export function FiltrosEventos({
  base,
  tipos,
}: {
  /** Caminho da tela que exibe a lista — para onde os filtros escrevem. */
  base: string;
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
    aplicar(`${base}${novos.size ? `?${novos}` : ""}`);
  }

  const ativo = (chave: string) => parametros.get(chave) ?? TODOS;
  const temFiltro = ["tipo", "status", "destaque", "mes"].some((c) =>
    parametros.has(c),
  );
  const soDestaques = parametros.has("destaque");

  /* A janela é montada em torno de hoje, mas um link guardado pode apontar
     para fora dela — o mês de março de dois anos atrás, mandado por e-mail. Ele
     entra na lista para que o gatilho mostre o recorte em vigor em vez de ficar
     em branco dizendo que não há filtro nenhum. */
  const mesAtual = lerChaveDeMes(parametros.get("mes"));
  const janela = mesesDoFiltro();
  const meses =
    mesAtual && !janela.includes(mesAtual) ? [mesAtual, ...janela] : janela;

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

      {/* O mês vem primeiro: é o recorte que os coordenadores usam ao fechar o
          mês, e é o que o cartão "Ações neste mês" do painel já traz aplicado. */}
      <Select
        value={mesAtual ?? TODOS}
        onValueChange={(v) => definir("mes", v)}
      >
        <SelectTrigger className="w-auto min-w-40" aria-label="Filtrar por mês">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todo o período</SelectItem>
          {meses.map((mes) => (
            <SelectItem key={mes} value={mes}>
              {rotuloDoMes(mes)}
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

      {/* Botão de duas posições, não um terceiro select: o filtro é ligado ou
          desligado, e `aria-pressed` conta o estado a quem não vê a cor. */}
      <Button
        variant={soDestaques ? "secondary" : "outline"}
        aria-pressed={soDestaques}
        className="cursor-pointer"
        onClick={() => definir("destaque", soDestaques ? TODOS : "1")}
      >
        <Star className={soDestaques ? "fill-current" : ""} aria-hidden />
        Só destaques
      </Button>

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => aplicar(base)}
        >
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
