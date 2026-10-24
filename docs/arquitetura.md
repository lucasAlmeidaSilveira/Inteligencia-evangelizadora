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
`regras-de-negocio.md`. Quatro são `SECURITY DEFINER`, e só quatro: duas da
sessão, descritas a seguir, e duas da pesquisa pública, descritas na seção
seguinte. Todas têm o `EXECUTE` revogado de `PUBLIC` — a instância é
compartilhada com outro sistema — e `pnpm db:testar-rls` confere isso.

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

### A rota pública: pesquisa de satisfação

`/pesquisa/<token>` é a única página sem login. Vive no grupo `(publico)`, fora
do `(app)` que chama `requerUsuario()`, e está na lista de rotas públicas do
`middleware.ts` (casamento de fronteira, não `startsWith` cru). O que a protege:

1. **Escopo próprio, sem pessoa.** `comPesquisa()` em `escopo.ts` abre a
   transação com `app.papel = 'pesquisa'` e `app.pesquisa_token = <token>`, e
   os quatro valores de pessoa vazios. `comEscopo()` continua sem conhecer esse
   papel (`PAPEIS` tem três), então nenhum caminho de sessão chega ao banco
   como pesquisa — e toda transação escreve os cinco settings, para nada de um
   caminho sobrar no outro.
2. **O papel `pesquisa` não tem policy em tabela alguma.** Todo SELECT, INSERT,
   UPDATE ou DELETE que ele tente devolve zero linhas ou é recusado. O que ele
   alcança são duas funções `SECURITY DEFINER` em `politicas.sql`:
   `ie.pesquisa_do_token()` (título da ação e se a pesquisa aceita respostas) e
   `ie.responder_pesquisa(nota, comentario)` (a única porta de entrada de uma
   resposta, com os limites de inundação dentro dela). Ambas exigem o papel
   `pesquisa` **e** escopo sem pessoa; um coordenador logado que as chamasse
   não obtém nada. A alternativa descartada — policies condicionadas ao token —
   exporia a linha inteira de `eventos` ao escopo público.
3. **Nada de sessão no caminho.** A página não lê cookie, não chama
   `usuarioAtual()` (que carimbaria último acesso) nem `leituraCacheada` (que
   redirecionaria ao login). É `force-dynamic`: sem isso o Next guardaria a
   primeira renderização e a pesquisa seguiria "aberta" depois de encerrada.
4. **Filtros baratos antes do banco** (`src/server/pesquisa.ts`): zod e
   honeypot, um limitador em memória por token e por instância, e um semáforo
   de duas transações públicas simultâneas — o pool tem cinco conexões,
   divididas com os coordenadores. São filtros; a garantia é a função SQL.
5. **Cabeçalhos** em `next.config.ts` para `/pesquisa/*`: sem moldura
   (`X-Frame-Options`, `frame-ancestors 'none'`), sem Referer (o token está na
   URL), sem indexação. A action pública revalida só a etiqueta da ação
   respondida — expirar listas e painel a cada resposta deixaria qualquer
   visitante esvaziar o cache de todas as missões.

O cenário "Pesquisa pública" de `pnpm db:testar-rls` prova os dois lados:
tabelas fechadas para o papel, funções respondendo só ao token certo, aberto e
no prazo, e o limite de 120 respostas por minuto. Ele também confere que **toda
tabela do schema** está com RLS forçado — uma tabela nova fora do array de
`politicas.sql` nasceria sem RLS, e nenhuma outra verificação pegaria.

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
│  ├─ (publico)/pesquisa/    pesquisa de satisfação por token, sem login
│  ├─ (app)/                 área autenticada (shell + páginas)
│  │  ├─ missoes/            missões, centros, grupos de oração, indicadores
│  │  ├─ eventos/            ações apostólicas: geral, financeiro, documentos, links
│  │  ├─ calendario/         grade mensal
│  │  ├─ relatorios/         consolidações + exportação CSV
│  │  ├─ config/             tipos, categorias e usuários (só admin)
│  │  └─ conta/              troca de senha, para qualquer usuário
│  └─ api/
│     ├─ auth/sessao/        troca do token Firebase pelo cookie de sessão
│     └─ lembretes/contagem/ rotina diária do lembrete bimestral (cron)
├─ components/
│  ├─ ui/                    shadcn — não reescrever à mão
│  ├─ padroes/               CabecalhoPagina, CartaoMetrica, EstadoVazio…
│  └─ navegacao/             sidebar, menu de conta
├─ features/<dominio>/       schemas.ts, queries.ts, actions.ts, components/
│  ├─ lembretes/             regras puras, textos e a rotina do lembrete bimestral
│  └─ notificacoes/          o sino do cabeçalho: leitura e "marcar como lida"
├─ lib/                      utilidades que podem ir para o cliente
└─ server/                   só servidor — banco, auth, Firebase Admin, R2, e-mail
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

## Rotinas agendadas e e-mail

Não há fila nem worker: a única rotina é um Route Handler
(`/api/lembretes/contagem`) que a Vercel chama todo dia pelo cron de
`vercel.json`. O que autoriza é `CRON_SECRET` em `Authorization: Bearer`,
comparado em tempo constante; o middleware deixa `/api/lembretes` passar sem
cookie. Qualquer outro agendador serve, desde que mande o segredo.

A rotina roda com o **escopo do sistema** (`src/server/sistema.ts`): papel
`admin` para o RLS e um `usuario_id` que não é de ninguém. É a única situação
em que esse escopo pode ser usado — numa Server Action ele entregaria dado de
todas as missões a quem pediu, sem erro em lugar nenhum.

A lógica em si (`features/lembretes/job.ts`) recebe a transação em vez de
abri-la, e por isso não tem `server-only`: o teste (`pnpm testar:lembretes`)
e a simulação (`pnpm lembretes:simular`) a exercitam direto, numa transação
revertida. `?simular=1` na rota faz o mesmo em produção, sem gravar nem enviar.

E-mail sai pela API HTTP do Resend (`src/server/email.ts`), sem SDK, e é
opcional: sem `RESEND_API_KEY` e `EMAIL_REMETENTE`, o lembrete fica só na
notificação interna. Trocar de provedor é reescrever `enviarEmail`; a rotina
recebe a função e não sabe quem está por trás.

## Fuso horário

**O servidor roda em UTC e o navegador em São Paulo.** Em desenvolvimento as
duas pontas estão no mesmo fuso, então o que depende disso só quebra em
produção — sem erro, com o dado no dia errado. Foi assim que o calendário de
setembro chegou a desenhar a grade de agosto: a página montava "1º de
setembro, meia-noite" como `Date` no servidor, o navegador lia o mesmo instante
como 31 de agosto às 21h, e a ação de 6 de setembro não aparecia em mês nenhum.

Quatro regras, com as funções em `src/lib/fuso.ts`:

- **Dia não atravessa a fronteira como `Date`.** Viaja como chave
  (`"2026-09-06"`, `"2026-09"`), e o Client Component monta a grade a partir
  dela — a mesma conta no HTML do servidor e na hidratação. O recorte de
  período (`lib/periodo.ts`) segue o mesmo caminho: `?de=` e `?ate=` são
  chaves, os atalhos do seletor são chaves, e o `Periodo` com `Date` só existe
  na borda da consulta.
- **"Em que dia cai este instante?" se pergunta no fuso das missões**
  (`diaNoFuso`), nunca no da máquina. Vale para a grade, para a contagem do mês
  e para tudo que se escreve na tela: `formatarData`, `formatarDataHora`,
  `formatarPeriodo` e `formatarCompetencia` (`lib/format.ts`) leem o relógio
  de São Paulo, e por isso o HTML do servidor e o do navegador dizem a mesma
  hora. Valor só de dia (`"2026-09-01"`, o que uma coluna `date` devolve) é
  dia do calendário, não instante: os formatadores o escrevem como está, sem
  passar por `new Date`, que o leria como meia-noite UTC — dia 31 de agosto em
  São Paulo.
- **Limite de consulta é instante de São Paulo** (`inicioDoDia`, `fimDoDia`,
  `instanteNoFuso`): o dia começa às 3h UTC, e o mês e o ano também. Com
  meia-noite UTC, a ação das 22h do último dia do mês cairia no mês seguinte.
- **`Date` do fuso da máquina só na conversa com o `react-day-picker`**, que
  fala em meia-noite local: `dataLocal` e `chaveLocal` (`lib/periodo.ts`)
  fazem a tradução para chave e são as únicas funções que leem o fuso do
  navegador de propósito.

E o caminho inverso: o texto sem fuso que o formulário de data entrega
(`"2026-09-06T08:00"`) vira instante por `paraInstante`, **no relógio de São
Paulo**, antes de ir à Server Action — lido lá com `new Date(texto)`, seria
UTC. `paraDatetimeLocal`, que escreve esse texto, usa o mesmo relógio: a
página de edição o chama no servidor e o navegador devolve o valor, e os dois
lendo fusos diferentes deslocariam a ação três horas a cada salvamento.

`pnpm testar:calendario` roda as verificações — grade, recorte, formatadores,
relatório anual e formulário — em quatro fusos de processo e exige o mesmo
resultado em todos.

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
