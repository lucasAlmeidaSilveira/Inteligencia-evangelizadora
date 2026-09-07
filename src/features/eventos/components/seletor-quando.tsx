"use client";

import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { getDefaultClassNames, type DateRange } from "react-day-picker";

import { Campo } from "@/components/padroes/campo";
import { SeletorHora } from "@/components/padroes/seletor-hora";
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

const classesPadrao = getDefaultClassNames();

/**
 * Quando a ação acontece: as datas num controle, os horários noutro.
 *
 * Substituiu o par de `<input type="datetime-local">` "Início" e "Término".
 * Aqueles dois campos pediam a mesma data duas vezes — e quase toda ação
 * apostólica começa e termina no mesmo dia. Aqui o dia se diz uma vez; o
 * segundo clique no calendário é o que transforma a ação num retiro de três
 * dias, e só quem precisa disso paga por ele.
 *
 * Fala `"AAAA-MM-DDTHH:MM"` nas duas pontas, a mesma forma que o
 * `datetime-local` entregava. É o que mantém `eventoSchema` e as Server
 * Actions intocados, inclusive a regra de que o término não vem antes do
 * início.
 */
export function SeletorQuando({
  inicio,
  fim,
  onChange,
  erroInicio,
  erroFim,
  className,
}: {
  /** `"2026-09-06T20:00"` — o que o formulário guarda. */
  inicio: string;
  fim: string;
  onChange: (valores: { inicio: string; fim: string }) => void;
  erroInicio?: string;
  erroFim?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);

  /* O primeiro dia clicado desde que o popover abriu. É o que distingue "esta
     é a data da ação" de "este é o outro extremo dela" — e o que permite que
     um dia só custe um clique. Ver `escolher`. */
  const [primeiroClique, setPrimeiroClique] = useState<Date | undefined>();

  const de = lerChaveDeDia(inicio.slice(0, 10));
  const ate = lerChaveDeDia(fim.slice(0, 10));
  const horaDe = inicio.slice(11, 16);
  const horaAte = fim.slice(11, 16);

  // Controlado pelo que está salvo, não por estado interno do calendário: o
  // destaque na grade é sempre o período que o formulário guarda.
  const selecionado: DateRange | undefined = de
    ? { from: de, to: ate ?? de }
    : undefined;

  function definir(novo: {
    de?: Date;
    ate?: Date;
    horaDe?: string;
    horaAte?: string;
  }) {
    const dataDe = novo.de ?? de;
    const dataAte = novo.ate ?? ate ?? dataDe;
    const hDe = novo.horaDe ?? horaDe;
    const hAte = novo.horaAte ?? horaAte;

    onChange({
      inicio: dataDe ? `${chaveDoDia(dataDe)}T${hDe}` : "",
      fim: dataAte ? `${chaveDoDia(dataAte)}T${hAte}` : "",
    });
  }

  /**
   * A escolha do dia, decidida aqui e não pelo `mode="range"`.
   *
   * A biblioteca só sabe fazer dois extremos: com `resetOnSelect`, todo clique
   * recomeça e um dia só custaria dois; sem ele, mudar a data da ação de 6
   * para 10 esticaria o período em vez de movê-lo, criando um retiro de cinco
   * dias que ninguém pediu.
   *
   * Nenhum dos dois serve a uma tela onde quase toda ação dura um dia. Então o
   * primeiro clique já vale como ação de um dia — e o popover fica aberto,
   * porque o segundo clique é o que a transforma em vários.
   */
  function escolher(dia: Date | undefined) {
    if (!dia) return;

    if (!primeiroClique) {
      setPrimeiroClique(dia);
      definir({ de: dia, ate: dia });
      return;
    }

    // Clicar antes do primeiro dia é dizer que a ação começa mais cedo, não
    // um engano a recusar.
    const [comeco, termino] =
      dia < primeiroClique ? [dia, primeiroClique] : [primeiroClique, dia];

    definir({ de: comeco, ate: termino });
    setPrimeiroClique(undefined);
    setAberto(false);
  }

  /* O rótulo diz "6 de setembro de 2026" num dia só e "6 a 8 de setembro de
     2026" em vários: repetir a data de término quando ela é igual à de início
     faria o campo parecer mais complicado do que a ação é. */
  const rotulo = !de
    ? "Escolher data"
    : !ate || chaveDoDia(de) === chaveDoDia(ate)
      ? formatarData(de)
      : `${formatarData(de)} a ${formatarData(ate)}`;

  const diasDeDiferenca =
    de && ate
      ? Math.round((ate.getTime() - de.getTime()) / 86_400_000) + 1
      : 1;

  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>
      <Campo
        rotulo="Quando"
        obrigatorio
        erro={erroInicio}
        ajuda="Um clique marca a ação de um dia. Clique um segundo dia se ela atravessar mais de um."
        className="sm:col-span-2"
      >
        {(props) => (
          <Popover
            open={aberto}
            onOpenChange={(estado) => {
              setAberto(estado);
              // Cada abertura recomeça a escolha: sem isto, reabrir o
              // calendário para trocar a data esticaria o período a partir do
              // clique anterior.
              setPrimeiroClique(undefined);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                {...props}
                type="button"
                variant="outline"
                className={cn(
                  "w-full cursor-pointer justify-start font-normal",
                  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                )}
              >
                <CalendarDays aria-hidden />
                <span className={cn("tabular", !de && "text-muted-foreground")}>
                  {rotulo}
                </span>
                {diasDeDiferenca > 1 ? (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {diasDeDiferenca} dias
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto gap-0 p-0" align="start">
              <Calendar
                mode="range"
                locale={ptBR}
                selected={selecionado}
                defaultMonth={de}
                numberOfMonths={2}
                /* O intervalo que a biblioteca calcula é descartado: quem
                   decide é `escolher`, a partir do dia clicado. */
                onSelect={(_intervalo, dia) => escolher(dia)}
                classNames={{
                  /* Compõe com as classes de origem em vez de substituí-las:
                     um valor solto aqui apagaria `rdp-months`, de que a
                     própria biblioteca depende. */
                  months: cn(
                    "relative flex flex-col gap-4 md:flex-row",
                    classesPadrao.months,
                    "[&>*:nth-child(2)]:hidden sm:[&>*:nth-child(2)]:flex",
                  ),
                }}
                className="p-2"
              />
            </PopoverContent>
          </Popover>
        )}
      </Campo>

      <Campo rotulo="Começa às" obrigatorio>
        {(props) => (
          <SeletorHora
            {...props}
            valor={horaDe}
            onChange={(hora) => definir({ horaDe: hora })}
          />
        )}
      </Campo>

      {/* O erro de período mora aqui: a regra do schema diz que o término não
          pode vir antes do início, e é este o campo que a pessoa muda para
          resolvê-lo. */}
      <Campo rotulo="Termina às" obrigatorio erro={erroFim}>
        {(props) => (
          <SeletorHora
            {...props}
            valor={horaAte}
            onChange={(hora) => definir({ horaAte: hora })}
          />
        )}
      </Campo>
    </div>
  );
}
