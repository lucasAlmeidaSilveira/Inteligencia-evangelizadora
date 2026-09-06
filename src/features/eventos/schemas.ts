import { z } from "zod";

import { centroIdObrigatorio } from "@/features/centros/schemas";

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

/** Ponto agrupando milhares e nenhuma casa decimal: "1.234", "1.234.567". */
const MILHAR_COM_PONTO = /^\d{1,3}(\.\d{3})+$/;

/**
 * Dinheiro digitado, em número.
 *
 * Este schema roda duas vezes — no cliente pelo `zodResolver` e de novo na
 * Server Action, sobre a saída da primeira passagem. Então o parser precisa
 * reler o próprio resultado sem alterá-lo: apagar todo ponto, como faz o
 * lançamento (que só é validado no servidor), transformaria os "1234.56" que
 * ele mesmo produziu em 123456 — o orçamento multiplicado por cem a cada
 * salvamento, em silêncio, que é exatamente o que dinheiro não pode fazer.
 *
 * Daí a leitura por forma: vírgula manda, e é o decimal ("1.234,56"); sem
 * vírgula, o ponto só é separador de milhar quando agrupa de três em três
 * ("1.234"). No resto, ponto é decimal — inclusive na saída canônica.
 */
function comoNumero(bruto: string) {
  const texto = bruto.trim();
  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }
  if (MILHAR_COM_PONTO.test(texto)) return Number(texto.replace(/\./g, ""));
  return Number(texto);
}

/** Vazio devolve `null`, não zero: em branco é "não orçado", e gravar 0
 *  apagaria a diferença entre não ter orçamento e ter orçado nada. */
const dinheiroOpcional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) {
      return null;
    }
    return typeof v === "number" ? v : comoNumero(v);
  })
  .refine(
    (n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 99_999_999.99),
    "Informe um valor válido.",
  )
  .transform((n) => (n === null ? null : n.toFixed(2)));

export const STATUS_EVENTO = [
  { valor: "planejado", rotulo: "Planejado" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "cancelado", rotulo: "Cancelado" },
] as const;

export const eventoSchema = z
  .object({
    missaoId: z.uuid("Escolha a missão."),
    /** Obrigatório, e o formulário abre no principal da missão escolhida. O
     *  banco ainda impõe, por FK composta, que o centro seja daquela missão. */
    centroId: centroIdObrigatorio,
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
    responsavelNome: opcional(160),
    participantesInscritos: inteiroNaoNegativo(1_000_000, "inscritos"),
    participantesTotal: inteiroNaoNegativo(1_000_000, "participantes"),
    participantesNovos: inteiroNaoNegativo(1_000_000, "novos participantes"),
    participantesPermaneceram: inteiroNaoNegativo(
      1_000_000,
      "permaneceram após a ação",
    ),
    servosEngajados: inteiroNaoNegativo(100_000, "servos engajados"),
    orcamentoPrevisto: dinheiroOpcional,
    status: z.enum(["planejado", "em_andamento", "realizado", "cancelado"]),
    // Checkbox ausente no FormData vira `undefined`, que precisa virar `false`.
    destaqueRegional: z
      .union([z.boolean(), z.string(), z.undefined(), z.null()])
      .transform((v) => v === true || v === "true" || v === "on"),
  })
  // O banco também impõe isto por CHECK; aqui a mensagem chega no campo certo.
  .refine((d) => new Date(d.dataFim) >= new Date(d.dataInicio), {
    message: "O término não pode ser anterior ao início.",
    path: ["dataFim"],
  })
  /* Estas duas não têm CHECK no banco de propósito: são engano de digitação
     comum, e a mensagem precisa apontar o campo. Note que inscritos × presentes
     não é comparado — comparecer sem se inscrever é normal e frequente. */
  .refine((d) => d.participantesNovos <= d.participantesTotal, {
    message: "Não pode haver mais participantes novos do que presentes.",
    path: ["participantesNovos"],
  })
  .refine((d) => d.participantesPermaneceram <= d.participantesTotal, {
    message: "Não pode permanecer mais gente do que participou.",
    path: ["participantesPermaneceram"],
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
