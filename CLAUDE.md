@AGENTS.md

# Inteligência Evangelizadora

Acompanhamento das missões da **Comunidade Católica Shalom** em São Paulo:
membros, grupos de oração e ações apostólicas — com painel, calendário mensal,
relatórios e prestação de contas por ação.

Quem usa são coordenadores de missão, não operadores de sistema. Muitos entram
uma vez por mês. Cada tela precisa ser entendível sem treinamento, e cada
mensagem de erro precisa dizer o que fazer.

## Antes de escrever código

| Vai mexer em | Leia |
|---|---|
| Papéis, permissões, domínio | `docs/regras-de-negocio.md` |
| Cor, tipografia, marca, componentes | `docs/identidade-visual.md` |
| RLS, sessão, banco, estrutura | `docs/arquitetura.md` |
| Instalar, configurar, operar | `README.md` |

Next.js 16 tem mudanças que contrariam o que se costuma assumir — o bloco
`AGENTS.md` acima manda ler `node_modules/next/dist/docs/`. Vale.

## Idioma

Domínio, código e interface em **português**: arquivos, funções, variáveis,
colunas, rotas e mensagens. `criarMissao`, não `createMission`. A exceção é
`src/components/ui/`, que é shadcn e fica como veio — reescrever aquilo
quebraria toda atualização futura do gerador.

Comentário explica **por quê**: a decisão, a alternativa descartada e o que ela
evita. Comentário que repete o que a linha já diz é ruído — o código existente
segue esse padrão, siga também.

## Invariantes

Coisas que o sistema depende para estar correto. Mexer em qualquer uma exige
entender o motivo primeiro; várias falham em silêncio, sem quebrar teste nem
tela.

1. **A aplicação conecta como `ie_app`, nunca como dona do schema.** Um papel
   com `BYPASSRLS` ignora todas as políticas — é mais forte que
   `FORCE ROW LEVEL SECURITY` — e desligaria o isolamento entre missões sem
   nenhum sintoma visível. `pnpm db:testar-rls` confere isso antes de tudo.

2. **Todo dado de missão passa por `comUsuario()`** (`src/server/dados.ts`) ou
   `comEscopo()` (`src/server/db/escopo.ts`). É o que torna impossível
   esquecer um `where missao_id` e devolver dado alheio. Nunca use o `pool`
   direto numa consulta de domínio.

3. **Permissão se decide no servidor.** Esconder um botão não é permissão.
   Toda Server Action confere papel (`requerAdmin`, `podeConvidar`,
   `normalizar` em `features/config/actions.ts`) e nunca confia em `papel` ou
   `missaoId` vindos do formulário — um responsável poderia forjar a
   requisição e criar outro administrador.

4. **Dinheiro nunca vira `float`.** O Postgres devolve `numeric` como string
   justamente para não perder centavos; as contas se fazem em centavos
   inteiros (`features/eventos/financeiro.ts`). E não existe coluna de saldo
   em lugar nenhum: saldo é soma de receitas menos despesas, calculada na
   leitura. Coluna de saldo é estado que diverge dos lançamentos.

5. **A chave privada do Firebase nunca leva `NEXT_PUBLIC_`.** O Next embute
   essas variáveis no bundle do navegador — seria entregar acesso
   administrativo do projeto a qualquer visitante.

6. **Escrita passa por zod antes do banco.** Server Action valida, devolve
   `Resultado` (`{ ok: true }` ou `{ ok: false, erro, campos }`) e traduz erro
   de Postgres em frase legível via `traduzirErroDeBanco`.

7. **`pnpm.overrides` fixa `jwks-rsa>jose` na versão 5.** A 6 abandonou o
   build CommonJS e derruba toda a autenticação em produção com
   `ERR_REQUIRE_ESM`. Só remova quando `jwks-rsa` publicar suporte a CJS.

8. **O semeador de demonstração recusa qualquer host que não seja
   `localhost`.** Ele apaga tudo antes de semear.

9. **Foco visível nunca é removido, e cor nunca é o único diferenciador.**
   Ambos são requisito de acessibilidade, não estética.

## Convenções

- **Ler em Server Component, escrever em Server Action.** Não há camada REST:
  ela só reimplementaria o que o RLS já faz.
- **Cada domínio em `src/features/<dominio>/`** — `schemas.ts` (zod),
  `queries.ts` (leitura), `actions.ts` (escrita) e `components/` juntos.
- **`src/server/` é só servidor** (marcado com `server-only`); `src/lib/` é o
  que pode ir para o cliente.
- **Toda rota tem `loading.tsx`** com esqueleto da altura do conteúdo real.
- **Depois de escrever, revalide a árvore** que exibe o número alterado — os
  totais de uma missão aparecem em várias telas ao mesmo tempo.

## Comandos

```bash
pnpm dev                 # desenvolvimento
pnpm typecheck           # next typegen && tsc --noEmit — rode antes de entregar
pnpm lint
pnpm db:generate         # migration a partir de schema.ts
pnpm db:migrate          # aplica migrations E reaplica as políticas de RLS
pnpm db:testar-rls       # prova que o isolamento entre missões funciona
pnpm ambiente            # mostra a qual banco o .env.local aponta
```

Lista completa no `README.md`. Antes de entregar qualquer mudança:
`pnpm typecheck`. Se mexeu em schema ou policy: `pnpm db:testar-rls` também.
