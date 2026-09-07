"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { getDefaultClassNames, type DateRange } from "react-day-picker";

import { useFiltro } from "@/components/padroes/area-filtrada";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  atalhosDePeriodo,
  escreverPeriodo,
  lerChaveDeDia,
  mesDeAbertura,
  rotuloDoPeriodo,
  type Periodo,
} from "@/lib/periodo";
import { cn } from "@/lib/utils";

const classesPadrao = getDefaultClassNames();

/**
 * O recorte de período, num controle só.
 *
 * Substituiu o par "De"/"Até" dos relatórios e os selects de mês do painel e
 * das ações. Os dois campos de data nativos tinham um defeito difícil de ver:
 * cada tecla digitada era um `onChange`, uma URL nova e uma consulta ao
 * servidor — digitar uma data disparava várias. Aqui a escrita acontece uma vez
 * por escolha, e nunca com o intervalo pela metade.
 *
 * Os atalhos existem porque quase toda pergunta de coordenador é um deles. O
 * calendário fica para o resto, que é minoria.
 */
export function SeletorPeriodo({
  base,
  periodo,
  hoje,
  permiteVazio = false,
  vazioExplicito = false,
  rotuloVazio = "Selecione um período",
  className,
}: {
  /** Caminho da tela que exibe os números — para onde o recorte se escreve.
   *  Sem ele, filtrar dentro de uma missão jogaria o usuário para fora dela. */
  base: string;
  /** O recorte em vigor, em `YYYY-MM-DD`. Vem do servidor já resolvido: é ele
   *  quem conhece o padrão de cada tela. */
  periodo: { de: string; ate: string } | undefined;
  /** A data de hoje, também do servidor. Ver `atalhosDePeriodo`: calcular isto
   *  no cliente faria o HTML do servidor e o do navegador discordarem. */
  hoje: string;
  /** Habilita "Limpar". Onde a ausência de recorte é um estado possível. */
  permiteVazio?: boolean;
  /** Escreve `?periodo=tudo` ao limpar, em vez de só tirar os parâmetros.
   *  Necessário onde a URL sem parâmetro já significa um recorte — no painel,
   *  que abre no mês corrente. Sem isto, "todo o período" traria o mês de
   *  volta e o botão não faria nada. */
  vazioExplicito?: boolean;
  rotuloVazio?: string;
  className?: string;
}) {
  // `aplicar` é o `router.push` dentro de uma transição: é o que esmaece os
  // números enquanto o novo recorte não chega, em vez de deixar os antigos na
  // tela como se nada tivesse sido pedido.
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();
  const [aberto, setAberto] = useState(false);

  /* O intervalo em construção mora aqui, não na URL. O `mode="range"` avisa a
     cada clique, e o primeiro traz `{ from, to: undefined }` — escrevê-lo já
     seria consultar o servidor por um recorte que a pessoa ainda não terminou
     de pedir. */
  const [rascunho, setRascunho] = useState<DateRange | undefined>();

  const referencia = lerChaveDeDia(hoje) ?? new Date();
  const atual: Periodo | undefined = periodo
    ? {
        de: lerChaveDeDia(periodo.de) ?? referencia,
        ate: lerChaveDeDia(periodo.ate) ?? referencia,
      }
    : undefined;

  const selecionado: DateRange | undefined =
    rascunho ?? (atual ? { from: atual.de, to: atual.ate } : undefined);

  function definir(novo: Periodo | undefined) {
    const novos = new URLSearchParams(parametros.toString());
    escreverPeriodo(novos, novo, { vazioEhTudo: vazioExplicito });
    setRascunho(undefined);
    setAberto(false);
    aplicar(`${base}${novos.size ? `?${novos}` : ""}`);
  }

  const atalhos = atalhosDePeriodo(referencia);
  const rotulo = rotuloDoPeriodo(atual, referencia, rotuloVazio);

  return (
    <Popover
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        // Fechar no meio de um intervalo descarta o começo: reabrir mostrando
        // metade de uma escolha abandonada faria o controle mentir sobre o
        // recorte em vigor.
        if (!estado) setRascunho(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Período: ${rotulo}`}
          className={cn("cursor-pointer justify-start font-normal", className)}
        >
          <CalendarDays aria-hidden />
          {/* O período em vigor é dito por extenso no próprio gatilho: é o
              estado do filtro, e cor ou ícone sozinhos não o contariam. */}
          <span className={cn(!atual && "text-muted-foreground")}>{rotulo}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <div className="flex max-sm:flex-col">
          {/* Abaixo do calendário no celular: ali a lista é o caminho mais
              longo, e o calendário é o que a pessoa veio ver. */}
          <div className="flex flex-col gap-1 p-2 max-sm:order-1 max-sm:border-t sm:border-e">
            {atalhos.map((atalho) => {
              const ativo =
                !!atual &&
                chaveIgual(atual.de, atalho.de) &&
                chaveIgual(atual.ate, atalho.ate);

              return (
                <Button
                  key={atalho.rotulo}
                  variant="ghost"
                  size="sm"
                  // O atalho em vigor não se marca só por cor de fundo:
                  // `aria-pressed` conta o mesmo estado a quem não a vê.
                  aria-pressed={ativo}
                  className={cn(
                    "cursor-pointer justify-start font-normal",
                    ativo && "bg-muted font-medium",
                  )}
                  onClick={() => definir({ de: atalho.de, ate: atalho.ate })}
                >
                  {atalho.rotulo}
                </Button>
              );
            })}

            {permiteVazio ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground cursor-pointer justify-start font-normal"
                onClick={() => definir(undefined)}
              >
                {rotuloVazio}
              </Button>
            ) : null}
          </div>

          <Calendar
            mode="range"
            locale={ptBR}
            selected={selecionado}
            defaultMonth={mesDeAbertura(atual, referencia)}
            numberOfMonths={2}
            /* Um clique num intervalo já completo recomeça, em vez de esticar o
               que estava lá: sem isto, escolher um período novo exigiria
               limpar o anterior primeiro. */
            resetOnSelect
            onSelect={(intervalo) => {
              if (intervalo?.from && intervalo.to) {
                definir({ de: intervalo.from, ate: intervalo.to });
                return;
              }
              setRascunho(intervalo);
            }}
            classNames={{
              /* Dois meses não cabem num celular. Esconder o segundo por CSS
                 mantém o HTML igual dos dois lados da hidratação — decidir a
                 quantidade por `matchMedia` traria de volta a divergência que
                 `hoje` como prop existe para evitar.

                 Compõe com as classes de origem em vez de substituí-las: o
                 `classNames` do shadcn é espalhado por último, e um valor solto
                 aqui apagaria `rdp-months`, de que a própria biblioteca
                 depende. */
              months: cn(
                "relative flex flex-col gap-4 md:flex-row",
                classesPadrao.months,
                "[&>*:nth-child(2)]:hidden sm:[&>*:nth-child(2)]:flex",
              ),
            }}
            className="p-2"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Compara pelo dia, não pelo instante: o recorte em vigor termina em
   23:59:59.999 e o atalho, à meia-noite — o mesmo dia com relógios diferentes. */
function chaveIgual(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
