# Inteligência Evangelizadora

Acompanhamento das missões de São Paulo: membros, grupos de oração e ações
apostólicas — com dashboards, calendário mensal e controle financeiro por evento.

Dois pontos de vista sobre os mesmos dados: **administrador geral**, que vê o
panorama de todas as missões, e **responsável de missão**, que enxerga apenas
a sua.

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
`app.usuario_id` e `app.eh_admin` no início de cada transação
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
- **`FORCE ROW LEVEL SECURITY`** em todas as tabelas. O Render entrega um
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

`politicas.sql` é idempotente de propósito: reaplicado a cada migração, ele
acompanha mudanças de schema sem exigir uma migration própria por policy.

## Organização

```
src/
├─ app/
│  ├─ (auth)/login/          entrada
│  ├─ (app)/                 área autenticada (shell + páginas)
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

## Identidade visual

A paleta é **provisional** — roxo litúrgico com dourado quente — e vive
inteiramente em custom properties no topo de `src/app/globals.css`. Trocar a
identidade quando a marca for definida é editar aquele arquivo, não caçar
valores hexadecimais pelo código.

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
