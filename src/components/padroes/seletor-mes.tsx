"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatarCompetencia } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const CHAVE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function ler(valor: string) {
  const encontrado = CHAVE.exec(valor);
  if (!encontrado) return undefined;
  return { ano: Number(encontrado[1]), mes: Number(encontrado[2]) - 1 };
}

const chave = (ano: number, mes: number) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}`;

/**
 * Um mês, num campo de formulário.
 *
 * Não é o calendário de dias: competência é o mês inteiro, e oferecer os
 * trinta dias faria escolher um deles para dizer "setembro" — uma precisão que
 * o dado não tem e que o usuário teria de inventar.
 *
 * O valor entra e sai como `"AAAA-MM"`, a mesma forma que o
 * `<input type="month">` usava.
 */
export function SeletorMes({
  valor,
  onChange,
  /** Último mês oferecido. A competência congela números que já existem —
   *  registrar novembro em setembro guardaria a fotografia de um mês que
   *  ainda não aconteceu. */
  maximo,
  className,
  ...acessibilidade
}: {
  valor: string;
  onChange: (valor: string) => void;
  maximo?: string;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const atual = ler(valor);
  const teto = maximo ? ler(maximo) : undefined;

  const [aberto, setAberto] = useState(false);
  // O ano que a grade mostra é navegação, não seleção: dá para folhear 2025
  // sem perder o mês já escolhido em 2026.
  const [ano, setAno] = useState(() => atual?.ano ?? new Date().getFullYear());

  const depoisDoTeto = (mes: number) =>
    !!teto && (ano > teto.ano || (ano === teto.ano && mes > teto.mes));

  function definir(mes: number) {
    onChange(chave(ano, mes));
    setAberto(false);
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        // Reabrir sempre no ano do valor em vigor, não no último folheado.
        if (estado) setAno(atual?.ano ?? new Date().getFullYear());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...acessibilidade}
          type="button"
          variant="outline"
          className={cn(
            "w-full cursor-pointer justify-start font-normal",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            className,
          )}
        >
          <CalendarDays aria-hidden />
          <span className={cn(!atual && "text-muted-foreground")}>
            {atual
              ? capitalizar(formatarCompetencia(new Date(atual.ano, atual.mes, 1)))
              : "Escolher mês"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 gap-0 p-2" align="start">
        <div className="flex items-center justify-between pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label="Ano anterior"
            onClick={() => setAno((a) => a - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>

          <span className="tabular text-sm font-medium">{ano}</span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label="Próximo ano"
            // Um ano inteiro à frente do teto não tem nenhum mês possível.
            disabled={!!teto && ano >= teto.ano}
            onClick={() => setAno((a) => a + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {MESES.map((nome, mes) => {
            const escolhido = atual?.ano === ano && atual.mes === mes;

            return (
              <Button
                key={nome}
                type="button"
                variant={escolhido ? "default" : "ghost"}
                size="sm"
                // O mês escolhido não se marca só por cor de fundo.
                aria-pressed={escolhido}
                disabled={depoisDoTeto(mes)}
                className="cursor-pointer capitalize"
                onClick={() => definir(mes)}
              >
                {nome}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
