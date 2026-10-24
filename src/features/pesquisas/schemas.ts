import { z } from "zod";

import { TOKEN_PESQUISA } from "@/lib/pesquisa";

/**
 * Caracteres que não são texto: controles ASCII (menos quebra de linha e
 * tab), os separadores de linha e parágrafo do Unicode e os controles de
 * direção bidi. Os últimos não aparecem, mas invertem a ordem visual do que
 * vem depois — um comentário poderia se fingir de outro na lista do
 * coordenador.
 *
 * Montado a partir dos códigos, e não escrito como literal: alguns desses
 * caracteres são invisíveis no editor e um deles (U+2028) quebra o próprio
 * arquivo-fonte quando digitado por engano.
 */
const faixa = (de: number, ate: number) =>
  `${String.fromCodePoint(de)}-${String.fromCodePoint(ate)}`;

const NAO_TEXTO = new RegExp(
  `[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F` +
    `${faixa(0x2028, 0x2029)}${faixa(0x202a, 0x202e)}${faixa(0x2066, 0x2069)}]`,
  "g",
);

/**
 * Uma resposta vinda do formulário público. Roda duas vezes como os demais
 * schemas — no cliente e na Server Action — e precisa reler a própria saída.
 *
 * Vazio em `nota` é "não escolheu", e é recusado: ao contrário dos contadores
 * de participação, aqui zero é uma nota legítima e só vale quando foi de fato
 * marcada. `strict()` recusa chave inesperada — o formulário é fechado, e
 * qualquer campo a mais só pode vir de alguém montando a requisição à mão.
 */
export const respostaSchema = z
  .object({
    nota: z.preprocess(
      (v) => {
        if (typeof v === "string") return v.trim() === "" ? undefined : Number(v);
        return v;
      },
      z
        .number({ error: "Escolha uma nota de 0 a 10." })
        .int("Escolha uma das notas.")
        .min(0, "A nota vai de 0 a 10.")
        .max(10, "A nota vai de 0 a 10."),
    ),
    comentario: z
      .string()
      // Teto largo antes de limpar: um comentário enorme é recusado sem
      // passar pelo replace, e o limite de 500 vale sobre o texto limpo.
      .max(4000, "No máximo 500 caracteres.")
      .nullish()
      .transform((v) =>
        (v ?? "").replace(/\r\n?/g, "\n").replace(NAO_TEXTO, "").trim(),
      )
      .pipe(z.string().max(500, "No máximo 500 caracteres."))
      .transform((v) => (v ? v : null)),
    /** Honeypot: campo invisível que pessoa nenhuma preenche. O nome não
     *  parece endereço nem site de propósito: o preenchimento automático do
     *  navegador ignora `autocomplete="off"` para esses, e completaria o campo
     *  de uma pessoa real — que receberia "obrigado" sem nada gravado. */
    confirmacao: z
      .string()
      .max(200)
      .nullish()
      .transform((v) => v ?? ""),
  })
  .strict();

export type DadosResposta = z.input<typeof respostaSchema>;

/** O token como chega à action: valida sem `regex.test` sobre `unknown`. */
export const tokenSchema = z.string().regex(TOKEN_PESQUISA);

export const eventoIdSchema = z.uuid();
