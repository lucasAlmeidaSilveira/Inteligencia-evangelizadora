# Identidade visual

A identidade **não é preferência estética**: ela traduz o carisma da
Comunidade Católica Shalom. Antes de mudar qualquer cor, entenda o que ela
significa aqui.

Este arquivo é a referência de quem escreve código. Para quem vai *aplicar* a
marca fora do sistema — apresentação, impresso, rede social — há um manual
visual com as pranchas de construção, redução, respiro e o que não fazer:
<https://claude.ai/code/artifact/591ae794-b7e7-4022-bf87-3e87ae455177>

## A origem

O Shalom é reconciliação com Deus e com o próximo pelo encontro com Cristo
Ressuscitado, vivida em dois polos: **contemplação e missão**. Azul e laranja
são as cores da Comunidade e carregam exatamente esses dois polos.

| | Significa | Token |
|---|---|---|
| **Azul** | A profundidade — oração, escuta, o que se acumula. A instituição. | `--marca-azul`, `--primary` |
| **Laranja** | O fogo — o impulso que faz sair. Quem é enviado. | `--laranja` |

O contraste entre as duas é o carisma inteiro. Use-o com intenção: o laranja
marca a saída, a ação, o envio — não é uma segunda cor decorativa para
distribuir pela tela.

## O monograma

`src/components/marca.tsx` — três componentes, um desenho.

**A construção.** Toda medida é a anterior dividida por φ (1,618), numa
cascata que fecha sozinha:

| Medida | Valor | Origem |
|---|---|---|
| altura de caixa alta | 22,00 | módulo |
| largura do E | 13,60 | 22 / φ |
| braço do meio | 8,40 | 13,60 / φ |
| espessura da haste | 5,19 | 8,40 / φ |
| contraforma entre braços | 3,21 | 5,19 / φ |
| vão entre o I e o E | 1,98 | 5,19 / φ² |

Três hastes de 5,19 mais duas contraformas de 3,21 somam exatamente 22 — a
caixa fecha sem nenhum ajuste manual. Não é enfeite matemático: é o que faz o E
parecer certo sem que ninguém saiba por quê. **Qualquer alteração precisa
refazer a cascata inteira**, não só a medida que incomodou.

**A leitura das formas.** O E é a estrutura: três braços, os três eixos que o
sistema acompanha — membros, grupos de oração e ações apostólicas. Fechado,
estável, apoiado na base. O I é quem sai: uma vertical só, sem travessa, do
lado de fora da estrutura. É o único elemento laranja.

Cantos com raio 1,2 — o suficiente para o desenho não cortar, longe do
arredondamento total, que transformaria as hastes em cápsulas soltas.

**Os três componentes:**

| Componente | Onde usar |
|---|---|
| `Simbolo` | Sobre fundo próprio. O E segue `currentColor`; o I usa `--marca-acento`, com fallback no laranja. É o que a barra lateral usa, com `--marca-acento` no `--marca-luz`: o azul já vem da barra. |
| `SimboloBloco` | O monograma dentro do azul da marca, para superfície que não garante fundo nenhum. Símbolo a 1/φ do quadrado, canto a 32/φ³. Hoje **sem uso em tela** — desde que a barra virou azul, ela mesma dá o fundo. Fica como a referência da geometria que `icon.svg` repete em hexadecimal. |
| `Marca` | Assinatura completa — símbolo e nome. Login e cabeçalho. |

`src/app/icon.svg` é a mesma geometria em hexadecimal fixo — favicon não
resolve custom property. Se o desenho mudar, os dois mudam juntos.

## Tipografia

| Fonte | Papel | Por quê |
|---|---|---|
| **IBM Plex Sans** (`--font-plex`) | Interface e dados | No lugar do Inter, que é o padrão de todo mundo e por isso não diz nada. Terminais levemente flanqueados, `a` e `g` com personalidade, figuras tabulares de verdade — o que importa numa tela cheia de métricas — e diacríticos bem resolvidos para o português. |
| **Space Grotesk** (`--font-grotesk`, classe `.font-brand`) | Marca e títulos | Bojos de lado reto e terminais cortados na horizontal: a mesma geometria retangular do monograma, o que faz símbolo e nome parecerem desenhados juntos. Contrasta com o Plex por classe — grotesca geométrica contra humanista —, não por detalhe, que é o que faz um par de tipos funcionar em vez de parecer erro. |

**Números de métrica usam figuras tabulares**, sempre. Sem isso o valor muda de
largura ao atualizar, o layout "dança" e o olho perde a referência entre um
número e o seguinte. Já vale automaticamente em `th`, `td[data-numeric]` e
`[data-slot="metric"]`; fora daí, use a classe `.tabular`.

## Cores

Tudo vive em custom properties no topo de `src/app/globals.css`. **Nenhum
valor hexadecimal solto no código** — trocar um tom é editar aquele arquivo,
não caçar valores pelo repositório.

Cores em **OKLCH**: luminosidade perceptualmente uniforme, o que mantém o
contraste previsível ao gerar variações. Todos os valores foram **medidos**,
não escolhidos a olho.

**Tokens próprios do projeto** (além dos do shadcn):

| Token | Uso |
|---|---|
| `--marca-azul`, `--marca-tinta`, `--marca-luz` | A marca. |
| `--laranja` | O laranja vivo do impulso missionário. |
| `--laranja-forte` | Variante para quando há texto branco por cima — 5,9:1. O tom vivo não alcançaria. |
| `--success`, `--warning`, `--info` | Semântica de estado, cada um com seu `-foreground`. |
| `--chart-1..5` | Séries de gráfico. |
| `--vidro-*`, `--ambiente` | O material das superfícies — ver **Vidro**. |
| `--card-solido`, `--popover-solido` | As mesmas superfícies sem alfa, para quando translucidez não é opção. |

**`--card` e `--popover` têm alfa.** São superfícies translúcidas, não cores
chapadas: é daí que sai todo o vidro do sistema. Os componentes do shadcn
continuam escrevendo `bg-card` e `bg-popover` como sempre — quem mudou foi o
valor do token, não o componente.

**Regras que não se quebram:**

- **A marca não troca de cor com o tema.** `--marca-azul` não tem contraparte
  em `.dark` de propósito: uma identidade que muda de cor deixa de ser
  identidade. É o azul do hábito e das publicações da Comunidade.
- **`--accent` não é a cor de marca.** Na semântica do shadcn ele é superfície
  de hover. Para aplicar a marca, use `--primary` ou os tokens de marca.
- **`--destructive` é deslocado do laranja** (matiz 25 contra 48), para
  destruir e evangelizar não se confundirem na tela.
- **No escuro, o azul clareia.** O tom de 42% de luminosidade não alcança
  4,5:1 sobre fundo escuro; a versão `.dark` usa 70%. A paleta escura é
  redefinida token a token — não é inversão da clara.
- **O fundo é levemente azulado, não creme.** A temperatura acompanha a marca.
  Ele desceu de 0,985 para 0,955 de luminosidade quando o vidro entrou: um
  cartão de vidro branco sobre um fundo quase branco não tem como parecer
  vidro. A superfície translúcida só se lê como superfície se for mais clara
  que o campo em que está apoiada.
- **A barra lateral é superfície de marca.** `--sidebar` é o próprio
  `--marca-azul` e, como ele, vale igual nos dois temas — por isso os
  `--sidebar-*` não têm bloco em `.dark`. Os demais tokens da barra são a
  paleta invertida (tinta clara sobre azul), não a paleta clara com outro
  fundo. Como a barra é uma ilha escura numa superfície clara, `@layer base`
  redefine `--background`, `--foreground`, `--border`, `--input`,
  `--muted-foreground`, `--accent`, `--ring`, `--card`, `--card-solido`,
  `--vidro-brilho` e `--vidro-aresta` no escopo `[data-slot="sidebar"]`:
  qualquer componente que entre ali herda as superfícies certas sem precisar de
  classe de exceção. `--popover` fica de fora porque popovers e tooltips abrem
  em portal, fora da barra.

  **`--card` entrou nessa lista por um bug real, não por simetria.** O seletor
  de missão é um `select-trigger`, e o vidro pinta o fundo dele com `--card`.
  Sem a redefinição ele herdava a tinta do tema claro — branco a 70% — e o
  campo virava uma barra clara com o texto claro da barra por cima: ilegível,
  e ilegível em silêncio, sem quebrar teste nem tela. Na barra, `--card` é o
  que uma superfície elevada sobre azul profundo deve ser: um véu de luz, não
  uma placa branca.

**Contrastes medidos**, todos sobre a superfície composta — o alfa do vidro já
resolvido contra o que está atrás, não contra o branco teórico:

| | Claro | Escuro |
|---|---|---|
| Texto principal sobre o cartão | 17,4:1 (AAA) | 12,7:1 (AAA) |
| Texto principal sobre o fundo | 15,9:1 (AAA) | — |
| Texto secundário sobre o cartão | 5,8:1 (AA) | 6,0:1 (AA) |
| Texto secundário sobre o fundo | 5,3:1 (AA) | — |
| Azul da marca sobre o cartão | 8,1:1 (AAA) | — |
| Texto da barra sobre o azul da marca | 8,2:1 (AAA) | igual |

O **pior caso do vidro** é a sobreposição aberta por cima da barra lateral —
único lugar do sistema em que um popover translúcido cai sobre superfície
escura. Medido: 17,0:1 no claro e 13,2:1 no escuro. É por isso que `--popover`
tem muito mais corpo que `--card` (93% e 92% contra 70%): o cartão sabe o que
tem atrás de si, a sobreposição não.

**O alfa da sobreposição é decidido pelo destaque do item, não pelo texto.** O
destaque do item de menu (`--accent`) é cor fixa, e quanto mais translúcida a
superfície, mais ela se aproxima do que passa por baixo. A 85% o popover aberto
sobre a barra lateral chegava ao próprio tom do `--accent` — separação de
1,00:1, com o item sob o cursor e o item sob o foco do teclado invisíveis. Com
os valores atuais a separação é 1,31:1 no escuro (1,21:1 sobre o azul) e 1,14:1
no claro, que é o patamar do shadcn antes do vidro.

**Esse patamar é baixo e é dívida conhecida, não conquista.** O item de menu
traz `outline-hidden`, então o realce de fundo é o único sinal de foco de
teclado — e 1,2:1 não cumpre os 3:1 de estado de componente. É anterior ao
vidro e vale para toda a família de menus; fechar isso pede um segundo
diferenciador no item (contorno ou barra lateral), que é trabalho à parte.

Na barra, o item ativo é a exceção conhecida: o fundo clareado separa 1,7:1 da
superfície, abaixo dos 3:1 exigidos de um componente. O peso de fonte que o
acompanha é o que fecha o requisito — mexer num sem o outro quebra a regra de
que cor nunca é o único diferenciador. Com o vidro ele ganhou um terceiro
sinal, também não-cromático: a cápsula tem aresta iluminada e contorno
visíveis, e não só um fundo mais claro.

## Vidro

As superfícies do sistema são de vidro — translúcidas, com o que está atrás
desfocado e a aresta pegando luz. A referência é o *liquid glass* do iOS, e a
razão de ela caber aqui não é moda: o sistema tem uma casca que acompanha o
usuário em todas as telas (barra lateral, barra de topo) e um conteúdo que
muda embaixo dela. Material translúcido diz qual dos dois é qual sem precisar
de borda, linha divisória ou sombra pesada.

**Vidro não é fundo com transparência.** São quatro coisas ao mesmo tempo, e
tirar qualquer uma faz o resto parecer erro de opacidade:

| | O que faz | Sem isso |
|---|---|---|
| **Desfoque** | Separa o plano de cima do de baixo | Texto de trás aparece por baixo do texto da frente |
| **Saturação a 180%** | Devolve o croma que o desfoque acinzenta | Vidro sujo em vez de límpido |
| **Aresta clara no topo, escura na base** | O reflexo especular — a espessura da placa | Retângulo chapado; é esta pista, não a transparência, que faz parecer vidro |
| **Sombra curta + sombra longa** | Contato e altura | Uma só lê como borda borrada |

Os tokens vivem em `globals.css`: `--vidro-desfoque`, `--vidro-desfoque-barra`,
`--vidro-saturacao`, `--vidro-brilho`, `--vidro-aresta`, `--vidro-sombra-perto`,
`--vidro-sombra-longe`.

**Dois desfoques, porque há duas situações.** Atrás de um cartão só existe o
campo de luz do fundo, que já é um gradiente macio — desfocar gradiente macio
devolve o mesmo gradiente, e ainda assim custa uma passada de composição na GPU
por cartão, num painel que chega a quatorze. Por isso a placa usa 12px. Atrás
da barra de topo e das sobreposições passa conteúdo de verdade, e lá o desfoque
é generoso (28px).

**O campo de luz (`--ambiente`).** Três halos radiais fixos atrás de todo o
conteúdo, aplicados em `body::before`. Existem porque vidro precisa de algo
para refratar: sobre fundo chapado, desfoque não tem o que desfocar. São todos
no azul — o laranja marca a saída, a ação, o envio, e espalhá-lo pelo fundo da
tela o transformaria na cor decorativa que a identidade proíbe.

**Onde o vidro entra:**

| Superfície | Como |
|---|---|
| Cartão | `--card` com alfa, desfoque curto, aresta e sombra |
| Sobreposição (dialog, popover, select, dropdown, sheet) | `--popover`, bem mais encorpado, desfoque longo, sombra funda |
| Menu (select, dropdown) | Raio **concêntrico**: externo = raio do item + respiro. Ver abaixo |
| Barra de topo | Flutuante, desfoque longo — o conteúdo rola por baixo dela |
| Botão `outline` e `secondary` | Cápsula de vidro |
| Campo, `textarea`, `select` | Poço: realce embaixo, sombra em cima — o inverso da placa |
| Controle segmentado (`tabs`) | Trilha de vidro, aba ativa como cápsula |

**Onde o vidro não entra, e por quê:**

- **A barra lateral continua opaca.** Ela é o azul da marca, e os 8,2:1 do
  texto sobre ele são medidos contra o azul cheio. Translúcida, o contraste
  passaria a variar com o que rolasse por baixo — um requisito de
  acessibilidade que mudaria conforme a rolagem. Ela ganha o resto do material
  (aresta, lustro, sombra, cantos, e agora flutua em vez de encostar nas
  bordas), só não a transparência.
- **O botão primário continua preenchido.** Vidro nele tiraria exatamente a
  presença que o faz ser encontrado.
- **Vidro dentro de vidro não existe.** Dois `backdrop-filter` empilhados
  desfocam o desfoque: o resultado é leitoso e custa o dobro. Cartão dentro de
  sobreposição volta a ser superfície opaca.
- **Cartão não acende no hover.** Movimento e destaque comunicam estado, nunca
  decoram — e a maioria dos cartões não faz nada quando clicada. Os que têm
  ação já dizem, pelo `hover:ring-primary/40` e pelos 2px de elevação.

**Quando translucidez não é opção.** Duas quedas, ambas para superfície opaca
— nunca para "vidro mais fraco", que entregaria justamente o problema pela
metade:

1. `prefers-reduced-transparency: reduce` — preferência declarada do sistema.
2. Navegador sem `backdrop-filter` — sem o desfoque, a tinta translúcida deixa
   o texto de trás aparecer por baixo do da frente.

**Onde as regras moram.** Em `globals.css`, num bloco **fora de `@layer`** no
fim do arquivo, penduradas nos `data-slot` que os componentes do shadcn já
expõem. Sem camada porque precisam vencer `utilities`, que é onde moram o
`bg-card` e o `shadow-md` que elas substituem. O preço: uma classe Tailwind de
`box-shadow` ou de fundo passada a um desses componentes **não** vence daquele
bloco — o caminho é o sufixo `!`, ou, de preferência, trocar o valor de
`--vidro-*` no escopo do componente, que mantém o vocabulário do material.

**Raio concêntrico.** Um canto interno vale o canto externo **menos o respiro
entre os dois**. O `SelectContent` do shadcn vem sem respiro nenhum — o item
encosta na borda —, então qualquer raio externo maior que o do item passa a
cortar o canto do item, e aparece um degrau entre as duas curvas. O menu
resolve isso com o respiro que faltava e com o raio externo **derivado** do
raio do item: `calc(var(--radius-md) + 0.25rem)`. Os dois números são uma conta
só — mexer num obriga a refazer o outro.

Por isso o menu não usa `--radius-xl` como as demais sobreposições: **o raio
acompanha o tamanho da superfície**, e uma lista de três linhas com o canto de
um diálogo lê como cápsula, não como menu.

Dois detalhes que parecem enfeite e são requisito:

- O `box-shadow` do vidro lê `--tw-ring-color`, que é o que o `ring-*` do
  Tailwind escreve. É por isso que o `hover:ring-primary/40` dos cartões
  clicáveis continua acendendo: **a aresta do vidro é aquele anel.**
- Botão, campo e aba ganham uma camada `0 0 0 3px var(--tw-ring-color,
  transparent)` pelo mesmo motivo: sem ela, redefinir `box-shadow` apagaria em
  silêncio o anel de `focus-visible` e o de `aria-invalid`.

## Gráficos

A paleta das séries foi **validada por script**, não escolhida a olho: faixa de
luminosidade, piso de croma, separação para daltonismo (pior par ΔE 10,9) e
contraste contra a superfície. As duas paletas — clara e escura — foram
validadas em separado.

- **A ordem das séries é fixa e nunca reciclada.** Azul e laranja da marca
  abrem a sequência.
- **Cor nunca é o único diferenciador**: as linhas têm padrões de traço
  distintos e séries têm legenda ou rótulo direto.
- **Todo gráfico deve oferecer "Ver como tabela"** — quem não distingue as
  cores precisa de outro caminho para o mesmo dado. Hoje só
  `grafico-evolucao.tsx` tem; `grafico-comparativo.tsx` ainda não, e é dívida
  a fechar. Gráfico novo já nasce com a alternativa.

## Padrões de interface

Componentes em `src/components/padroes/` — use-os em vez de recriar:

| Componente | Para |
|---|---|
| `CabecalhoPagina` | Título, descrição e ações da página. |
| `CartaoMetrica` | Número em destaque. Já traz `data-slot="metric"`, que liga as figuras tabulares. A prop `cor` troca o ícone pela bolinha do tipo de ação — é como tipo aparece nos filtros, no calendário e nos relatórios, e o hexadecimal vem do banco, que é cadastro do admin, não decisão de design. |
| `EstadoVazio` | Tela vazia útil: diz o que falta e oferece o próximo passo, em vez de deixar o usuário diante de uma área em branco. |
| `Campo`, esqueletos | Formulários e carregamento. |
| `Revelar` | Conteúdo que acabou de chegar entra em vez de piscar. |
| `Presenca`, `ItemPresente` | Entrada e saída de itens de lista. |
| `AreaFiltrada`, `ResultadosFiltrados` | Filtro que escreve na URL, com a região de resultados esmaecendo enquanto o servidor responde. |
| `IndicadorAba` | Faixa da aba ativa, que desliza de uma aba para a outra. |

Para superfície escrita à mão — a que não é componente do shadcn e por isso não
tem `data-slot` onde pendurar a regra — há as classes `.vidro` e `.vidro-barra`
(a mesma coisa com desfoque longo). Hoje as usam a barra de topo e o painel do
login. Elas trazem a aresta especular em gradiente, que os cartões não têm por
exigir pseudo-elemento posicionado.

`src/components/ui/` é shadcn sobre Radix, com ícones lucide-react. Não
reescreva aqueles arquivos à mão além do que o gerador produz.

## Movimento

Movimento aqui comunica estado — nunca decora. Quem usa o sistema é
coordenador de missão, muitas vezes entrando uma vez por mês: cada animação
precisa responder a uma pergunta que a pessoa está fazendo ("o sistema ouviu?",
"o que mudou?", "para onde eu fui?").

| Token | Valor | Onde |
|---|---|---|
| Sobreposição | 100ms, fade + zoom 95% | Dialog, Popover, Select, Tooltip — vem do `tw-animate-css` |
| Micro-retorno | 150ms `ease-out` | Hover, foco, esmaecer enquanto pendente |
| Chegada de conteúdo | 220ms `ease-out` | Entrada pós-`Suspense`, troca de rota, barra de progresso |
| Estrutura | 200ms `ease-linear` | Barra lateral |
| Saída | 160ms `ease-in` | Item excluído — sair é mais rápido que chegar, para o que já foi não disputar atenção |
| Cascata | 35ms por item, **teto de oito** | Métricas do painel, listas (classe `cascata`) |
| Pressão | `active:translate-y-px` | Botões e cartões clicáveis |

Os valores em segundos vivem em `src/lib/movimento.ts`; os equivalentes em CSS,
em `globals.css`. Os dois precisam contar a mesma história.

**Regras duras**

- **Só `opacity` e `transform`.** Nunca `height`, `width` ou `margin` em
  conteúdo. Os esqueletos foram construídos com a altura real justamente para a
  página não saltar — animar altura desfaz esse trabalho.
- **Deslocamento máximo de 8px**, 4px onde o conteúdo substitui esqueleto.
  Slide de 20px é assinatura de landing page, não de sistema de acompanhamento.
- **Sem bounce.** Overshoot lê como brinquedo, e aqui se presta conta de
  dinheiro de missão.
- **O laranja não se move.** A única exceção é o brilho do login, que o próprio
  código chama de "a única peça decorativa da tela". Em nenhum outro lugar —
  ele marca a saída, a ação, o envio, e não é cor decorativa a distribuir.
- **Número não conta sozinho.** `tabular-nums` fixa a largura do dígito, não a
  quantidade: contar de 0 a 1.284 passa por 1, 3 e 5 caracteres, e é o "layout
  que dança" que a seção de tipografia proíbe. Onde um total muda depois de uma
  ação, ele simplesmente muda — quem manda no número é a soma dos lançamentos.
- **Movimento nunca é o único sinal.** Com movimento reduzido tudo teleporta; o
  estado precisa continuar legível parado. Por isso a aba ativa mantém cor e
  `aria-current`, e a região que esmaece também marca `aria-busy`.

**Onde cada ferramenta entra**

| Camada | Ferramenta | Custo em JS |
|---|---|---|
| Entrada de conteúdo, cascata, login | `tw-animate-css` em Server Component | 0 kB |
| Troca de rota, indicador de aba | `<ViewTransition>` do React | 0 kB |
| Entrada e saída por estado do cliente | Motion (`m` + `LazyMotion`) | ~6 kB + chunk separado |

A entrada de conteúdo **não** usa Motion de propósito: um `m.div` com
`initial={{ opacity: 0 }}` escreve `style="opacity:0"` no HTML do servidor, e se
o JavaScript não chegar o conteúdo fica invisível para sempre. O `animate-in` põe
o estado inicial no keyframe, não no elemento. Motion nunca decide visibilidade
de conteúdo primário.

Nada de animação de layout (`layout`/`layoutId`): exigiria o conjunto `domMax` da
Motion, que somado ao `m` custa mais que importar a biblioteca inteira — e é a
categoria de movimento mais desconfortável para quem tem sensibilidade
vestibular. Onde faria falta, `<ViewTransition>` resolve de graça.

## Acessibilidade

Requisitos, não preferências — os três estão em `globals.css` e **nunca devem
ser removidos**:

- **Foco sempre visível e sempre na cor de marca** (`:focus-visible` com
  contorno de 2px e deslocamento).
- **`prefers-reduced-motion`** zera animações e transições.
- **`prefers-reduced-transparency`** desliga o vidro inteiro e devolve
  superfície opaca — ver **Vidro**.
- **Cor nunca sozinha**: todo estado sinalizado por cor tem também texto,
  ícone ou padrão.

## Escrita da interface

Português do Brasil, tom direto e humano. O usuário é coordenador de missão,
não operador de sistema:

- Rótulo diz o que a coisa é no domínio: "Ações apostólicas", não "Eventos".
- Erro diz o que fazer: "Esta missão já tem um responsável. Troque o papel do
  atual antes de indicar outro." — não o nome da constraint.
- Datas e valores em formato brasileiro, sempre por `src/lib/format.ts`
  (`formatarMoeda`, `formatarData`, `formatarPeriodo`). Fuso
  `America/Sao_Paulo`.
- Variação percentual sem base de comparação devolve `null`, não `0%` nem
  `+∞%` — mostrar qualquer um dos dois seria mentir sobre o dado.
