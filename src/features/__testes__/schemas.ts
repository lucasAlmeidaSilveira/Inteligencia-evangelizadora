import { config } from "dotenv";

config({ path: ".env.local" });

import type { z } from "zod";

import { grupoSchema } from "@/features/grupos/schemas";
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

verificar(
  "Missão — apenas o nome preenchido",
  missaoSchema,
  {
    nome: "Missão Teste",
    cidade: "São Paulo",
    regiao: "",
    endereco: "",
    dataFundacao: "",
    responsavelNome: "",
    contatoTelefone: "",
    contatoEmail: "",
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
    responsavelNome: "Maria Silva",
    contatoTelefone: "(11) 90000-0000",
    contatoEmail: "maria@missao.org.br",
    membrosTotal: "240",
    observacoes: "Missão com forte atuação social.",
    ativo: true,
  },
  "formulário completo",
);

verificar(
  "Grupo de oração — mínimo",
  grupoSchema,
  {
    nome: "Grupo Teste",
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

if (falhas) {
  console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("\n✓ Schemas idempotentes: cliente e servidor concordam.\n");
