"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { CartaoAcionavel } from "./cartao-acionavel";

/**
 * Card que troca de leitura para formulário no lugar, sem mudar de rota.
 *
 * O público entra uma vez por mês para preencher os números da ação que já
 * aconteceu; obrigá-lo a abrir uma tela de edição, achar o campo no meio de
 * quinze outros e voltar era o caminho longo para trocar dois inteiros.
 *
 * A casca cuida só de abrir e fechar. O `<form>`, os campos e os botões de
 * salvar ficam com quem usa — cada seção tem o seu schema e o seu botão de
 * gravar, e é o formulário que precisa envolver o rodapé para o Enter enviar.
 */
export function CartaoEditavel({
  titulo,
  /** Ações que só fazem sentido lendo — um "Ver detalhes", por exemplo. */
  acao,
  children,
  className,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: (estado: {
    editando: boolean;
    fechar: () => void;
  }) => React.ReactNode;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);

  return (
    /* Aberto, o cartão já é o formulário: acionar de novo não teria o que
       abrir, e um clique perdido no meio dos campos não pode significar nada.
       Por isso `aoAcionar` só existe enquanto se está lendo. */
    <CartaoAcionavel
      aoAcionar={editando ? undefined : () => setEditando(true)}
      className={className}
    >
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {/* Durante a edição o lápis sai: o card já está aberto, e o caminho de
            volta são o Cancelar e o Salvar lá embaixo. */}
        {editando ? null : (
          <CardAction className="flex items-center gap-1">
            {acao}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              onClick={() => setEditando(true)}
              /* O nome da seção entra no rótulo porque a tela tem vários
                 lápis idênticos — "Editar" sozinho, lido em sequência, não
                 diz qual deles é qual. */
              aria-label={`Editar ${titulo.toLowerCase()}`}
            >
              <Pencil aria-hidden />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {children({ editando, fechar: () => setEditando(false) })}
      </CardContent>
    </CartaoAcionavel>
  );
}

/** Rodapé padrão dos cards em edição: cancelar à esquerda, gravar à direita. */
export function AcoesDeEdicao({
  enviando,
  aoCancelar,
}: {
  enviando: boolean;
  aoCancelar: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="cursor-pointer"
        onClick={aoCancelar}
        disabled={enviando}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        size="sm"
        className="cursor-pointer"
        disabled={enviando}
      >
        {enviando ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}
