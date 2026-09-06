# Arquitetura

Como uma requisição atravessa o sistema, e por que cada peça está onde está.

## A ideia central

**O Firebase confirma quem é a pessoa. O Postgres decide o que ela vê.**

O banco não conhece o usuário final — quem o informa é a aplicação, gravando
`app.usuario_id`, `app.firebase_uid`, `app.papel` e `app.missao_id` no início
de cada transação. As políticas de RLS em `drizzle/politicas.sql` leem esses
valores.

```
navegador → middleware (só confere cookie)
          → Server Component / Server Action
          → usuarioAtual()      valida o cookie de sessão de verdade
          → comUsuario()        abre transação já com o escopo aplicado
          → RLS                 decide linha a linha o que existe
```

## Sessão

`src/server/auth/sessao.ts`.

- Login troca o token do Firebase por um **cookie de sessão httpOnly**
  (`ie_sessao`, 5 dias). O token do cliente vive 1 hora e é acessível ao
  JavaScript da página; o cookie de sessão, nunca.
- Na criação da sessão vale `verifyIdToken(token, true)` — a checagem de
  revogação acontece uma vez, não a cada página.
- Em toda requisição, `usuarioAtual()` verifica o cookie **sem**
  `checkRevoked`: essa opção custa uma chamada à API do Firebase por
  requisição (~300 ms medidos). A verificação local já confere assinatura e
  validade, e o que precisa surtir efeito imediato — desativar alguém — é lido
  do nosso banco, no campo `ativo`.
- `usuarioAtual` é embrulhado no `cache` do React: dez Server Components podem
  perguntar quem está logado, e a verificação acontece uma vez.
- Guardas prontos: `requerUsuario()`, `requerAdmin()`, `requerQuemConvida()`.
  Eles redirecionam em vez de lançar erro.
- Sair revoga os refresh tokens — encerra a sessão em todos os dispositivos.
- **O "último acesso" é carimbado no COMMIT do carregamento da sessão**, por
  `ie.registrar_acesso()`, com janela de 15 minutos dentro do próprio SQL: pega
  carona numa ida ao banco que já acontece, e dentro da janela não escreve
  nada. Fica aqui, e não no login, porque o cookie dura 5 dias — marcar só na
  entrada mostraria uma data velha para quem está com o sistema aberto.

**O middleware é conveniência, não segurança.** Ele roda no Edge, onde o SDK
do Firebase Admin não existe; só verifica se o cookie está presente, para
redirecionar cedo e evitar o piscar de tela protegida. Por isso o nome do
cookie mora em `src/lib/auth-cookie.ts`, um módulo sem dependência alguma.

## Escopo e RLS

`src/server/db/escopo.ts` e `drizzle/politicas.sql`.

Cinco detalhes que sustentam o isolamento e não devem ser mexidos sem entender:

1. **A aplicação conecta como `ie_app`, papel sem `BYPASSRLS`.** Esse atributo
   ignora todas as políticas — é mais forte que `FORCE ROW LEVEL SECURITY` — e
   o `neondb_owner` que o Neon cria vem com ele ligado. Rodar a aplicação com
   esse papel desligaria o isolamento entre missões em silêncio.
   `pnpm db:testar-rls` verifica isso antes de qualquer outra coisa.
2. **`set_config(..., true)` deixa o escopo local à transação.** Ele some no
   commit e nunca vaza para a próxima requisição que reutilizar a conexão do
   pool.
3. **`FORCE ROW LEVEL SECURITY` em todas as tabelas**, porque o dono das
   tabelas ignora RLS por padrão — sem isso, as políticas seriam decorativas.
4. **Toda leitura e escrita passa por `comEscopo()`**, e é isso que torna
   impossível esquecer um `where missao_id`.
5. **`BEGIN` e o escopo viajam na mesma ida ao banco.** Cada ida e volta pesa
   mais que a consulta em si; juntar as duas primeiras corta um quarto do
   tempo da transação. Isso exige o protocolo simples do Postgres, que não
   aceita parâmetros — por isso os valores são **validados por formato** antes
   de entrar na string, e qualquer coisa fora do padrão vira escopo vazio, que
   o RLS trata como "ninguém".

**As funções das policies** (`ie.eh_admin()`, `ie.tem_acesso_missao()`,
`ie.pode_editar_missao()`…) são a tradução SQL da tabela de permissões em
`regras-de-negocio.md`. Duas são `SECURITY DEFINER`, e só duas.

`ie.missao_pelo_token()` existe porque sem ela há recursão — a policy de
`usuarios` chamaria uma função que consulta `usuarios`, disparando a policy de
novo até estourar a pilha.

`ie.registrar_acesso()` existe por outro motivo: **não há policy de UPDATE da
própria linha em `usuarios`, e não deve haver.** Policy autoriza a *linha*, não
a coluna — a mesma regra que liberasse carimbar `ultimo_acesso_em` liberaria
`set papel = 'admin'` a qualquer caminho de código que surgisse depois. Dentro
da função, a coluna que pode mudar está escrita no corpo, e é só ela.

A superfície das duas é mínima: nenhuma aceita parâmetro — agem sempre sobre a
linha do `firebase_uid` que o escopo já identificou — e ambas têm `search_path`
fixo, porque uma função `SECURITY DEFINER` com `search_path` aberto pode ser
induzida a chamar objetos plantados por quem a invoca.

`politicas.sql` é **idempotente de propósito**: reaplicado a cada
`pnpm db:migrate`, acompanha mudanças de schema sem exigir uma migration por
policy. **Tabela nova exige três edições nele**: os dois arrays do topo — o do
trigger de `atualizado_em` e o do `enable/force row level security` — e a
policy em si. Esquecer o segundo array deixa a tabela sem RLS nenhum, e nada
na tela denuncia.

**Nem toda regra de isolamento cabe numa policy.** `centros_evangelizacao` tem
a policy de escopo como as demais, mas o que impede um grupo de apontar para o
centro de outra missão é uma chave estrangeira sobre o par
`(centro_id, missao_id)`: a linha inserida seria da missão de quem escreve, e
passaria em qualquer policy. Quando a regra é sobre a *combinação* de duas
colunas, o lugar dela é uma constraint.

Essa chave é `no action`, e a diferença para `restrict` importa: `no action` é
conferido no fim do comando, então apagar uma missão funciona mesmo com as
cascatas removendo centros e grupos na mesma instrução. `restrict` dispararia
no meio da cascata e recusaria — o `db:testar-rls` cobre isso.

## Organização do código

```
src/
├─ app/
│  ├─ (auth)/login/          entrada
│  ├─ (app)/                 área autenticada (shell + páginas)
│  │  ├─ missoes/            missões, centros, grupos de oração, indicadores
│  │  ├─ eventos/            ações apostólicas: geral, financeiro, documentos, links
│  │  ├─ calendario/         grade mensal
│  │  ├─ relatorios/         consolidações + exportação CSV
│  │  ├─ config/             tipos, categorias e usuários (só admin)
│  │  └─ conta/              troca de senha, para qualquer usuário
│  └─ api/auth/sessao/       troca do token Firebase pelo cookie de sessão
├─ components/
│  ├─ ui/                    shadcn — não reescrever à mão
│  ├─ padroes/               CabecalhoPagina, CartaoMetrica, EstadoVazio…
│  └─ navegacao/             sidebar, menu de conta
├─ features/<dominio>/       schemas.ts, queries.ts, actions.ts, components/
├─ lib/                      utilidades que podem ir para o cliente
└─ server/                   só servidor — banco, auth, Firebase Admin, R2
```

**Onde colocar código novo:** um domínio novo é uma pasta em `features/` com
as quatro peças. Nada de `services/`, `utils/` genéricos ou camada REST — ela
só reimplementaria o que o RLS já faz.

`src/server/` é marcado com `server-only`: importar de lá no cliente quebra o
build, que é o objetivo.

## Leitura e escrita

- **Leitura em Server Component.** A página chama uma função de `queries.ts`,
  que roda dentro de `comUsuario()`.
- **Escrita em Server Action**, validada por zod antes de tocar o banco. O
  retorno é sempre `Resultado`:
  `{ ok: true }` · `{ ok: true, dados }` · `{ ok: false, erro, campos }`.
- **Erro de Postgres vira frase legível** por `traduzirErroDeBanco`. Criou
  restrição nova? Acrescente a tradução dela.
- **Depois de escrever, revalide a árvore.** Os totais de uma missão aparecem
  na listagem, na visão geral e no painel ao mesmo tempo; revalidar só a
  página alterada deixaria as outras servindo o número anterior. O padrão é
  `revalidatePath("/missoes", "layout")` mais a raiz.

## Desempenho

O banco fica em São Paulo por um motivo medido: cada ida e volta custa ~22 ms
de lá, contra ~214 ms de Oregon. Como uma página faz várias, a diferença
aparece inteira na tela — as mesmas rotas saíram de 1,8–2,6 s para 0,2–0,35 s.

Duas escolhas dependem disso e valem preservar:

- **`BEGIN` e escopo na mesma ida** (ver acima).
- **Uma transação por página, não uma por consulta.** `obterEventoCompleto`
  busca evento, lançamentos, documentos e links de uma vez; o `cache` do React
  faz o layout e a aba dividirem o mesmo resultado.

Toda rota tem `loading.tsx` com esqueleto da altura do conteúdo real, e os
layouts de detalhe transmitem em partes — o cabeçalho carrega em fronteira
própria para não segurar a navegação.

## Arquivos (R2)

Bucket **privado** no Cloudflare R2. O navegador envia direto por URL
assinada: os bytes não passam pelo servidor Next. Quem autoriza é a Server
Action que gera a URL — ela só a devolve depois de confirmar acesso à missão.
Limites e tipos aceitos em `src/server/armazenamento/r2.ts`.

## Banco e migrations

```bash
pnpm db:generate    # migration a partir de schema.ts
pnpm db:migrate     # aplica migrations E reaplica politicas.sql
pnpm db:testar-rls  # prova o isolamento entre missões
```

Mexeu em `schema.ts`? Gere a migration. Mexeu em permissão? Ajuste
`politicas.sql` **e** a tabela de papéis em `regras-de-negocio.md` — as duas
descrevem a mesma regra, e divergir é pior que não documentar.

## Ambientes

`.env.local` aponta para um banco por vez. `pnpm ambiente` mostra qual;
`pnpm ambiente demo` e `pnpm ambiente producao` alternam, guardando as
credenciais do outro lado em linhas comentadas no próprio arquivo.

O banco de demonstração é um Postgres local em Docker com dados fictícios em
volume realista (`pnpm demo:subir`). **O semeador recusa rodar contra qualquer
host que não seja `localhost`** — ele apaga tudo antes de semear, e um
esquecimento de variável destruiria produção.

## A armadilha do `jose`

`firebase-admin → jwks-rsa → jose`. A versão 6 do `jose` abandonou o build
CommonJS, e o `jwks-rsa` ainda o carrega com `require()` — o que quebra em
runtimes sem suporte a `require()` de ESM, incluindo o da Vercel. Sintoma:
**toda a autenticação para**, com `ERR_REQUIRE_ESM`.

Três defesas no repositório:

- **`pnpm.overrides` fixa `jwks-rsa>jose` na 5**, que ainda publica CommonJS.
  O `jwks-rsa` usa só `importJWK`, `exportSPKI` e `decodeProtectedHeader`,
  idênticas nas duas versões. Remover só quando `jwks-rsa` publicar CJS.
- **O `firebase-admin` é importado dinamicamente.** Uma falha ao carregar vira
  exceção tratável — sessão inválida leva ao login — em vez de derrubar o
  módulo e responder 500 em toda página.
- **`pnpm firebase:testar` verifica um token de ponta a ponta.** A checagem
  antiga só chamava `listUsers`, que não passa pelo `jwks-rsa`: dava verde
  enquanto a autenticação estava quebrada.
