"use client";

import { useSearchParams } from "next/navigation";
import { Star, X } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { SeletorPeriodo } from "@/components/padroes/seletor-periodo";
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
 * A missão não é um controle daqui. Em /eventos quem escolhe é o seletor da
 * barra lateral, que vale para o acompanhamento inteiro; dentro de uma missão
 * ela é a própria rota. Nos dois casos, um select de missão ao lado destes
 * daria duas verdades na tela.
 *
 * Daí `base`: o recorte se escreve na tela onde se está. Sem ela, filtrar
 * dentro de uma missão jogaria o usuário para fora dela, em /eventos.
 *
 * O período fala o mesmo `?de=`/`?ate=` do painel, de propósito: os cartões de
 * lá levam para cá com o recorte aplicado, e um segundo vocabulário faria o
 * cartão dizer um número e esta lista mostrar outro.
 */
export function FiltrosEventos({
  base,
  tipos,
  periodo,
  hoje,
}: {
  /** Caminho da tela que exibe a lista — para onde os filtros escrevem. */
  base: string;
  tipos: { id: string; nome: string; cor: string }[];
  /** O recorte em vigor, já resolvido pelo servidor. */
  periodo: { de: string; ate: string } | undefined;
  /** Âncora dos atalhos do seletor. Ver `SeletorPeriodo`. */
  hoje: string;
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
  const temFiltro = ["tipo", "status", "destaque", "de", "ate", "mes"].some(
    (c) => parametros.has(c),
  );
  const soDestaques = parametros.has("destaque");

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

      {/* O período vem logo depois do tipo: é o recorte que os coordenadores
          usam ao fechar o mês, e é o que os cartões do painel já trazem
          aplicado ao levarem para cá. */}
      <SeletorPeriodo
        base={base}
        periodo={periodo}
        hoje={hoje}
        /* Aqui "Limpar" apenas tira os parâmetros: a URL sem recorte já é todo
           o período, ao contrário do painel. */
        permiteVazio
        rotuloVazio="Todo o período"
      />

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
