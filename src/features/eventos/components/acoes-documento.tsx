"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { tipoPodeSerVisto } from "@/lib/documentos";

import { urlDoDocumento } from "../actions";
import type { Documento } from "../queries";

/**
 * Abrir e baixar um documento, nas duas telas que o listam: o card da visão
 * geral e a aba Documentos. Um componente só porque o mesmo arquivo não pode
 * oferecer coisas diferentes dependendo de onde aparece.
 */
export function AcoesDocumento({
  documento,
  tamanho = "icon",
  children,
}: {
  documento: Pick<Documento, "id" | "nome" | "tipoMime">;
  /** `icon-sm` no card da visão geral: ali as ações acompanham o resumo, não
   *  competem com ele. A aba, que é a tela de trabalho, usa o tamanho cheio. */
  tamanho?: "icon" | "icon-sm";
  /** Ações que só existem em uma das telas — hoje, o remover da aba. */
  children?: React.ReactNode;
}) {
  /*
   * `useState` e não `useTransition`, embora a espera seja por uma Server
   * Action.
   *
   * O layout envolve o conteúdo num `<ViewTransition>` do React, então toda
   * atualização marcada como transição pede uma `document.startViewTransition`.
   * Ao abrir a nova aba o navegador tira o foco desta, o documento fica oculto
   * e a transição morre com `InvalidStateError: Document hidden`. Aqui nada do
   * resultado vira estado renderizado — só um endereço para onde navegar —,
   * então a transição não compraria nada e custava esse erro.
   */
  const [ocupado, setOcupado] = useState(false);

  /**
   * A aba é aberta **antes** de assinar a URL, ainda dentro do clique.
   *
   * Assinar primeiro e abrir depois quebra a cadeia do gesto do usuário, e o
   * bloqueador de pop-up engole a janela — o clique não faria nada e nem erro
   * apareceria. Por isso a aba nasce vazia e só depois recebe o endereço.
   */
  async function ver() {
    /* Sem `noopener` aqui: com essa opção o `window.open` devolve `null` por
       especificação, mesmo tendo aberto a aba — e sem a referência não haveria
       como entregar a URL assinada que só chega depois. A proteção equivalente
       vem do `aba.opener = null` logo abaixo, antes de sair para o R2. */
    const aba = window.open("", "_blank");

    if (!aba) {
      toast.error("O navegador bloqueou a nova aba.", {
        description: "Permita pop-ups para este site ou use o botão de baixar.",
      });
      return;
    }

    setOcupado(true);
    try {
      const resultado = await urlDoDocumento(documento.id, "ver");
      if (!resultado.ok) {
        aba.close();
        toast.error(resultado.erro);
        return;
      }
      /* A aba vai sair para outra origem (o R2). Cortar o `opener` antes disso
         impede que a página de destino alcance esta janela de volta. */
      aba.opener = null;
      aba.location.href = resultado.dados.url;
    } finally {
      setOcupado(false);
    }
  }

  async function baixar() {
    setOcupado(true);
    try {
      const resultado = await urlDoDocumento(documento.id, "baixar");
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      window.location.href = resultado.dados.url;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {tipoPodeSerVisto(documento.tipoMime) ? (
        <Button
          variant="ghost"
          size={tamanho}
          className="cursor-pointer"
          aria-label={`Visualizar ${documento.nome}`}
          disabled={ocupado}
          onClick={() => void ver()}
        >
          <Eye className="size-4" aria-hidden />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size={tamanho}
        className="cursor-pointer"
        aria-label={`Baixar ${documento.nome}`}
        /* A espera aqui é real — assinar a URL leva uma ida ao servidor e não
           há nada a remover da tela enquanto isso. */
        disabled={ocupado}
        onClick={() => void baixar()}
      >
        <Download className="size-4" aria-hidden />
      </Button>
      {children}
    </>
  );
}
