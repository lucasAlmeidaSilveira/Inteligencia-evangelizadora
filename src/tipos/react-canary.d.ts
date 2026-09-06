/// <reference types="react/canary" />

/*
 * `<ViewTransition>` existe em tempo de execução: o React que o Next 16
 * empacota exporta o componente tanto no build do cliente quanto no
 * `react-server` — por isso ele funciona dentro de Server Component, e não há
 * flag a habilitar no `next.config.ts`.
 *
 * O que falta é só a declaração de tipo: o `@types/react` publica
 * `ViewTransition` em `canary.d.ts`, não em `index.d.ts`. Esta referência
 * expõe aquele arquivo.
 *
 * A alternativa seria um array `types` no `tsconfig.json`, mas ele desliga a
 * inclusão automática de `@types/node` e quebraria o resto do projeto.
 */
