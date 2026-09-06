/**
 * Módulo isolado só para o `import()` do `LazyMotion`.
 *
 * A forma óbvia — `import("motion/react").then((m) => m.domAnimation)` —
 * arrastaria o proxy `motion` inteiro (34,9 kB) para dentro do chunk, porque o
 * bundler não descarta o resto de um namespace importado dinamicamente. Com um
 * módulo de um único export, desce apenas o conjunto de recursos (17,85 kB).
 *
 * `domAnimation` e não `domMax`: o `max` acrescenta arrastar e animação de
 * layout e sobe para 29,8 kB, o que somado ao `m` daria 35,8 kB — mais caro
 * que importar `motion` inteiro. Animação de layout também é a categoria mais
 * desconfortável para quem tem sensibilidade vestibular. Onde faria falta (o
 * indicador de aba que desliza) usamos `<ViewTransition>`, que custa 0 kB.
 */
export { domAnimation as default } from "motion/react";
