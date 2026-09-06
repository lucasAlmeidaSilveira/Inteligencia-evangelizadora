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
- **A barra lateral é superfície de marca.** `--sidebar` é o próprio
  `--marca-azul` e, como ele, vale igual nos dois temas — por isso os
  `--sidebar-*` não têm bloco em `.dark`. Os demais tokens da barra são a
  paleta invertida (tinta clara sobre azul), não a paleta clara com outro
  fundo. Como a barra é uma ilha escura numa superfície clara, `@layer base`
  redefine `--background`, `--foreground`, `--border`, `--input`,
  `--muted-foreground`, `--accent` e `--ring` no escopo
  `[data-slot="sidebar"]`: qualquer componente que entre ali herda as
  superfícies certas sem precisar de classe de exceção. `--popover` fica de
  fora porque popovers e tooltips abrem em portal, fora da barra.

**Contrastes medidos:** texto principal 17,3:1 (AAA), azul sobre branco 8,4:1
(AAA), texto da barra sobre o azul da marca 7,5:1 (AAA), texto secundário
5,8:1 (AA).

Na barra, o item ativo é a exceção conhecida: o fundo clareado separa 1,7:1 da
superfície, abaixo dos 3:1 exigidos de um componente. O peso de fonte que o
acompanha é o que fecha o requisito — mexer num sem o outro quebra a regra de
que cor nunca é o único diferenciador.

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
| `CartaoMetrica` | Número em destaque. Já traz `data-slot="metric"`, que liga as figuras tabulares. |
| `EstadoVazio` | Tela vazia útil: diz o que falta e oferece o próximo passo, em vez de deixar o usuário diante de uma área em branco. |
| `Campo`, esqueletos | Formulários e carregamento. |
| `Revelar` | Conteúdo que acabou de chegar entra em vez de piscar. |
| `Presenca`, `ItemPresente` | Entrada e saída de itens de lista. |
| `AreaFiltrada`, `ResultadosFiltrados` | Filtro que escreve na URL, com a região de resultados esmaecendo enquanto o servidor responde. |
| `IndicadorAba` | Faixa da aba ativa, que desliza de uma aba para a outra. |

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
