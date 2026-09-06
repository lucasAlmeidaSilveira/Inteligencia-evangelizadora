import { cn } from "@/lib/utils";

/**
 * Monograma IE — Inteligência Evangelizadora.
 *
 * **A construção.** Toda medida do desenho é a anterior dividida por φ
 * (1,618), numa cascata que fecha sozinha:
 *
 * | medida | valor | origem |
 * |---|---|---|
 * | altura de caixa alta | 22,00 | módulo |
 * | largura do E | 13,60 | 22 / φ |
 * | braço do meio | 8,40 | 13,60 / φ |
 * | espessura da haste | 5,19 | 8,40 / φ |
 * | contraforma entre braços | 3,21 | 5,19 / φ |
 * | vão entre o I e o E | 1,98 | 5,19 / φ² |
 *
 * Três hastes de 5,19 mais duas contraformas de 3,21 somam exatamente 22 — a
 * caixa fecha sem nenhum ajuste manual. Não é um enfeite matemático: é o que
 * faz o E parecer certo sem que ninguém saiba por quê.
 *
 * **A leitura das formas.** O E é a estrutura: três braços, os três eixos que
 * o sistema acompanha — membros, grupos de oração e ações apostólicas. Ele é
 * fechado, estável, apoiado na base. O I é quem sai: uma única vertical, sem
 * travessa, do lado de fora da estrutura. É o único elemento laranja.
 *
 * **A leitura das cores.** Azul e laranja são as cores da Comunidade Católica
 * Shalom. O azul é a profundidade — oração, escuta, o que se acumula. O
 * laranja é o fogo — o impulso que faz sair. A instituição é azul; quem é
 * enviado é laranja. O contraste entre as duas é o carisma inteiro.
 *
 * Cantos com raio 1,2: o suficiente para o desenho não cortar, longe do
 * arredondamento total, que transformaria as hastes em cápsulas soltas.
 */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-8", className)}
    >
      {/* I — enviado. Assume o acento; o pai pode trocá-lo por --marca-acento. */}
      <rect
        x="5.61"
        y="5"
        width="5.19"
        height="22"
        rx="1.2"
        fill="var(--marca-acento, var(--laranja))"
      />
      {/* E — estrutura. Segue a cor do texto ao redor. */}
      <g fill="currentColor">
        <rect x="12.79" y="5" width="5.19" height="22" rx="1.2" />
        <rect x="12.79" y="5" width="13.6" height="5.19" rx="1.2" />
        <rect x="12.79" y="13.4" width="8.4" height="5.19" rx="1.2" />
        <rect x="12.79" y="21.81" width="13.6" height="5.19" rx="1.2" />
      </g>
    </svg>
  );
}

/**
 * O mesmo monograma dentro do azul da marca — a versão que vira ícone de
 * aplicativo e favicon. Existe porque a marca solta depende do fundo, e barra
 * lateral, aba do navegador e tela inicial não garantem fundo nenhum.
 *
 * O símbolo ocupa 1/φ do quadrado; o raio do canto é 32/φ³.
 */
export function SimboloBloco({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-marca-azul text-marca-tinta [--marca-acento:var(--marca-luz)]",
        "flex shrink-0 items-center justify-center rounded-[22%] size-8",
        className,
      )}
    >
      <Simbolo className="size-[61.8%]" />
    </span>
  );
}

/** Assinatura: símbolo e nome. Usada no login e na barra lateral. */
export function Marca({
  className,
  tamanho = "normal",
}: {
  className?: string;
  tamanho?: "normal" | "grande";
}) {
  const grande = tamanho === "grande";

  return (
    <span className={cn("flex items-center gap-3", className)}>
      {/* A caixa do símbolo é quadrada, mas o desenho ocupa 22/32 dela. Os
          tamanhos abaixo são os que igualam a altura desenhada ao bloco de
          duas linhas do nome — alinhamento óptico, não numérico. */}
      <Simbolo className={grande ? "size-16" : "size-12"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-brand font-semibold tracking-tight",
            grande ? "text-2xl" : "text-lg",
          )}
        >
          Inteligência
        </span>
        <span
          className={cn(
            "font-brand tracking-tight opacity-70",
            grande ? "text-2xl" : "text-lg",
          )}
        >
          Evangelizadora
        </span>
      </span>
    </span>
  );
}
