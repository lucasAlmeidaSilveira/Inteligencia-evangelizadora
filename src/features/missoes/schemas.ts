import { z } from "zod";

/**
 * Campo de texto que o formulário envia vazio e o banco deve receber como nulo.
 *
 * Aceita `null` na entrada de propósito: o cliente valida, transforma "" em
 * null e envia o resultado para a Server Action, que revalida os mesmos dados.
 * Um schema usado nas duas pontas precisa ser idempotente — sem `.nullish()`
 * a segunda passagem falharia com "expected string, received null".
 */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const missaoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe ao menos 3 caracteres.")
    .max(120, "No máximo 120 caracteres."),
  cidade: z.string().trim().min(2, "Informe a cidade.").max(80),
  regiao: opcional(80),
  endereco: opcional(200),
  dataFundacao: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      "Data inválida.",
    )
    .refine(
      (v) => v === null || new Date(v) <= new Date(),
      "A fundação não pode ser no futuro.",
    ),
  contatoTelefone: opcional(30),
  membrosTotal: z
    .preprocess(
      // Campo vazio, nulo ou ausente significa "sem contagem" — vira zero.
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: "Informe um número." }),
    )
    .pipe(
      z
        .number()
        .int("Use um número inteiro.")
        .min(0, "Não pode ser negativo.")
        .max(1_000_000, "Valor acima do razoável."),
    ),
  observacoes: opcional(2000),
  ativo: z.boolean(),
});

export type DadosMissao = z.input<typeof missaoSchema>;

/* Não há schema de criação separado. Quem responde pela missão é a conta com
   papel `responsavel` vinculada a ela, e gravar esse vínculo é assunto de
   `usuarioSchema`, em `features/config` — o único lugar que passa por
   `normalizar()` e pelas policies de RLS. Criar e editar missão usam o mesmo
   schema porque o cadastro da missão é o mesmo nos dois momentos. */

/** Snapshot mensal — o dia é sempre 1, imposto também por CHECK no banco. */
export const competenciaSchema = z.object({
  missaoId: z.uuid(),
  // Aceita "2026-09" do <input type="month"> e "2026-09-01" da revalidação.
  // Normalizar sempre pelos 7 primeiros caracteres mantém a transformação
  // estável quando o schema roda de novo sobre o próprio resultado.
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Escolha o mês.")
    .transform((v) => `${v.slice(0, 7)}-01`),
  observacao: opcional(500),
});

export type DadosCompetencia = z.input<typeof competenciaSchema>;
