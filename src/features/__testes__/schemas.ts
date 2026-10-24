import { config } from "dotenv";

config({ path: ".env.local" });

import type { z } from "zod";

import { centroSchema, lerFiltroDeCentro } from "@/features/centros/schemas";
import {
  eventoSchema,
  informacoesSchema,
  orcamentoSchema,
  participacaoSchema,
  textosSchema,
} from "@/features/eventos/schemas";
import { contagemSchema, grupoSchema } from "@/features/grupos/schemas";
import {
  enderecoDosComentarios,
  lerFiltrosDeComentarios,
  respostaSchema,
} from "@/features/pesquisas/schemas";
import { erroDeBanco, resumoDoErro } from "@/lib/erro-de-banco";
import { relatorioParaCsv } from "@/features/relatorios/csv";
import { competenciaSchema, missaoSchema } from "@/features/missoes/schemas";
import { fimDoDia, inicioDoDia } from "@/lib/fuso";

/**
 * Os schemas rodam duas vezes: no cliente, antes de enviar, e no servidor,
 * dentro da Server Action. A segunda passagem recebe o resultado da primeira
 * — já com `null` no lugar de "" — então o schema precisa ser idempotente.
 *
 * Não sendo, cada campo opcional deixado em branco volta como
 * "Invalid input: expected string, received null" na hora de salvar.
 *
 *   pnpm testar:schemas
 */
let falhas = 0;

function ok(descricao: string, condicao: boolean, detalhe?: string) {
  console.log(`${condicao ? "  ✓" : "  ✗"} ${descricao}`);
  if (!condicao) {
    if (detalhe) console.log(`      ${detalhe}`);
    falhas++;
  }
}

function verificar(
  nome: string,
  schema: z.ZodType,
  entrada: unknown,
  descricaoEntrada: string,
) {
  console.log(`\n${nome}`);

  const primeira = schema.safeParse(entrada);
  ok(
    `${descricaoEntrada} é aceito`,
    primeira.success,
    primeira.success
      ? undefined
      : primeira.error.issues
          .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
          .join(" | "),
  );
  if (!primeira.success) return;

  // O ponto do teste: revalidar a saída, como faz a Server Action.
  const segunda = schema.safeParse(primeira.data);
  ok(
    "revalidar a saída também é aceito (schema idempotente)",
    segunda.success,
    segunda.success
      ? undefined
      : segunda.error.issues
          .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
          .join(" | "),
  );
  if (!segunda.success) return;

  ok(
    "a segunda passagem devolve exatamente o mesmo resultado",
    JSON.stringify(primeira.data) === JSON.stringify(segunda.data),
    `1ª: ${JSON.stringify(primeira.data)}\n      2ª: ${JSON.stringify(segunda.data)}`,
  );
}

/** O contrário de `verificar`: entrada que precisa ser recusada, e no campo
 *  certo — mensagem no campo errado não chega em quem precisa corrigi-la. */
function recusar(
  nome: string,
  schema: z.ZodType,
  entrada: unknown,
  campoEsperado: string,
) {
  console.log(`\n${nome}`);

  const resultado = schema.safeParse(entrada);
  ok("a entrada é recusada", !resultado.success);
  if (resultado.success) return;

  const campos = resultado.error.issues.map((i) => i.path.join("."));
  ok(
    `o erro aponta para "${campoEsperado}"`,
    campos.includes(campoEsperado),
    `apontou para: ${campos.join(", ") || "(raiz)"}`,
  );
}

verificar(
  "Missão — apenas o nome preenchido",
  missaoSchema,
  {
    nome: "Missão Teste",
    cidade: "São Paulo",
    regiao: "",
    endereco: "",
    dataFundacao: "",
    contatoTelefone: "",
    membrosTotal: "",
    observacoes: "",
    ativo: true,
  },
  "formulário com todos os opcionais em branco",
);

verificar(
  "Missão — todos os campos preenchidos",
  missaoSchema,
  {
    nome: "Missão Completa",
    cidade: "Guarulhos",
    regiao: "Zona Leste",
    endereco: "Rua das Flores, 100",
    dataFundacao: "2015-03-12",
    contatoTelefone: "(11) 90000-0000",
    membrosTotal: "240",
    observacoes: "Missão com forte atuação social.",
    ativo: true,
  },
  "formulário completo",
);

recusar(
  "Missão — fundação no futuro",
  missaoSchema,
  {
    nome: "Missão Adiantada",
    cidade: "São Paulo",
    // Um ano à frente: a data existe e é válida, o que a torna a única forma
    // de exercitar o refine em vez do Date.parse.
    dataFundacao: `${new Date().getFullYear() + 1}-01-15`,
    membrosTotal: "",
    ativo: true,
  },
  "dataFundacao",
);

/* ─── Ação apostólica ─────────────────────────────────────────────────────── */

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

const acaoBase = {
  missaoId: UUID_A,
  centroId: UUID_B,
  tipoEventoId: UUID_C,
  titulo: "Seminário de Vida no Espírito Santo",
  descricao: "",
  observacoes: "",
  dataInicio: "2026-09-12T09:00",
  dataFim: "2026-09-14T17:00",
  localCentroId: "",
  local: "",
  endereco: "",
  responsavelNome: "",
  participantesInscritos: "",
  participantesTotal: "",
  participantesNovos: "",
  participantesPermaneceram: "",
  servosEngajados: "",
  nps: "",
  orcamentoPrevisto: "",
  status: "planejado",
  destaqueRegional: false,
};

verificar(
  "Ação apostólica — apenas os obrigatórios",
  eventoSchema,
  acaoBase,
  "formulário com todos os opcionais em branco",
);

/*
 * O orçamento é a razão de este caso existir. O schema roda no cliente e de
 * novo no servidor, sobre a própria saída: um parser que apaga todo ponto lê
 * o "1234.56" que ele mesmo gerou como 123456 e centuplica o valor a cada
 * salvamento — sem erro, sem teste vermelho, só o número errado no banco.
 */
verificar(
  "Ação apostólica — completa, com orçamento no formato brasileiro",
  eventoSchema,
  {
    ...acaoBase,
    descricao: "Três dias de pregação e oração.",
    observacoes: "Confirmar equipe de música.",
    local: "Centro Bonsucesso",
    endereco: "Av. Central, 1200",
    responsavelNome: "João Silva",
    participantesInscritos: "168",
    participantesTotal: "142",
    participantesNovos: "58",
    participantesPermaneceram: "37",
    servosEngajados: "24",
    // Com vírgula, como se digita: a saída canônica "8.7" precisa reler igual.
    nps: "8,7",
    orcamentoPrevisto: "12.400,50",
    status: "realizado",
    destaqueRegional: true,
  },
  "formulário completo",
);

/* O NPS tem a mesma armadilha do orçamento — roda duas vezes — e mais uma: a
   nota 0 é legítima e diferente de vazio. Um schema que tratasse 0 como
   "falsy → null" apagaria a pior avaliação possível sem erro nenhum. */
verificar(
  "Ação apostólica — NPS zero é nota, não ausência",
  eventoSchema,
  { ...acaoBase, nps: "0" },
  "nota mínima",
);

verificar(
  "Ação apostólica — NPS no formato canônico",
  eventoSchema,
  { ...acaoBase, nps: "10.0" },
  "nota máxima, como volta do banco",
);

recusar(
  "Ação apostólica — NPS acima de 10",
  eventoSchema,
  { ...acaoBase, nps: "11" },
  "nps",
);

recusar(
  "Ação apostólica — NPS negativo",
  eventoSchema,
  { ...acaoBase, nps: "-1" },
  "nps",
);

recusar(
  "Ação apostólica — NPS que não é número",
  eventoSchema,
  { ...acaoBase, nps: "ótimo" },
  "nps",
);

verificar(
  "Ação apostólica — orçamento já no formato canônico",
  eventoSchema,
  { ...acaoBase, orcamentoPrevisto: "8900.00" },
  "valor com ponto decimal, como volta do banco",
);

/*
 * O local é um centro da missão ou texto livre, nunca os dois. O formulário
 * guarda o texto de "Outro local" enquanto a pessoa alterna entre as opções;
 * se ele chegasse ao banco junto com o centro, o CHECK `local_centro_ou_texto`
 * recusaria o salvamento inteiro com uma frase que ninguém entenderia.
 */
const comCentroComoLocal = {
  ...acaoBase,
  localCentroId: UUID_B,
  local: "Paróquia São José",
  endereco: "Rua das Flores, 100",
};

verificar(
  "Ação apostólica — local num centro da missão",
  eventoSchema,
  comCentroComoLocal,
  "centro escolhido, com texto esquecido de \"Outro local\"",
);

{
  const saida = eventoSchema.safeParse(comCentroComoLocal);
  ok(
    "com centro como local, o texto livre sai vazio",
    saida.success &&
      saida.data.localCentroId === UUID_B &&
      saida.data.local === null &&
      saida.data.endereco === null,
    saida.success ? JSON.stringify(saida.data) : undefined,
  );
}

{
  const saida = eventoSchema.safeParse({
    ...acaoBase,
    local: "Paróquia São José",
    endereco: "Rua das Flores, 100",
  });
  ok(
    "sem centro, o texto livre é o local, como sempre foi",
    saida.success &&
      saida.data.localCentroId === null &&
      saida.data.local === "Paróquia São José" &&
      saida.data.endereco === "Rua das Flores, 100",
    saida.success ? JSON.stringify(saida.data) : undefined,
  );
}

recusar(
  "Ação apostólica — local que não é id de centro",
  eventoSchema,
  { ...acaoBase, localCentroId: "salão paroquial" },
  "localCentroId",
);

/* A regra de período mora por dentro da limpeza do local, e não por fora: no
   zod, o `refine` de um schema transformado não roda quando outro campo já
   falhou. Os dois erros precisam aparecer no mesmo envio. */
console.log("\nAção apostólica — dois erros no mesmo envio");
{
  const saida = eventoSchema.safeParse({
    ...acaoBase,
    titulo: "x",
    dataFim: "2026-09-11T09:00",
  });
  const campos = saida.success
    ? []
    : saida.error.issues.map((i) => i.path.join("."));
  ok(
    "título curto e término antes do início são apontados juntos",
    campos.includes("titulo") && campos.includes("dataFim"),
    `apontou para: ${campos.join(", ") || "(nada)"}`,
  );
}

/*
 * Os schemas de seção são o caminho da edição direto na visão geral: um card
 * grava só os seus campos. Rodam duas vezes como o completo, e as regras
 * cruzadas precisam continuar valendo aqui — um card que aceitasse o que o
 * formulário inteiro recusa seria uma porta lateral para dado inconsistente.
 */
verificar(
  "Seção Informações",
  informacoesSchema,
  {
    centroId: UUID_B,
    tipoEventoId: UUID_C,
    dataInicio: "2026-09-12T09:00",
    dataFim: "2026-09-14T17:00",
    localCentroId: "",
    local: "",
    endereco: "",
    responsavelNome: "",
    status: "em_andamento",
  },
  "card de informações com os opcionais em branco",
);

// O card edita o local também: a mesma regra de "um ou outro" vale aqui.
{
  const saida = informacoesSchema.safeParse({
    centroId: UUID_B,
    tipoEventoId: UUID_C,
    dataInicio: "2026-09-12T09:00",
    dataFim: "2026-09-14T17:00",
    localCentroId: UUID_A,
    local: "Salão",
    endereco: "Rua A, 1",
    responsavelNome: "",
    status: "planejado",
  });
  ok(
    "Seção Informações — com centro como local, o texto livre sai vazio",
    saida.success && saida.data.local === null && saida.data.endereco === null,
    saida.success ? JSON.stringify(saida.data) : undefined,
  );
}

verificar(
  "Seção Participação",
  participacaoSchema,
  {
    participantesInscritos: "168",
    participantesTotal: "142",
    participantesNovos: "58",
    participantesPermaneceram: "37",
    servosEngajados: "24",
    nps: "9",
  },
  "card de participação preenchido",
);

recusar(
  "Seção Participação — NPS fora da escala",
  participacaoSchema,
  {
    participantesInscritos: "0",
    participantesTotal: "40",
    participantesNovos: "0",
    participantesPermaneceram: "0",
    servosEngajados: "0",
    nps: "10,5",
  },
  "nps",
);

verificar(
  "Seção Orçamento — formato brasileiro",
  orcamentoSchema,
  { orcamentoPrevisto: "12.400,50" },
  "card de orçamento",
);

verificar(
  "Seção Textos — ambos em branco",
  textosSchema,
  { descricao: "", observacoes: "" },
  "card de descrição e observações",
);

recusar(
  "Seção Informações — término antes do início",
  informacoesSchema,
  {
    centroId: UUID_B,
    tipoEventoId: UUID_C,
    dataInicio: "2026-09-14T17:00",
    dataFim: "2026-09-12T09:00",
    status: "planejado",
  },
  "dataFim",
);

recusar(
  "Seção Participação — permaneceram mais do que participaram",
  participacaoSchema,
  {
    participantesInscritos: "0",
    participantesTotal: "40",
    participantesNovos: "0",
    participantesPermaneceram: "50",
    servosEngajados: "0",
  },
  "participantesPermaneceram",
);

recusar(
  "Ação apostólica — mais novos do que presentes",
  eventoSchema,
  { ...acaoBase, participantesTotal: "40", participantesNovos: "80" },
  "participantesNovos",
);

recusar(
  "Ação apostólica — permaneceram mais do que participaram",
  eventoSchema,
  { ...acaoBase, participantesTotal: "40", participantesPermaneceram: "50" },
  "participantesPermaneceram",
);

verificar(
  "Centro de evangelização — apenas nome e tipo",
  centroSchema,
  {
    nome: "Centro Santo Amaro",
    tipo: "centro_evangelizacao",
    cidade: "",
    regiao: "",
    endereco: "",
    dataFundacao: "",
    contatoTelefone: "",
    observacoes: "",
    ativo: true,
  },
  "só os campos obrigatórios",
);

verificar(
  "Centro de evangelização — irradiação completa",
  centroSchema,
  {
    nome: "Irradiação Guaianases",
    tipo: "irradiacao",
    cidade: "São Paulo",
    regiao: "Zona Leste",
    endereco: "Rua das Palmeiras, 45",
    dataFundacao: "2019-08-04",
    contatoTelefone: "(11) 90000-0000",
    observacoes: "Nasceu do Centro Santo Amaro.",
    ativo: true,
  },
  "formulário completo",
);

recusar(
  "Centro de evangelização — tipo inventado",
  centroSchema,
  {
    nome: "Centro Estranho",
    // Nem "centro" nem "irradiação": o enum do banco recusaria de qualquer
    // forma, mas com a mensagem crua do Postgres.
    tipo: "paroquia",
    ativo: true,
  },
  "tipo",
);

verificar(
  "Grupo de oração — mínimo",
  grupoSchema,
  {
    nome: "Grupo Teste",
    centroId: "6f1d3b2e-6a1c-4d3f-9f2a-8c7b5e4d3a21",
    // Zero digitado é contagem válida — em branco não é (ver abaixo).
    membrosEfetivos: "0",
    membrosFlutuantes: "0",
    membrosEvadidos: "0",
    diaSemana: "",
    horario: "",
    local: "",
    observacoes: "",
    ativo: true,
    pastores: [{ nome: "Maria Silva", telefone: "" }],
  },
  "grupo com um pastor e nada mais",
);

verificar(
  "Grupo de oração — com 3 pastores",
  grupoSchema,
  {
    nome: "Grupo Cheio",
    // O uuid do centro precisa atravessar as duas passagens intacto.
    centroId: "6f1d3b2e-6a1c-4d3f-9f2a-8c7b5e4d3a21",
    membrosEfetivos: "18",
    membrosFlutuantes: "4",
    membrosEvadidos: "2",
    diaSemana: "3",
    horario: "19:30",
    local: "Salão paroquial",
    observacoes: "",
    ativo: true,
    pastores: [
      { nome: "Maria Silva", telefone: "(11) 90000-0001" },
      { nome: "João Souza", telefone: "" },
      // Nome de duas letras: precisa passar, e antes não passava.
      { nome: "Zé", telefone: "" },
    ],
  },
  "grupo completo",
);

recusar(
  "Grupo de oração — sem centro",
  grupoSchema,
  {
    nome: "Grupo Órfão",
    // Toda missão tem um centro principal, então o formulário nunca envia
    // vazio. Este é o caminho da requisição forjada.
    centroId: "",
    membrosEfetivos: "10",
    membrosFlutuantes: "0",
    membrosEvadidos: "0",
    ativo: true,
    pastores: [{ nome: "Maria Silva", telefone: "" }],
  },
  "centroId",
);

/* ─── Contagem de membros: os três campos são obrigatórios de verdade ──────
 *
 * O total antigo tratava "" como zero. A contagem não pode: ela substitui a
 * planilha bimestral, e um campo esquecido gravado como zero viraria dado
 * falso sem ninguém perceber. */

recusar(
  "Grupo de oração — membros efetivos em branco",
  grupoSchema,
  {
    nome: "Grupo Incompleto",
    centroId: "6f1d3b2e-6a1c-4d3f-9f2a-8c7b5e4d3a21",
    membrosEfetivos: "",
    membrosFlutuantes: "0",
    membrosEvadidos: "0",
    ativo: true,
    pastores: [{ nome: "Maria Silva", telefone: "" }],
  },
  "membrosEfetivos",
);

recusar(
  "Contagem — evadidos negativo",
  contagemSchema,
  { membrosEfetivos: "12", membrosFlutuantes: "3", membrosEvadidos: "-1" },
  "membrosEvadidos",
);

recusar(
  "Contagem — flutuantes fracionário",
  contagemSchema,
  { membrosEfetivos: "12", membrosFlutuantes: "2.5", membrosEvadidos: "0" },
  "membrosFlutuantes",
);

verificar(
  "Contagem — só os três números, como o lembrete envia",
  contagemSchema,
  { membrosEfetivos: "12", membrosFlutuantes: "3", membrosEvadidos: "1" },
  "três inteiros como texto do formulário",
);

verificar(
  "Competência",
  competenciaSchema,
  {
    missaoId: "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607",
    competencia: "2026-09",
    observacao: "",
  },
  "registro sem observação",
);


/* ─── Resposta da pesquisa pública ────────────────────────────────────────
 *
 * Entrada hostil por definição: vem de quem não tem login. O que se protege
 * aqui é a diferença entre vazio e zero em `nota` (zero é nota, vazio é "não
 * escolheu"), a limpeza do comentário e a recusa de qualquer chave a mais.
 */

verificar(
  "Resposta — nota como string e comentário com caractere de controle",
  respostaSchema,
  { nota: "7", comentario: "  Boa ação.\u0007 ", confirmacao: "" },
  "formulário preenchido",
);

verificar(
  "Resposta — nota zero é nota, não ausência",
  respostaSchema,
  { nota: 0, comentario: "", confirmacao: "" },
  "nota mínima sem comentário",
);

{
  const limpo = respostaSchema.safeParse({
    nota: "9",
    comentario: "Linha 1\r\nLinha 2" + String.fromCodePoint(0x202e) + " invertida",
    confirmacao: "",
  });
  console.log("\nResposta — limpeza do comentário");
  ok("aceita", limpo.success);
  if (limpo.success) {
    ok(
      "normaliza CRLF e remove controle bidi",
      limpo.data.comentario === "Linha 1\nLinha 2 invertida",
    );
  }
}

recusar("Resposta — sem nota", respostaSchema, { nota: "", comentario: "" }, "nota");
recusar("Resposta — nota 11", respostaSchema, { nota: "11" }, "nota");
recusar("Resposta — nota com decimal", respostaSchema, { nota: "7.5" }, "nota");
recusar(
  "Resposta — comentário acima de 500",
  respostaSchema,
  { nota: "8", comentario: "x".repeat(501) },
  "comentario",
);
{
  // Chave a mais só vem de requisição montada à mão. O zod acusa na raiz,
  // não no campo, então o teste confere a recusa e o nome da chave na mensagem.
  const extra = respostaSchema.safeParse({
    nota: "8",
    comentario: "",
    confirmacao: "",
    eventoId: "qualquer",
  });
  console.log("\nResposta — chave inesperada");
  ok("a entrada é recusada", !extra.success);
  ok(
    "a recusa nomeia a chave estranha",
    !extra.success &&
      extra.error.issues.some((i) => i.message.includes("eventoId")),
  );
}

/* ─── Filtros da lista de comentários na URL ──────────────────────────────
 *
 * `?notas=` e `?pagina=` vêm da URL, que qualquer um edita. O que não é valor
 * possível vira o padrão, em vez de erro ou de um número absurdo indo parar
 * num OFFSET.
 */
{
  console.log("\nFiltros da lista de comentários");
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  ok(
    "sem parâmetros: todas as notas, primeira página",
    igual(lerFiltrosDeComentarios({}), { faixa: null, pagina: 1 }),
  );
  ok(
    "faixa e página válidas passam",
    igual(lerFiltrosDeComentarios({ notas: "0-6", pagina: "3" }), {
      faixa: "0-6",
      pagina: 3,
    }),
  );
  ok(
    "faixa inventada vira todas",
    lerFiltrosDeComentarios({ notas: "0-10" }).faixa === null,
  );
  ok("página zero vira 1", lerFiltrosDeComentarios({ pagina: "0" }).pagina === 1);
  ok("página negativa vira 1", lerFiltrosDeComentarios({ pagina: "-4" }).pagina === 1);
  ok("página com decimal vira 1", lerFiltrosDeComentarios({ pagina: "2.5" }).pagina === 1);
  ok("página que não é número vira 1", lerFiltrosDeComentarios({ pagina: "x" }).pagina === 1);
  ok(
    "página absurda vira 1 — não chega a OFFSET",
    lerFiltrosDeComentarios({ pagina: "99999999" }).pagina === 1,
  );
  ok(
    "valor repetido na URL vira o padrão",
    igual(lerFiltrosDeComentarios({ notas: ["0-6", "9-10"], pagina: ["2", "3"] }), {
      faixa: null,
      pagina: 1,
    }),
  );

  const ID = "6f1d3b2e-6a1c-4d3f-9f2a-8c7b5e4d3a21";
  ok(
    "endereço sem recorte não leva parâmetro",
    enderecoDosComentarios(ID, null) === `/eventos/${ID}/pesquisa`,
  );
  ok(
    "primeira página não aparece na URL",
    enderecoDosComentarios(ID, "9-10", 1) === `/eventos/${ID}/pesquisa?notas=9-10`,
  );
  ok(
    "faixa e página juntas",
    enderecoDosComentarios(ID, "7-8", 2) ===
      `/eventos/${ID}/pesquisa?notas=7-8&pagina=2`,
  );
  ok(
    "o endereço montado relê igual",
    igual(
      lerFiltrosDeComentarios(
        Object.fromEntries(
          new URLSearchParams(enderecoDosComentarios(ID, "0-6", 4).split("?")[1]),
        ),
      ),
      { faixa: "0-6", pagina: 4 },
    ),
  );
}

/* ─── Erro do Postgres por baixo do embrulho do Drizzle ───────────────────
 *
 * O Drizzle lança `DrizzleQueryError` com o erro do `pg` em `cause`, e a
 * mensagem do embrulho carrega os parâmetros da consulta. Lido no lugar
 * errado, todo erro vira "tente novamente" e o comentário de um participante
 * vai parar no log.
 */
{
  console.log("\nErro de banco embrulhado pelo Drizzle");
  const doPg = Object.assign(new Error("Pesquisa encerrada."), {
    code: "P0001",
    constraint: "pesquisa_encerrada",
  });
  const embrulho = new Error(
    "Failed query: select ie.responder_pesquisa($1, $2)\nparams: 7,comentário sensível",
    { cause: doPg },
  );
  ok("acha o código no cause", erroDeBanco(embrulho).code === "P0001");
  ok(
    "acha a restrição no cause",
    erroDeBanco(embrulho).constraint === "pesquisa_encerrada",
  );
  ok("erro sem embrulho continua funcionando", erroDeBanco(doPg).code === "P0001");
  ok("erro sem código nem cause devolve vazio", erroDeBanco(new Error("x")).code === undefined);
  ok("nulo não explode", erroDeBanco(null).code === undefined);
  const resumo = JSON.stringify(resumoDoErro(embrulho));
  ok(
    "o resumo para log não carrega os parâmetros",
    !resumo.includes("comentário sensível") && resumo.includes("pesquisa_encerrada"),
  );
}

/* ─── Exportação CSV ─────────────────────────────────────────────────────── */

console.log("\nCSV do relatório");

const csv = relatorioParaCsv({
  porMissao: [
    {
      id: "1",
      nome: "Missão São José",
      acoes: 3,
      participantes: 240,
      servos: 18,
      receitas: 1500.5,
      despesas: 300.25,
      saldo: 1200.25,
      nps: 8.75,
      comNps: 2,
      impacto: 71.6,
      comImpacto: 3,
    },
    {
      // Nome com aspas e ponto e vírgula: os dois caracteres que quebram CSV.
      id: "2",
      nome: 'Missão "Aparecida"; Zona Leste',
      acoes: 1,
      participantes: 80,
      servos: 6,
      receitas: 0,
      despesas: 45.9,
      saldo: -45.9,
      nps: null,
      comNps: 0,
      impacto: null,
      comImpacto: 0,
    },
  ],
  porTipo: [],
  total: {
    acoes: 4,
    participantes: 320,
    servos: 24,
    receitas: 1500.5,
    despesas: 346.15,
    saldo: 1154.35,
    nps: 8.75,
    comNps: 2,
    impacto: 71.6,
    comImpacto: 3,
  },
  // Instantes de São Paulo, como `lerPeriodo` produz: `new Date(2026, 0, 1)`
  // seria meia-noite do fuso do processo, e em UTC ainda é 31/12/2025 lá.
  periodo: { de: inicioDoDia("2026-01-01")!, ate: fimDoDia("2026-12-31")! },
});

// Sem o BOM, o Excel lê UTF-8 como Latin-1 e "Ação" vira "AÃ§Ã£o".
ok("começa com BOM UTF-8", csv.charCodeAt(0) === 0xfeff);
ok("usa ponto e vírgula como separador", csv.includes("Nome;Ações"));
ok("decimal com vírgula", csv.includes("1500,50"));
ok("preserva valor negativo", csv.includes("-45,90"));
ok("escapa aspas dentro do campo", csv.includes('""Aparecida""'));
ok(
  "envolve em aspas o campo que contém ponto e vírgula",
  csv.includes('"Missão ""Aparecida""; Zona Leste"'),
);
ok("quebra de linha CRLF", csv.split("\r\n").length > 4);
ok("NPS médio com uma casa e vírgula", csv.includes(";8,8;2;72;3"));
ok(
  "sem pesquisa e sem índice ficam vazios, não zero",
  csv.includes("-45,90;;0;;0"),
);

/* O `?centro=` da lista de grupos vem da URL, que qualquer um edita. Um valor
   que não é uuid nem o sentinela chegaria ao banco como comparação com coluna
   `uuid` e derrubaria a página com "invalid input syntax for type uuid" — daí
   estes casos serem teste, e não confiança. */
console.log("\nFiltro de centro na URL");
const UUID = "6f1d3b2e-6a1c-4d3f-9f2a-8c7b5e4d3a21";
ok("uuid passa", lerFiltroDeCentro(UUID) === UUID);
ok("texto qualquer vira ausência de filtro", lerFiltroDeCentro("lixo") === undefined);
ok("vazio vira ausência de filtro", lerFiltroDeCentro("") === undefined);
ok("ausente vira ausência de filtro", lerFiltroDeCentro(undefined) === undefined);
ok(
  "lista de valores repetidos vira ausência de filtro",
  lerFiltroDeCentro([UUID, UUID]) === undefined,
);

if (falhas) {
  console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("\n✓ Schemas idempotentes e CSV no formato esperado.\n");
