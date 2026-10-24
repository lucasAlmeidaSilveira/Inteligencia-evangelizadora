"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Campo } from "@/components/padroes/campo";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { OpcaoDeCentro } from "../opcoes-de-centro";

/* As duas escolhas que não são centro. O Radix não aceita item de valor
   vazio, daí as sentinelas — que não saem deste arquivo: para o formulário,
   as duas são `localCentroId` vazio, e o que as separa é haver texto. */
const OUTRO_LOCAL = "__outro__";
const SEM_LOCAL = "__sem__";

/**
 * Onde a ação acontece: um dos centros da missão, ou outro lugar, escrito à
 * mão como sempre foi.
 *
 * Um select só, e não uma escolha "centro ou outro" seguida de um segundo
 * campo: quase toda ação acontece num centro da própria missão, e esse caso
 * custa um clique. "Outro local" abre os dois campos de texto de antes.
 *
 * Serve ao formulário completo e ao card de informações, como o
 * `SeletorQuando`: o formulário guarda os valores, e este componente só decide
 * o que mostrar e o que gravar a cada escolha.
 */
export function SeletorLocal({
  centros,
  centroId,
  comTexto,
  onEscolherCentro,
  onLimparTexto,
  campoLocal,
  campoEndereco,
  erroCentro,
  erroLocal,
  erroEndereco,
  className,
}: {
  /** Os centros da missão da ação — a FK composta recusa os de outra. */
  centros: OpcaoDeCentro[];
  /** `localCentroId` do formulário: o id do centro, ou "" quando não é um. */
  centroId: string;
  /** Se a ação chegou com local ou endereço escritos à mão — é o que faz a
   *  edição abrir em "Outro local", com o texto de antes. */
  comTexto: boolean;
  onEscolherCentro: (centroId: string) => void;
  /** Para "Não informado": o texto de "Outro local" fica guardado no
   *  formulário mesmo com os campos fechados, e seria salvo junto. */
  onLimparTexto: () => void;
  campoLocal: UseFormRegisterReturn;
  campoEndereco: UseFormRegisterReturn;
  erroCentro?: string;
  erroLocal?: string;
  erroEndereco?: string;
  className?: string;
}) {
  /* Estado só da tela. "Outro local" com os campos ainda em branco é, para o
     formulário, o mesmo que "Não informado" — sem isto, o select voltaria
     sozinho para "Não informado" no instante em que se escolhe "Outro". */
  const [outro, setOutro] = useState(comTexto && !centroId);

  const valor = centroId || (outro ? OUTRO_LOCAL : SEM_LOCAL);
  const escolhido = centros.find((c) => c.id === centroId);

  function escolher(novo: string) {
    setOutro(novo === OUTRO_LOCAL);
    if (novo === SEM_LOCAL) onLimparTexto();
    /* Escolher um centro não apaga o que se escreveu em "Outro local": quem
       alterna entre as opções não perde o texto. Na hora de salvar, o schema
       descarta o texto quando há centro (`comLocalUnico`). */
    onEscolherCentro(novo === OUTRO_LOCAL || novo === SEM_LOCAL ? "" : novo);
  }

  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>
      <Campo
        rotulo="Local"
        ajuda={ajudaDoLocal(valor, escolhido)}
        erro={erroCentro}
        className="sm:col-span-2"
      >
        {(props) => (
          <Select value={valor} onValueChange={escolher}>
            <SelectTrigger {...props} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_LOCAL}>Não informado</SelectItem>
              {centros.length > 0 ? (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Centros da missão</SelectLabel>
                    {centros.map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {centro.nome}
                        {centro.principal ? " · principal" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              ) : null}
              <SelectSeparator />
              <SelectItem value={OUTRO_LOCAL}>Outro local…</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Campo>

      {valor === OUTRO_LOCAL ? (
        <>
          <Campo rotulo="Nome do local" erro={erroLocal}>
            {(props) => (
              <Input {...props} {...campoLocal} placeholder="Paróquia São José" />
            )}
          </Campo>

          <Campo rotulo="Endereço" erro={erroEndereco}>
            {(props) => <Input {...props} {...campoEndereco} />}
          </Campo>
        </>
      ) : null}
    </div>
  );
}

/** O endereço do centro aparece antes de salvar porque é ele que a ação vai
 *  mostrar — e, faltando, a pessoa fica sabendo onde completá-lo. */
function ajudaDoLocal(valor: string, escolhido: OpcaoDeCentro | undefined) {
  if (escolhido) {
    return escolhido.endereco
      ? `Endereço no cadastro do centro: ${escolhido.endereco}.`
      : "Este centro ainda não tem endereço cadastrado — dá para completar na aba CEV da missão.";
  }
  if (valor === SEM_LOCAL) {
    return "Escolha um centro da missão, ou “Outro local” para escrever o endereço.";
  }
  return undefined;
}
