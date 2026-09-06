# Regras de negócio

O que o sistema garante sobre o domínio. Onde uma regra é imposta pelo banco,
está dito — essas não dependem de ninguém lembrar delas.

## O domínio em uma frase

Uma **missão** da Comunidade Católica Shalom acompanha três eixos: quantos
**membros** tem, quais **grupos de oração** mantém e quais **ações
apostólicas** realiza. As ações têm prestação de contas, documentos e links; os
indicadores da missão podem ser fotografados mês a mês para gerar tendência.

A missão não é um bloco só: ela se organiza em **centros de evangelização** e
**irradiações**, frentes que funcionam como missões pequenas e sob as quais os
grupos e as ações podem ser registrados.

Vocabulário que a interface usa e o código deve seguir:

| Termo | Significa | Tabela |
|---|---|---|
| Missão | Unidade local da Comunidade | `missoes` |
| Centro de evangelização | Frente da missão, com grupos e ações próprios | `centros_evangelizacao` |
| Irradiação | Frente menor, nascida de um centro — o outro valor de `tipo` | `centros_evangelizacao` |
| Ação apostólica | O que a interface chama de evento | `eventos` |
| Grupo de oração | Célula de oração da missão | `grupos_oracao` |
| Pastor | Quem responde por um grupo de oração | `grupo_responsaveis` |
| Responsável | Quem responde pela missão inteira | `usuarios.papel` |
| Competência | Mês de referência de um indicador | `missao_indicadores` |

"Pastor" e "responsável" são coisas diferentes e não devem ser trocados. A
tabela física `grupo_responsaveis` guarda pastores: o nome ficou de quando o
domínio dizia "responsável", e renomeá-la seria migração destrutiva sem ganho.

"Centro de evangelização" nomeia ao mesmo tempo a entidade e um dos dois tipos
dela — é assim que as missões falam, e a interface segue. O selo do tipo aparece
sempre, nos dois valores: sem ele, "não tem selo" precisaria significar alguma
coisa, e ninguém adivinha o quê.

## Papéis e permissões

Três níveis, do mais amplo ao mais restrito:

| | Admin master | Responsável | Auxiliar |
|---|---|---|---|
| Criar e excluir missão | ✓ | | |
| Tipos de ação e categorias financeiras | ✓ | | |
| Editar cadastro da missão | ✓ | ✓ (a sua) | |
| Convidar pessoas | ✓ (qualquer papel) | ✓ (auxiliares da sua missão) | |
| Editar e excluir pessoas | ✓ (qualquer uma, menos ele mesmo) | ✓ (auxiliares da sua missão) | |
| Centros, grupos, ações, financeiro, documentos, indicadores | ✓ | ✓ | ✓ |
| Painel, calendário e relatórios | todas as missões (ou uma, em foco) | a sua | a sua |
| Trocar a própria senha | ✓ | ✓ | ✓ |

Regras estruturais por trás disso, todas impostas pelo banco:

- **Cada pessoa pertence a exatamente uma missão — menos o admin, que não
  pertence a nenhuma.** É por não pertencer a nenhuma que ele enxerga todas.
  `CHECK papel_e_missao_coerentes` garante os dois lados.
- **Cada missão tem no máximo um responsável.** Índice único parcial
  `uq_responsavel_por_missao`. Dois responsáveis significaria duas pessoas
  convidando gente sem que nenhuma respondesse pela outra.
- **Papel não tem valor padrão.** Permissão é decisão explícita de quem
  convida, nunca algo herdado por omissão.

O auxiliar **registra** os dados da missão; ele não altera o cadastro dela nem
convida ninguém. É a única diferença entre ele e o responsável. Abrir uma
irradiação é registro, não cadastro da missão — por isso o auxiliar também faz.

## Centros de evangelização

Cada missão tem zero ou mais **centros de evangelização**, e cada centro tem um
tipo: centro de evangelização ou **irradiação** — a frente menor, que nasceu de
um centro e ainda não se sustenta sozinha. A contagem de centros ativos aparece
no cartão da missão, na visão geral dela e no painel: é o número que diz quantas
frentes a missão sustenta.

- **O vínculo de grupos e ações com o centro é opcional.** Um grupo pode pender
  do centro ou diretamente da missão. Antes desta divisão tudo pendia da missão,
  e continuar aceitando esse estado evitou inventar um centro "Sede" para dado
  antigo que ninguém decidiu criar. É também o estado real de quem ainda não
  organizou as frentes.
- **Um grupo ou ação nunca aponta para o centro de outra missão.** A chave
  estrangeira é o par `(centro_id, missao_id)`, não só o centro — imposto pelo
  banco. Com um FK simples, um grupo da Zona Leste poderia apontar para um
  centro da Zona Sul: dado de outra missão entrando por uma porta que o RLS não
  vigia, sem erro nenhum.
- **Dois centros de mesmo nome na mesma missão são recusados**, sem diferenciar
  maiúsculas (`uq_centro_nome_por_missao`, sobre `lower(nome)`). Homônimos
  tornariam o select de grupos e ações uma adivinhação.
- **Excluir um centro não apaga nada do que pertencia a ele.** Os grupos e as
  ações são desvinculados e voltam a pender diretamente da missão; o diálogo de
  confirmação diz quantos são, antes de confirmar. Para só tirar o centro das
  contagens, o caminho é marcá-lo como inativo.
- **Centro inativo não recebe vínculo novo**, mas quem já aponta para ele
  continua apontando — e o formulário de edição mostra o centro atual mesmo
  arquivado, para que salvar não o desvincule sem ninguém pedir.
- **A lista de grupos de oração filtra por centro**, pela query string, como os
  demais filtros. São três recortes, não dois: todos, um centro, e **os que
  pendem diretamente da missão** — este último é onde se acha o que ainda não
  foi organizado em frentes. Os totais do cabeçalho acompanham o recorte, e é
  isso que responde "quantas pessoas os grupos deste centro reúnem". O filtro
  lista também os centros arquivados: o nome deles aparece no cartão dos
  grupos, e não poder filtrar por um nome visível seria um beco.

### Missão em foco

Enxergar todas as missões de uma vez é útil para o panorama e atrapalha quando
a pergunta é sobre uma só. O admin master escolhe uma **missão em foco** no
seletor da barra lateral, e painel, calendário, ações apostólicas e relatórios
— inclusive o CSV exportado — passam a mostrar só ela até que ele volte a
"Todas as missões". A única exceção é o ranking "Missões por membros", que
segue mostrando todas com a escolhida em destaque: filtrá-lo apagaria
justamente a comparação que ele existe para fazer.

Três limites definem o que o foco é:

- **É recorte de leitura, não de permissão.** Ele estreita consultas; nunca
  amplia acesso, e não altera o que se pode escrever. Um admin com foco ativo
  continua criando missão, convidando pessoa e editando qualquer registro.
- **É só do admin.** Responsável e auxiliar já enxergam uma missão só, imposto
  pelo RLS. Para eles o seletor não existe.
- **Não vale para gestão.** Missões, equipe e configurações ignoram o foco:
  são o catálogo e a administração do sistema, não acompanhamento. Filtrar a
  lista de missões esconderia a tela de onde se troca de missão.

O foco vive num cookie, não na URL — os filtros de período, tipo e situação
continuam na query string, e continuam compartilháveis. A escolha do recorte
é do coordenador que está trabalhando, não do link que ele manda para alguém.

## Ciclo de vida do acesso

1. O admin master cria a missão. O cadastro da missão é **só isso** — nenhuma
   conta nasce daí.
2. Em **Equipe**, o admin convida o responsável e o vincula à missão. É a
   **única porta** para gravar papel e vínculo: uma segunda seria uma segunda
   sem `normalizar()`, sem a trava de própria conta e sem a checagem de quem já
   está na equipe. Até isso acontecer a missão fica sem responsável, e a tela
   dela avisa disso com um caminho direto para Equipe — a pendência fica
   visível em vez de esquecida.
3. O convite devolve um **link para a pessoa definir a própria senha**. Não se
   gera senha provisória: assim a senha nunca passa por terceiros. O link é
   reemitível na própria tela de Equipe, para quem perdeu o dele.
4. Dali em diante o responsável convida os auxiliares da própria missão,
   sozinho.

Detalhes que sustentam esse fluxo:

- **A conta pode já existir no Firebase sem estar liberada aqui.** Nesse caso
  o convite apenas vincula, não cria de novo. Isso vale para a conta do
  Firebase; quem **já tem linha em `usuarios`** não é convidado de novo — veja
  o item seguinte.
- **Convidar quem já está na equipe é recusado**, e a interface manda editar o
  acesso da pessoa. Sem isso o convite recairia no `on conflict` e sobrescreveria
  papel e missão em silêncio: um responsável de outra missão a deixaria órfã, e
  um admin seria rebaixado sem nada avisar.
- **Papel e missão vindos do formulário só valem para o admin master.** Para o
  responsável, os dois são impostos no servidor: auxiliar, na missão dele.
- **Ninguém altera o próprio papel, remove o próprio acesso nem se exclui.**
  Trancar-se para fora seria irreversível pela interface — sem admin ativo,
  ninguém devolve acesso a ninguém. Vale também para o convite: convidar o
  próprio e-mail é a mesma escrita por outro caminho, e é recusada igual.
- **`pnpm admin:criar` existe só para o primeiro acesso**, o problema do ovo e
  da galinha. Não há cadastro público em lugar nenhum.
- **Desativar alguém (`ativo = false`) surte efeito na requisição seguinte**,
  porque `ativo` é lido do banco a cada carregamento de sessão.
- **Excluir apaga a linha em `usuarios` e a conta no Firebase, e é
  definitivo.** O que a pessoa registrou permanece — as colunas de autoria são
  `on delete set null` —, só perde o nome de quem registrou. Por isso a
  interface oferece desativar como alternativa: excluir é para quem foi
  cadastrado por engano; desativar, para quem saiu da missão e cujo trabalho
  deve continuar identificado.
- **Missão arquivada tranca quem depende dela.** Sem isso, desativar uma
  missão deixaria seus responsáveis navegando num sistema vazio sem entender
  por quê.

## Missões

- `slug` é único e gerado do nome; colisão vira `nome-2`, `nome-3`.
- `membrosTotal` é o **valor corrente**. O histórico vive nos indicadores e é
  opcional — o sistema funciona sem ele, apenas sem linha de tendência.
- Excluir uma missão com gente vinculada é **bloqueado** (`restrict`): apagar
  em cascata removeria acessos em silêncio. O admin resolve o destino dessas
  pessoas antes.
- Grupos, eventos e indicadores, esses sim, caem em cascata com a missão.

## Indicadores mensais

- Uma linha por missão e **competência**, que é sempre o dia 1 do mês —
  garantido por `CHECK competencia_no_dia_um`.
- Registro é opcional. Nunca negativo.
- Guarda membros, grupos e pessoas em grupos naquele mês: é o que alimenta os
  gráficos de evolução e comparação.

## Grupos de oração

- Pertencem a uma missão; caem em cascata com ela.
- **De 1 a 3 pastores por grupo.** O limite não precisa de trigger: `ordem`
  restrita a 1..3 mais unicidade por grupo torna o quarto pastor impossível de
  inserir — sem a condição de corrida que existe ao validar contando linhas.
- Ao salvar, a lista de pastores é **substituída por completo**. Apagar e
  reinserir mantém `ordem` contígua (1, 2, 3), que é o que a restrição espera.
- `diaSemana`: 0 = domingo … 6 = sábado. Opcional, como horário e local.
- Quantidade de pessoas nunca é negativa.

## Ações apostólicas

- Toda ação pertence a uma missão e a um **tipo de ação**, e o tipo é definido
  pelo admin master — vale para todas as missões.
- `dataFim >= dataInicio`, imposto por `CHECK` **e** revalidado no zod, para a
  mensagem aparecer no campo certo.
- Status: `planejado` → `em_andamento` → `realizado`, ou `cancelado`. Sem
  transição automática: quem move é o usuário.
- Participantes e servos engajados nunca são negativos.
- Excluir um tipo de ação em uso é **bloqueado** — apagaria o histórico junto.
- O calendário mensal é a consulta mais frequente do sistema; há índice
  dedicado sobre o período (`idx_eventos_periodo`).

## Financeiro

Prestação de contas de cada ação, linha a linha.

- Lançamento é **receita** ou **despesa**, com valor sempre **maior que zero**
  (`CHECK valor_positivo`). Despesa não é valor negativo: é tipo.
- **Não existe coluna de saldo.** Saldo é soma de receitas menos despesas,
  calculado na leitura. Coluna de saldo é estado que diverge dos lançamentos.
- **As contas se fazem em centavos inteiros.** `0.1 + 0.2` dá
  `0.30000000000000004` em ponto flutuante — num saldo de prestação de contas
  isso vira centavo faltando que ninguém consegue explicar. Ver
  `src/features/eventos/financeiro.ts`.
- O Postgres devolve `numeric` como **string**, de propósito. Nunca converta
  para `float` no caminho do dado.
- O formulário aceita `1.234,56` e `1234.56`; o valor é normalizado com dois
  decimais antes de ir ao banco.
- Categorias são configuráveis pelo admin e valem para todas as missões. Cada
  uma serve a receita, a despesa ou a ambos. Apagar uma categoria **não** apaga
  lançamentos: eles ficam sem categoria (`set null`).

## Documentos

- Ficam no Cloudflare R2, em **bucket privado**. O navegador envia direto para
  o R2 por URL assinada — os bytes não passam pelo servidor Next. Quem
  autoriza é a Server Action que gera a URL, e ela só a devolve depois de
  confirmar acesso à missão.
- Limite de **10 MB**. Tipos aceitos: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG,
  JPG, WEBP.
- Chave: `{missaoId}/{eventoId}/{uuid}-{arquivo}`. O prefixo não é organização
  estética — é o que permite auditar e apagar tudo de uma missão de uma vez.
- O nome do arquivo é normalizado (sem acento, sem espaço, até 120
  caracteres); o UUID evita colisão entre homônimos.

## Links

- Endereço `http` ou `https`, imposto por `CHECK url_http`.
- Quem digita `site.com.br` quer `https` — o schema normaliza antes de validar.

## Relatórios e exportação

- Cada papel vê o escopo que já enxerga no resto do sistema: o admin
  consolida todas as missões; os demais, a sua.
- Exportação em CSV pela rota `/relatorios/exportar`.

## Mensagens de erro

Violação de restrição do banco é traduzida em frase que o usuário entende
(`traduzirErroDeBanco`, em `src/server/dados.ts`). Ao criar uma restrição
nova, acrescente a tradução dela ali — senão a tela mostra
`duplicate key value violates unique constraint uq_...`.
