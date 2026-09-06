# Inteligência Evangelizadora

Acompanhamento das missões de São Paulo: membros, grupos de oração e ações
apostólicas — com dashboards, calendário mensal e controle financeiro por evento.

| Documentação | |
|---|---|
| [Regras de negócio](docs/regras-de-negocio.md) | Papéis, permissões e o que o sistema garante sobre o domínio |
| [Identidade visual](docs/identidade-visual.md) | Marca, cor, tipografia e padrões de interface |
| [Arquitetura](docs/arquitetura.md) | Sessão, RLS, organização do código e decisões de desempenho |
| [CLAUDE.md](CLAUDE.md) | Invariantes e convenções, para quem programa com IA |

## Quem faz o quê

| | Admin master | Responsável | Auxiliar |
|---|---|---|---|
| Criar e excluir missão | ✓ | | |
| Tipos de ação e categorias | ✓ | | |
| Editar cadastro da missão | ✓ | ✓ (a sua) | |
| Convidar pessoas | ✓ (qualquer) | ✓ (auxiliares da sua missão) | |
| Grupos, ações, financeiro, documentos, indicadores | ✓ | ✓ | ✓ |
| Painel, calendário e relatórios | todas as missões | a sua | a sua |
| Trocar a própria senha | ✓ | ✓ | ✓ |

Cada pessoa pertence a **uma** missão; o admin master não pertence a nenhuma e
por isso enxerga todas. Cada missão tem **exatamente um** responsável — imposto
por índice único parcial no banco, não por convenção.

O fluxo começa no admin master: ele cria a missão e, no mesmo passo, convida o
responsável, recebendo um link para enviar. Dali em diante o responsável se
vira sozinho, convidando os auxiliares da sua missão.

## Stack

| Camada | Escolha |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript |
| Interface | Tailwind CSS v4, shadcn/ui sobre Radix, lucide-react |
| Banco | PostgreSQL (Neon, região São Paulo), schema `ie`, via Drizzle ORM |
| Autenticação | Firebase Auth (e-mail e senha) |
| Arquivos | Cloudflare R2, bucket privado |

## Como o acesso é protegido

O Firebase confirma **quem** é a pessoa. O Postgres decide **o que** ela vê.

O banco não conhece o usuário final — quem o informa é a aplicação, gravando
`app.usuario_id`, `app.firebase_uid`, `app.papel` e `app.missao_id` no
início de cada transação
(`src/server/db/escopo.ts`). As políticas de RLS em `drizzle/politicas.sql`
leem esses valores.

Quatro detalhes que sustentam isso e não devem ser mexidos sem entender:

- **A aplicação conecta como `ie_app`, nunca como dona do schema.** Um papel
  com o atributo `BYPASSRLS` ignora todas as políticas — é mais forte que
  `FORCE ROW LEVEL SECURITY` — e o `neondb_owner` que o Neon cria vem com ele
  ligado. Rodar a aplicação com esse papel desligaria o isolamento entre
  missões silenciosamente. `pnpm db:testar-rls` verifica isso antes de
  qualquer outra coisa e falha se a conexão estiver errada.

- **`set_config(..., true)`** deixa o escopo local à transação. Ele desaparece
  no commit e nunca vaza para a próxima requisição que reutilizar a conexão.
- **`FORCE ROW LEVEL SECURITY`** em todas as tabelas. O provedor entrega um
  usuário dono das tabelas, e o dono ignora RLS por padrão — sem `FORCE`, as
  políticas seriam decorativas.
- **Toda leitura e escrita de dados de missão passa por `comEscopo()`.** É o
  que torna impossível esquecer um `where missao_id` e devolver dados alheios.

O middleware apenas confere se o cookie existe, para redirecionar cedo. Quem
valida a sessão de verdade é `usuarioAtual()`, no servidor.

## Configuração inicial

### 1. Firebase

Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
e ative **Authentication → Sign-in method → E-mail/senha**.

- As três variáveis `NEXT_PUBLIC_FIREBASE_*` estão em *Configurações do projeto → Seus apps*.
- As três `FIREBASE_*` (conta de serviço) em *Configurações do projeto → Contas de serviço → Gerar nova chave privada*.

> A chave privada **nunca** leva o prefixo `NEXT_PUBLIC_`. O Next embute
> variáveis com esse prefixo no bundle do navegador, o que entregaria acesso
> administrativo ao projeto Firebase para qualquer visitante.

### 2. Cloudflare R2

Crie um bucket privado e um token de API com permissão de leitura e escrita
nele. `R2_ACCOUNT_ID` aparece na URL do painel do R2.

### 3. Banco

Crie um projeto no [Neon](https://neon.com) na região **AWS South America
(São Paulo)** — `aws-sa-east-1`. A região não pode ser alterada depois, e é
ela que mantém as consultas em ~22 ms em vez de ~214 ms.

Coloque a connection string em `DATABASE_URL_ADMIN` e rode `pnpm db:criar-papel`:
ele cria o papel `ie_app`, concede as permissões de dados (não de estrutura) e
grava as duas URLs no `.env.local`.

### 4. Variáveis e migração

```bash
cp .env.example .env.local     # preencha os valores
pnpm install
pnpm db:testar                 # confere conexão e permissões
pnpm db:migrate                # cria o schema e aplica as políticas de RLS
pnpm db:criar-papel            # cria o papel da aplicação, sem BYPASSRLS
pnpm db:seed                   # tipos de evento e categorias financeiras iniciais
pnpm admin:criar seu@email.com "Seu Nome"
pnpm db:testar-rls             # prova que o isolamento entre missões funciona
```

O `admin:criar` existe só para o primeiro acesso — o problema do ovo e da
galinha. Dali em diante, usuários são convidados pela própria interface, em
**Configurações → Usuários**.

O último comando imprime um link para definir a senha — sem ele não há como
entrar, já que não existe cadastro público.

```bash
pnpm dev
```

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm typecheck` | Tipos do Next e `tsc --noEmit` |
| `pnpm db:generate` | Gera migration a partir de `schema.ts` |
| `pnpm db:migrate` | Aplica migrations **e** reaplica as políticas de RLS |
| `pnpm db:studio` | Navegador visual do banco |
| `pnpm db:seed` | Dados de configuração iniciais (reexecutável) |
| `pnpm db:criar-papel` | Cria/renova o papel `ie_app` e grava as URLs |
| `pnpm db:copiar` | Copia os dados de outro banco (migração de provedor) |
| `pnpm db:estado` | Retrato rápido do que existe no banco |
| `pnpm admin:criar` | Cria o primeiro administrador |
| `pnpm db:testar` · `db:testar-rls` · `db:testar-regras` | Conexão, isolamento e regras de domínio |
| `pnpm testar:schemas` · `testar:consultas` | Validação e consultas, contra números conhecidos |
| `pnpm firebase:testar` · `firebase:importar` · `r2:testar` | Credenciais dos serviços externos |
| `pnpm ambiente` | Mostra a qual banco o `.env.local` aponta |
| `pnpm ambiente demo` · `ambiente producao` | Alterna entre os dois |
| `pnpm demo:subir` · `demo:resemear` · `demo:derrubar` | Banco local de demonstração |

`politicas.sql` é idempotente de propósito: reaplicado a cada migração, ele
acompanha mudanças de schema sem exigir uma migration própria por policy.

## Organização

```
src/
├─ app/
│  ├─ (auth)/login/          entrada
│  ├─ (app)/                 área autenticada (shell + páginas)
│  │  ├─ missoes/            missões, grupos de oração, indicadores
│  │  ├─ eventos/            ações apostólicas: geral, financeiro, documentos, links
│  │  ├─ calendario/         grade mensal
│  │  ├─ relatorios/         consolidações + exportação CSV
│  │  ├─ config/             tipos, categorias e usuários (só admin)
│  │  └─ conta/              troca de senha, para qualquer usuário
│  └─ api/auth/sessao/       troca do token Firebase pelo cookie de sessão
├─ components/
│  ├─ ui/                    shadcn
│  └─ navegacao/             sidebar, menu de conta
├─ features/<dominio>/       schema zod, Server Actions e queries juntos
├─ lib/                      utilidades compartilhadas com o cliente
└─ server/                   só servidor — banco, auth, Firebase Admin, R2
```

Leitura em Server Components, escrita em Server Actions validadas por zod.
Não há camada REST intermediária: ela só reimplementaria o que o RLS já faz.

## Gráficos

A paleta das séries foi validada por script, não escolhida a olho: faixa de
luminosidade, piso de croma, separação para daltonismo e contraste contra a
superfície. As duas paletas — clara e escura — foram validadas em separado; a
escura não é uma inversão da clara.

Cor nunca é o único diferenciador: as linhas têm padrões de traço distintos e
séries têm legenda. Todo gráfico deve oferecer também "Ver como tabela" — por
ora só o de evolução tem.

## Identidade visual

Azul e laranja não são preferência estética: são as cores da Comunidade
Católica Shalom, e carregam os dois polos do carisma — o azul é a profundidade
da contemplação, o laranja é o fogo do impulso missionário. O monograma leva os
dois: o E azul é a estrutura que acumula, o I laranja é quem sai dela.

A paleta vive inteiramente em custom properties no topo de
`src/app/globals.css`, em OKLCH e com contrastes medidos. Ajustar um tom é
editar aquele arquivo, não caçar valores hexadecimais pelo código.

Construção do monograma, pares tipográficos e regras de uso em
[`docs/identidade-visual.md`](docs/identidade-visual.md).

## Banco de demonstração

Um Postgres local em Docker, com dados fictícios em volume realista — cinco
missões, doze meses de competências por missão, dezenas de ações apostólicas
com lançamentos. Serve para ver o painel, os gráficos e o calendário
funcionando sem tocar em dado real.

```bash
pnpm demo:subir          # container, schema, papel da aplicação e dados
pnpm ambiente demo       # aponta o .env.local para ele
pnpm dev

pnpm ambiente producao   # volta para o Neon
```

Trocar de ambiente não descarta credencial: `pnpm ambiente` guarda as do outro
lado em linhas comentadas no próprio `.env.local`, e `pnpm ambiente` sozinho
mostra onde você está.

O semeador **recusa rodar** contra qualquer host que não seja `localhost` — ele
apaga tudo antes de semear, e um esquecimento de variável de ambiente destruiria
produção.

## Uma armadilha de dependência que vale conhecer

O `firebase-admin` chega ao `jose` pela cadeia `firebase-admin → jwks-rsa →
jose`. A versão 6 do `jose` abandonou o build CommonJS, e o `jwks-rsa` ainda o
carrega com `require()` — o que quebra em runtimes sem suporte a `require()` de
ESM, incluindo o da Vercel. Sintoma: toda a autenticação para, com
`ERR_REQUIRE_ESM`.

Três defesas estão no repositório:

- **`pnpm.overrides` fixa `jwks-rsa>jose` na versão 5**, que ainda publica
  CommonJS. O `jwks-rsa` usa só `importJWK`, `exportSPKI` e
  `decodeProtectedHeader`, idênticas nas duas versões. Remover quando o
  `jwks-rsa` publicar suporte a CJS.
- **O `firebase-admin` é importado dinamicamente.** Uma falha ao carregar vira
  exceção tratável — sessão inválida leva ao login — em vez de derrubar o
  módulo e responder 500 em toda página.
- **`pnpm firebase:testar` verifica um token de ponta a ponta.** A checagem
  antiga só chamava `listUsers`, que não passa pelo `jwks-rsa`: ela dava verde
  enquanto a autenticação estava quebrada.

## Desempenho

O banco fica em São Paulo por um motivo medido: cada ida e volta custa ~22 ms
de lá, contra ~214 ms de Oregon. Como uma página faz várias, a diferença
aparece inteira na tela — as mesmas rotas saíram de 1,8–2,6 s para 0,2–0,35 s.

Duas escolhas no código dependem disso e valem preservar:

- **`BEGIN` e o escopo do RLS viajam na mesma ida.** São enviados como uma
  instrução só, o que exige o protocolo simples do Postgres; por isso os
  valores são validados por formato antes de entrar na string.
- **Uma transação por página, não uma por consulta.** `obterEventoCompleto`
  busca evento, lançamentos, documentos e links de uma vez; o `cache` do React
  faz o layout e a aba dividirem o mesmo resultado.

Toda rota tem `loading.tsx` com esqueleto da altura do conteúdo real, e os
layouts de detalhe transmitem em partes — o cabeçalho carrega em fronteira
própria para não segurar a navegação.
