"use client";

import { AnimatePresence } from "motion/react";
/* Na v13 este subpath exporta os elementos direto (`div`, `li`, …), não um
   objeto `m` — daí o import de namespace. */
import * as m from "motion/react-m";

import { CURVA, DURACAO } from "@/lib/movimento";

/**
 * Entrada e saída de itens de lista.
 *
 * É o único lugar do sistema onde a Motion é insubstituível: CSS não anima a
 * saída de um elemento removido do DOM — quando a regra poderia rodar, o nó já
 * não existe. `AnimatePresence` segura o item na árvore até a animação
 * terminar.
 *
 * **Só funciona quando a remoção é decidida no cliente.** As listas daqui se
 * atualizam por `router.refresh()`, e nesse caminho a árvore antiga é
 * substituída pelo payload novo sem passar por desmontagem animada. Por isso
 * quem usa isto tira o item da lista com `useOptimistic` antes de chamar a
 * ação — que de quebra é o que faz a lista responder no mesmo quadro do
 * clique, em vez de esperar a ida e volta ao servidor. Se a ação falhar, o
 * `useOptimistic` devolve o item, e ele volta com a animação de entrada.
 *
 * Os elementos vêm de `motion/react-m` (6 kB) e nunca de `motion/react`
 * (34,9 kB): o `LazyMotion strict` do providers reprova o segundo em
 * desenvolvimento justamente para o pacote não crescer sem ninguém notar.
 */

export function Presenca({ children }: { children: React.ReactNode }) {
  /* `initial={false}`: quem abre a tela não acabou de criar nada, então a
     lista inteira não deve entrar animada no primeiro carregamento — isso é
     trabalho da cascata em CSS. A entrada fica reservada para o item que
     aparece depois, que é o que a pessoa precisa achar.

     `AnimatePresence` não emite DOM, então isto continua válido dentro de
     `<ul>`: os `<li>` seguem sendo filhos diretos. */
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

export function ItemPresente({
  children,
  className,
  como = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /* `tr` não entra aqui: envolver um `<tr>` exigiria reproduzir as classes do
     `TableRow` do shadcn, que divergiriam em silêncio na próxima atualização
     do gerador. Onde é preciso animar linha de tabela, o próprio `TableRow` é
     envolvido com `m.create` — ver `painel-financeiro.tsx`. */
  como?: "div" | "li";
}) {
  const Item = como === "li" ? m.li : m.div;

  return (
    <Item
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      /* Sai só com opacidade e escala, nunca com altura: animar altura exigiria
         `overflow: hidden`, que cortaria o anel de foco. O vão fecha de um
         golpe depois — mas aí o item já está invisível, e o que se vê é o
         espaço vazio se fechando, não o item saltando.

         Fechar o vão suavemente pediria o recurso `layout`, que só existe no
         conjunto `domMax`: 12 kB a mais, para a categoria de movimento mais
         desconfortável para quem tem sensibilidade vestibular. */
      exit={{
        opacity: 0,
        scale: 0.98,
        transition: { duration: DURACAO.saida, ease: CURVA.partida },
      }}
      transition={{ duration: DURACAO.chegada, ease: CURVA.chegada }}
      className={className}
    >
      {children}
    </Item>
  );
}
