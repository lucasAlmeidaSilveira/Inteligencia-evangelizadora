"use client";

import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatarData } from "@/lib/format";
import { chaveDoDia, lerChaveDeDia } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Uma data, num campo de formulário.
 *
 * Irmão do `SeletorPeriodo`, que faz o mesmo para filtros. São dois porque o
 * filtro escreve na URL por `useFiltro` — que só existe dentro de
 * `AreaFiltrada` — e um campo de formulário devolve o valor a quem o controla.
 * Um componente só teria de servir a dois donos.
 *
 * O valor entra e sai como `"AAAA-MM-DD"`, a mesma forma que o
 * `<input type="date">` usava. É o que mantém os schemas zod e as Server
 * Actions intocados: para eles nada mudou.
 */
export function SeletorData({
  valor,
  onChange,
  placeholder = "Escolher data",
  permiteVazio = false,
  /** Limites da navegação. Sem eles o seletor de ano listaria cem anos para
   *  trás — inútil para um lançamento financeiro e insuficiente para a
   *  fundação de uma missão. Quem usa o campo sabe qual dos dois é. */
  inicioEm,
  fimEm,
  className,
  ...acessibilidade
}: {
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  permiteVazio?: boolean;
  inicioEm?: Date;
  fimEm?: Date;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  const data = lerChaveDeDia(valor);

  /* Montado como lista porque os limites são independentes: `{ before:
     undefined }` não é "sem limite" para o react-day-picker, é uma
     comparação com `undefined` que desabilita o calendário inteiro. */
  const foraDoLimite = [
    ...(inicioEm ? [{ before: inicioEm }] : []),
    ...(fimEm ? [{ after: fimEm }] : []),
  ];

  function definir(nova: Date | undefined) {
    onChange(nova ? chaveDoDia(nova) : "");
    setAberto(false);
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          {...acessibilidade}
          type="button"
          variant="outline"
          className={cn(
            "w-full cursor-pointer justify-start font-normal",
            /* O contorno vermelho que o `Campo` liga por `aria-invalid` é do
               `Input`; o `Button` precisa do seu. Sem isto o campo com erro
               ficaria idêntico ao campo certo, e só a frase abaixo contaria. */
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            className,
          )}
        >
          <CalendarDays aria-hidden />
          <span className={cn("tabular", !data && "text-muted-foreground")}>
            {data ? formatarData(data) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={data}
          onSelect={definir}
          defaultMonth={data}
          /* Mês e ano viram listas: uma fundação de 1997 fica a dois cliques,
             em vez de duzentos e cinquenta no botão de mês anterior. */
          captionLayout="dropdown"
          startMonth={inicioEm}
          endMonth={fimEm}
          disabled={foraDoLimite.length > 0 ? foraDoLimite : undefined}
          className="p-2"
        />

        {permiteVazio && data ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full cursor-pointer justify-start font-normal"
              onClick={() => definir(undefined)}
            >
              <X aria-hidden />
              Limpar
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
