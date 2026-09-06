import { cn } from "@/lib/utils";

/**
 * Envolve conteúdo que acabou de chegar, para que ele entre em vez de piscar.
 *
 * É Server Component e usa `tw-animate-css`, não a Motion — e essa é a decisão
 * central de toda a camada de entrada. Um `m.div` com `initial={{ opacity: 0 }}`
 * escreve `style="opacity:0"` no HTML que o servidor manda. Se o JavaScript não
 * chegar — rede de paróquia, celular velho, que é o cenário real de quem usa
 * isto uma vez por mês — o conteúdo fica invisível para sempre.
 *
 * O `animate-in` põe o estado inicial no keyframe, não no elemento: o CSS é
 * render-blocking, sempre chega, e se a animação não rodar o conteúdo
 * simplesmente aparece. De quebra custa zero byte de JavaScript e já é coberto
 * pelo bloco `prefers-reduced-motion` do globals.css.
 *
 * Para vários irmãos entrando em sequência, use a classe `cascata` no pai:
 * ela não acrescenta nó ao DOM e por isso não desarruma grade.
 */

/* Unidades de espaçamento do Tailwind: 1 = 4px, 2 = 8px. Oito é o teto.
   Classes estáticas porque o Tailwind lê o código como texto e não resolve
   nome de classe montado em tempo de execução. */
const DISTANCIAS = {
  0: "",
  1: "slide-in-from-bottom-1",
  2: "slide-in-from-bottom-2",
} as const;

export function Revelar({
  children,
  className,
  atraso = 0,
  distancia = 1,
  como: Como = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Atraso em milissegundos. Vai no `style` porque só se conhece em tempo de
   * execução; a regra de movimento reduzido zera com `!important`, que vence
   * estilo inline.
   */
  atraso?: number;
  /** `0` só esmaece — para conteúdo que substitui esqueleto da mesma altura. */
  distancia?: keyof typeof DISTANCIAS;
  como?: "div" | "section" | "article" | "li" | "p";
}) {
  return (
    <Como
      className={cn(
        "animate-in fade-in-0 fill-mode-both duration-300 ease-out",
        DISTANCIAS[distancia],
        className,
      )}
      style={atraso ? { animationDelay: `${atraso}ms` } : undefined}
    >
      {children}
    </Como>
  );
}
