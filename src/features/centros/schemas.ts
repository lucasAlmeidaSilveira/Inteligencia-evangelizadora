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

export const TIPOS_CENTRO = [
  { valor: "centro_evangelizacao", rotulo: "Centro de Evangelização" },
  { valor: "irradiacao", rotulo: "Irradiação" },
] as const;

/**
 * "Nenhum centro" com um nome, porque o vazio não serve nos dois lugares onde
 * essa opção aparece: o Radix recusa item de valor "", e na query string um
 * `centro=` vazio não se distingue de filtro ausente.
 *
 * Não é um uuid, então nunca colide com o id de um centro de verdade.
 */
export const SEM_CENTRO = "sem-centro";

/**
 * Lê `?centro=` da URL, que qualquer um edita.
 *
 * Devolve `undefined` para o que não é um centro possível — e aí a tela mostra
 * tudo, como faria sem filtro. Sem isto, um valor qualquer chegaria ao banco
 * como comparação com coluna `uuid` e derrubaria a página com "invalid input
 * syntax for type uuid".
 */
export function lerFiltroDeCentro(valor: unknown) {
  if (typeof valor !== "string" || !valor) return undefined;
  if (valor === SEM_CENTRO) return SEM_CENTRO;
  return z.uuid().safeParse(valor).success ? valor : undefined;
}

export const centroSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe ao menos 3 caracteres.")
    .max(120, "No máximo 120 caracteres."),
  tipo: z.enum(["centro_evangelizacao", "irradiacao"], {
    error: "Escolha entre centro de evangelização e irradiação.",
  }),
  /* Em branco significa "a mesma da missão" — por isso opcional aqui, ao
     contrário de `missaoSchema`, onde a cidade é obrigatória. */
  cidade: opcional(80),
  regiao: opcional(80),
  endereco: opcional(300),
  dataFundacao: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Data inválida.")
    .refine(
      (v) => v === null || new Date(v) <= new Date(),
      "A fundação não pode ser no futuro.",
    ),
  contatoTelefone: opcional(30),
  observacoes: opcional(2000),
  ativo: z.boolean(),
});

export type DadosCentro = z.input<typeof centroSchema>;

/* A missão não é campo deste schema: vem por parâmetro da action, como em
   `criarGrupo(missaoId, entrada)`. Aceitá-la do formulário deixaria um
   auxiliar cadastrar centro na missão alheia forjando a requisição — o RLS
   recusaria, mas a regra é não oferecer a porta. */

/**
 * Escolha do centro dentro de outro cadastro — grupo de oração, ação
 * apostólica.
 *
 * `""` é o que o Select devolve na opção "Diretamente na missão"; `null` é o
 * que o banco guarda. Aceitar os dois na entrada é o que torna o schema
 * idempotente entre o cliente e a revalidação no servidor.
 */
export const centroIdOpcional = z
  .union([z.uuid("Centro inválido."), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export function rotuloDoTipo(tipo: (typeof TIPOS_CENTRO)[number]["valor"]) {
  return TIPOS_CENTRO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}
