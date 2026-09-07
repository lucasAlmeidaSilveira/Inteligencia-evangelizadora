"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** De quinze em quinze minutos: cobre horário de grupo de oração e de ação
 *  apostólica sem virar uma lista de 1.440 linhas. */
const PASSO_EM_MINUTOS = 15;

const HORARIOS = Array.from(
  { length: (24 * 60) / PASSO_EM_MINUTOS },
  (_, i) => {
    const minutos = i * PASSO_EM_MINUTOS;
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}`;
  },
);

/** `"19:30"`, e nada além disso. O que vem do banco pode trazer segundos. */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)/;

function normalizar(valor: string) {
  const encontrado = HORA.exec(valor);
  return encontrado ? `${encontrado[1]}:${encontrado[2]}` : "";
}

/**
 * Um horário, num campo de formulário.
 *
 * Lista em vez de digitação: o `<input type="time">` obriga a acertar hora,
 * minuto e — em alguns navegadores — AM/PM em campos separados, e é onde mais
 * se erra num formulário que se preenche uma vez por mês. Escolher "19:30"
 * numa lista é um gesto só.
 *
 * O valor entra e sai como `"HH:MM"`, a mesma forma que o input nativo usava.
 */
export function SeletorHora({
  valor,
  onChange,
  className,
  ...acessibilidade
}: {
  valor: string;
  onChange: (valor: string) => void;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const atual = normalizar(valor);

  /* Um horário fora da grade — "19:50", vindo de um cadastro antigo ou de uma
     importação — entra na lista para que o gatilho mostre o que está salvo em
     vez de ficar em branco, dizendo que não há horário quando há. */
  const horarios =
    atual && !HORARIOS.includes(atual) ? [atual, ...HORARIOS] : HORARIOS;

  return (
    <Select value={atual} onValueChange={onChange}>
      <SelectTrigger
        {...acessibilidade}
        className={cn("tabular w-full", className)}
      >
        <SelectValue placeholder="Escolher horário" />
      </SelectTrigger>
      <SelectContent>
        {horarios.map((hora) => (
          <SelectItem key={hora} value={hora} className="tabular">
            {hora}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
