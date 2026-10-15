"use client";

import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * O ano e as canceladas, na URL — o recorte é compartilhável e a exportação lê
 * exatamente o que está na tela.
 *
 * O ano anda de um em um, como o mês no calendário: o relatório anual é de um
 * ano por definição, e um seletor de intervalo pediria duas escolhas para dizer
 * uma coisa só. A missão, como nas outras telas, é a do seletor da barra
 * lateral.
 */
export function FiltrosAnuais({
  ano,
  anoCorrente,
  primeiroAno,
}: {
  ano: number;
  /** Do servidor, no relógio de São Paulo: na noite de 31 de dezembro o
   *  navegador e o servidor em UTC discordariam sobre qual ano é. */
  anoCorrente: number;
  primeiroAno: number;
}) {
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  function definir(alteracoes: Record<string, string | null>) {
    const novos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor === null) novos.delete(chave);
      else novos.set(chave, valor);
    }
    aplicar(`/relatorios/anual${novos.size ? `?${novos}` : ""}`);
  }

  /* O ano corrente sai da URL, como o mês corrente no painel: o link mandado
     a alguém em janeiro mostra o ano novo. Quem quer fixar 2026 escolhe 2026
     em outro ano e leva `?ano=2026`. */
  const irPara = (alvo: number) =>
    definir({ ano: alvo === anoCorrente ? null : String(alvo) });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Ano anterior"
          disabled={ano <= primeiroAno}
          className="cursor-pointer"
          onClick={() => irPara(ano - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-16 text-center text-lg font-medium tabular-nums">
          {ano}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo ano"
          disabled={ano >= anoCorrente + 1}
          className="cursor-pointer"
          onClick={() => irPara(ano + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
        {ano !== anoCorrente ? (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => irPara(anoCorrente)}
          >
            Ano atual
          </Button>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={parametros.get("cancelados") === "1"}
          onCheckedChange={(v) => definir({ cancelados: v ? "1" : null })}
        />
        Incluir canceladas
      </label>
    </div>
  );
}
