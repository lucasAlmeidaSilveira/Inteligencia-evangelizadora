"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cartão cuja superfície inteira repete a ação principal — quase sempre editar.
 *
 * Quem coordena entra uma vez por mês: mirar um lápis de 32px, ou abrir um menu
 * para achar "Editar", é precisão exigida de quem não tem prática. O cartão
 * inteiro vira alvo, e o lápis continua ali dizendo o que o clique faz.
 *
 * O cartão *não* vira botão. Ele é uma `div` com clique de mouse, redundante
 * com um controle de verdade que já existe dentro dele — é esse botão que
 * recebe foco e que o leitor de tela anuncia. Transformar o cartão em `button`
 * aninharia o lápis e a lixeira dentro de outro botão, o que nem é HTML válido
 * nem sobrevive à navegação por teclado.
 *
 * Sem `aoAcionar` é um `Card` comum: é o caso da linha da equipe que a pessoa
 * não tem permissão para mexer.
 */

/** Quem tem ação própria: o clique neles não é clique no cartão. */
const INTERATIVOS =
  'a, button, input, select, textarea, label, [role="menuitem"], [role="button"], [role="checkbox"], [role="switch"]';

export function CartaoAcionavel({
  aoAcionar,
  children,
  className,
}: {
  aoAcionar?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  function clicar(evento: React.MouseEvent<HTMLDivElement>) {
    if (!aoAcionar) return;

    // O lápis, a lixeira, o menu, um campo do formulário aberto: já têm dono.
    if ((evento.target as HTMLElement).closest(INTERATIVOS)) return;

    /* Arrastar para selecionar termina em clique. Sem isto, copiar o telefone
       de um centro ou as observações de uma ação abriria o formulário junto —
       e o texto selecionado sumiria na troca. */
    const selecao = document.getSelection();
    if (selecao && !selecao.isCollapsed) return;

    aoAcionar();
  }

  return (
    <Card
      onClick={aoAcionar ? clicar : undefined}
      className={cn(
        /* O mesmo idioma de clique do CartaoMissao e da LinhaEvento: anel aceso
           mais 2px de elevação. Escrito por extenso porque o Tailwind varre o
           código como texto e não geraria as regras a partir de um nome
           montado. O `focus-within` acende pelo lápis de dentro — quem navega
           por teclado precisa do mesmo sinal de que o cartão é o alvo. */
        aoAcionar &&
          "hover:ring-primary/40 focus-within:ring-primary/40 cursor-pointer transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 active:translate-y-0",
        className,
      )}
    >
      {children}
    </Card>
  );
}
