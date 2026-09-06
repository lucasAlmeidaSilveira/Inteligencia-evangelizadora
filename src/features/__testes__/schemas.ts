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
import { grupoSchema } from "@/features/grupos/schemas";
import { relatorioParaCsv } from "@/features/relatorios/csv";
import { competenciaSchema, missaoSchema } from "@/features/missoes/schemas";

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
  local: "",
  endereco: "",
  responsavelNome: "",
  participantesInscritos: "",
  participantesTotal: "",
  participantesNovos: "",
  participantesPermaneceram: "",
  servosEngajados: "",
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
    orcamentoPrevisto: "12.400,50",
    status: "realizado",
    destaqueRegional: true,
  },
  "formulário completo",
);

verificar(
  "Ação apostólica — orçamento já no formato canônico",
  eventoSchema,
  { ...acaoBase, orcamentoPrevisto: "8900.00" },
  "valor com ponto decimal, como volta do banco",
);

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
    local: "",
    endereco: "",
    responsavelNome: "",
    status: "em_andamento",
  },
  "card de informações com os opcionais em branco",
);

verificar(
  "Seção Participação",
  participacaoSchema,
  {
    participantesInscritos: "168",
    participantesTotal: "142",
    participantesNovos: "58",
    participantesPermaneceram: "37",
    servosEngajados: "24",
  },
  "card de participação preenchido",
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
    quantidadePessoas: "",
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
    quantidadePessoas: "18",
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
    quantidadePessoas: "",
    ativo: true,
    pastores: [{ nome: "Maria Silva", telefone: "" }],
  },
  "centroId",
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
  },
  periodo: { de: new Date(2026, 0, 1), ate: new Date(2026, 11, 31) },
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
