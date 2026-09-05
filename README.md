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
| Banco | PostgreSQL (Render), schema `ie`, via Drizzle ORM |
| Autenticação | Firebase Auth (e-mail e senha) |
| Arquivos | Cloudflare R2, bucket privado |

## Como o acesso é protegido

O Firebase confirma **quem** é a pessoa. O Postgres decide **o que** ela vê.

O banco não conhece o usuário final — quem o informa é a aplicação, gravando
`app.usuario_id` e `app.eh_admin` no início de cada transação
(`src/server/db/escopo.ts`). As políticas de RLS em `drizzle/politicas.sql`
leem esses valores.

Três detalhes que sustentam isso e não devem ser mexidos sem entender:

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

Use a *External Database URL* do Postgres do Render em `DATABASE_URL`.
As tabelas ficam no schema `ie`, separadas das do Glyvo — nada em `public`
é tocado.

### 4. Variáveis e migração

```bash
cp .env.example .env.local     # preencha os valores
pnpm install
pnpm db:migrate                # cria o schema e aplica as políticas de RLS
pnpm db:seed                   # tipos de evento e categorias financeiras iniciais
pnpm admin:criar seu@email.com "Seu Nome"
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
| `pnpm admin:criar` | Cria o primeiro administrador |

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
