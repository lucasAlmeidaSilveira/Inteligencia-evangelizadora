"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LoaderCircle } from "lucide-react";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { responderPesquisa } from "../actions-publicas";
import { respostaSchema } from "../schemas";

type Entrada = z.input<typeof respostaSchema>;
type Saida = z.output<typeof respostaSchema>;

const NOTAS = Array.from({ length: 11 }, (_, n) => n);
const LIMITE_COMENTARIO = 500;

/**
 * O formulário que o participante vê, sem login.
 *
 * As onze notas são `<input type="radio">` de verdade, escondidos atrás de
 * rótulos grandes: teclado e leitor de tela ganham um grupo de rádio comum,
 * com setas e anúncio de "9 de 11", e o foco visível continua existindo — é
 * desenhado no rótulo pelo `peer`. Onze botões em `<div>` exigiriam
 * reimplementar tudo isso à mão.
 *
 * O erro aparece na própria página, não só em toast: aqui não há sessão nem
 * contexto, e a pessoa precisa ler por que não foi.
 */
export function FormularioResposta({
  token,
  titulo,
}: {
  token: string;
  titulo: string;
}) {
  const [enviado, setEnviado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(respostaSchema),
    defaultValues: { nota: "", comentario: "", confirmacao: "" },
  });

  const notaEscolhida = useWatch({ control, name: "nota" });
  const comentario = useWatch({ control, name: "comentario" }) ?? "";

  async function enviar(dados: Saida) {
    setErroGeral(null);
    const resultado = await responderPesquisa(token, dados);

    if (!resultado.ok) {
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as keyof Entrada, { message: mensagem });
      }
      setErroGeral(resultado.erro);
      return;
    }

    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="space-y-4 text-center" role="status">
        <span className="bg-success/10 mx-auto flex size-12 items-center justify-center rounded-full">
          <CircleCheck className="text-success size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Obrigado! Sua avaliação foi registrada.
        </h1>
        <p className="text-muted-foreground text-sm">Pode fechar esta página.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="space-y-1">
          <span className="block text-xl font-semibold tracking-tight text-balance">
            Como você avalia {titulo}?
          </span>
          <span className="text-muted-foreground block text-sm">
            Escolha uma nota de 0 a 10.
          </span>
        </legend>

        <div
          className="grid grid-cols-6 gap-2 sm:grid-cols-11"
          aria-describedby={errors.nota ? "erro-nota" : undefined}
        >
          {NOTAS.map((nota) => (
            <label key={nota} className="relative">
              <input
                type="radio"
                value={nota}
                className="peer sr-only"
                {...register("nota")}
              />
              {/* Selecionado leva cor e borda; o foco é um anel na cor da
                  marca — nunca removido, só movido do input para o rótulo. */}
              <span
                className={cn(
                  "bg-background text-foreground flex min-h-14 cursor-pointer items-center justify-center rounded-lg border text-lg font-semibold tabular-nums transition-[background-color,border-color,transform] duration-150 select-none",
                  "hover:border-primary/60 active:translate-y-px",
                  "peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary",
                  "peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
                )}
              >
                {nota}
              </span>
            </label>
          ))}
        </div>

        <div className="text-muted-foreground flex justify-between text-xs">
          <span>0 · Péssima</span>
          <span>10 · Excelente</span>
        </div>

        {errors.nota ? (
          <p id="erro-nota" className="text-destructive text-sm" role="alert">
            {errors.nota.message}
          </p>
        ) : null}
      </fieldset>

      <Campo
        rotulo="Comentário (opcional)"
        ajuda={`${String(comentario ?? "").length} de ${LIMITE_COMENTARIO} caracteres`}
        erro={errors.comentario?.message}
      >
        {(props) => (
          <Textarea
            {...props}
            rows={4}
            maxLength={LIMITE_COMENTARIO}
            placeholder="O que mais marcou você? O que poderia melhorar?"
            {...register("comentario")}
          />
        )}
      </Campo>

      {/* Honeypot: fora da tela e fora da ordem de tabulação. Pessoa nenhuma
          preenche; robô que preenche recebe "sucesso" e nada é gravado. */}
      <div aria-hidden className="absolute top-auto left-[-9999px] h-px w-px overflow-hidden">
        <label>
          Deixe em branco
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register("confirmacao")}
          />
        </label>
      </div>

      {erroGeral ? (
        <p className="text-destructive text-sm" role="alert">
          {erroGeral}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full cursor-pointer"
        disabled={isSubmitting || notaEscolhida === ""}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Enviar avaliação"
        )}
      </Button>

      <p className="text-muted-foreground text-center text-xs text-pretty">
        A resposta é anônima: não pedimos nome, telefone nem e-mail.
      </p>
    </form>
  );
}
