import { z } from "zod";

/** Idempotente: aceita "" do formulário e null da revalidação no servidor. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** "Pastor" é como as missões chamam quem responde por um grupo de oração. */
export const pastorSchema = z.object({
  nome: z
    .string()
    .trim()
    // Dois caracteres: "Zé" e "Ana" são nomes reais e um mínimo de três os
    // rejeitaria sem motivo.
    .min(2, "Informe o nome do pastor.")
    .max(120, "No máximo 120 caracteres."),
  telefone: opcional(30),
});

export const grupoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe ao menos 3 caracteres.")
    .max(120, "No máximo 120 caracteres."),
  quantidadePessoas: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: "Informe um número." }),
    )
    .pipe(
      z
        .number()
        .int("Use um número inteiro.")
        .min(0, "Não pode ser negativo.")
        .max(100_000, "Valor acima do razoável."),
    ),
  /** Select devolve "" quando ninguém escolhe; o banco espera null. */
  diaSemana: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      v === "" || v === null || v === undefined ? null : Number(v),
    )
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 6),
      "Dia da semana inválido.",
    ),
  horario: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v),
      "Horário inválido.",
    ),
  local: opcional(160),
  observacoes: opcional(1000),
  ativo: z.boolean(),
  /** O limite de 3 também é imposto pelo banco, via CHECK + unicidade de ordem. */
  pastores: z
    .array(pastorSchema)
    .min(1, "Um grupo precisa de ao menos um pastor.")
    .max(3, "Um grupo aceita no máximo 3 pastores."),
});

export type DadosGrupo = z.input<typeof grupoSchema>;

export const DIAS_SEMANA = [
  { valor: "0", rotulo: "Domingo" },
  { valor: "1", rotulo: "Segunda-feira" },
  { valor: "2", rotulo: "Terça-feira" },
  { valor: "3", rotulo: "Quarta-feira" },
  { valor: "4", rotulo: "Quinta-feira" },
  { valor: "5", rotulo: "Sexta-feira" },
  { valor: "6", rotulo: "Sábado" },
] as const;

export function nomeDoDia(dia: number | null) {
  if (dia === null) return null;
  return DIAS_SEMANA.find((d) => d.valor === String(dia))?.rotulo ?? null;
}
