import { z } from "zod";

import { centroIdOpcional } from "@/features/centros/schemas";

/** Idempotente: aceita "" do formulário e null da revalidação no servidor. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const inteiroNaoNegativo = (max: number, rotulo: string) =>
  z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: `Informe um número em ${rotulo}.` }),
    )
    .pipe(
      z
        .number()
        .int("Use um número inteiro.")
        .min(0, "Não pode ser negativo.")
        .max(max, "Valor acima do razoável."),
    );

export const STATUS_EVENTO = [
  { valor: "planejado", rotulo: "Planejado" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "cancelado", rotulo: "Cancelado" },
] as const;

export const eventoSchema = z
  .object({
    missaoId: z.uuid("Escolha a missão."),
    /** Opcional: sem centro, a ação é da missão inteira. O banco ainda impõe,
     *  por FK composta, que o centro escolhido seja da missão escolhida. */
    centroId: centroIdOpcional,
    tipoEventoId: z.uuid("Escolha o tipo da ação."),
    titulo: z
      .string()
      .trim()
      .min(3, "Informe ao menos 3 caracteres.")
      .max(160, "No máximo 160 caracteres."),
    descricao: opcional(4000),
    observacoes: opcional(4000),
    // `datetime-local` entrega "2026-03-12T09:00" — sem fuso. Interpretamos no
    // fuso do navegador, que é o de quem está cadastrando.
    dataInicio: z
      .string()
      .min(1, "Informe a data de início.")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Data de início inválida."),
    dataFim: z
      .string()
      .min(1, "Informe a data de término.")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Data de término inválida."),
    local: opcional(200),
    endereco: opcional(300),
    participantesTotal: inteiroNaoNegativo(1_000_000, "participantes"),
    servosEngajados: inteiroNaoNegativo(100_000, "servos engajados"),
    status: z.enum(["planejado", "em_andamento", "realizado", "cancelado"]),
  })
  // O banco também impõe isto por CHECK; aqui a mensagem chega no campo certo.
  .refine((d) => new Date(d.dataFim) >= new Date(d.dataInicio), {
    message: "O término não pode ser anterior ao início.",
    path: ["dataFim"],
  });

export type DadosEvento = z.input<typeof eventoSchema>;

export const lancamentoSchema = z.object({
  eventoId: z.uuid(),
  tipo: z.enum(["receita", "despesa"]),
  categoriaId: z
    .union([z.uuid(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  descricao: z
    .string()
    .trim()
    .min(2, "Descreva o lançamento.")
    .max(200, "No máximo 200 caracteres."),
  /** Aceita "1.234,56" e "1234.56". Guardado como string para não perder
   *  centavos em ponto flutuante — o Postgres recebe `numeric`. */
  valor: z
    .union([z.string(), z.number()])
    .transform((v) => {
      if (typeof v === "number") return v;
      const limpo = v.trim().replace(/\./g, "").replace(",", ".");
      return Number(limpo);
    })
    .pipe(
      z
        .number({ error: "Informe um valor." })
        .positive("O valor precisa ser maior que zero.")
        .max(99_999_999.99, "Valor acima do limite."),
    )
    .transform((n) => n.toFixed(2)),
  data: z
    .string()
    .min(1, "Informe a data.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida."),
});

export type DadosLancamento = z.input<typeof lancamentoSchema>;

export const linkSchema = z.object({
  eventoId: z.uuid(),
  titulo: z
    .string()
    .trim()
    .min(2, "Informe um título.")
    .max(120, "No máximo 120 caracteres."),
  url: z
    .string()
    .trim()
    .min(1, "Informe o endereço.")
    // Normaliza antes de validar: quem digita "site.com.br" quer https.
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => z.url().safeParse(v).success, "Endereço inválido.")
    .refine((v) => /^https?:\/\//i.test(v), "Use um endereço http ou https."),
  descricao: opcional(300),
});

export type DadosLink = z.input<typeof linkSchema>;
