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

/* Não há mais sentinela de "sem centro": todo grupo e toda ação pertencem a um
   centro, e o principal é o destino do que não foi separado em outra frente.
   Onde havia "Diretamente na missão", hoje há o nome do centro principal. */

/**
 * Lê `?centro=` da URL, que qualquer um edita.
 *
 * Devolve `undefined` para o que não é um id possível — e aí a tela mostra
 * tudo, como faria sem filtro. Sem isto, um valor qualquer chegaria ao banco
 * como comparação com coluna `uuid` e derrubaria a página com "invalid input
 * syntax for type uuid".
 */
export function lerFiltroDeCentro(valor: unknown) {
  if (typeof valor !== "string" || !valor) return undefined;
  return z.uuid().safeParse(valor).success ? valor : undefined;
}

/** Igual ao de cima, para `?missao=` — o que não é id possível vira "todas". */
export function lerFiltroDeMissao(valor: unknown) {
  return lerFiltroDeCentro(valor);
}

/**
 * Filtros da tela /centros, que atravessa missões.
 *
 * Não confundir com `lerFiltroDeCentro` acima, que lê um `?centro=` isolado:
 * esta lê a barra de filtros inteira daquela tela.
 */
export function lerFiltrosDeCentros(
  parametros: Record<string, string | string[] | undefined>,
) {
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" && valor ? valor : undefined;
  };

  const tipo = texto("tipo");

  return {
    missaoId: lerFiltroDeMissao(texto("missao")),
    tipo: TIPOS_CENTRO.map((t) => t.valor).find((t) => t === tipo),
  };
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
 * Obrigatória: o banco também impõe, e aqui a mensagem chega no campo certo em
 * vez de a tela mostrar a violação de `not null`. O formulário já abre com o
 * centro principal marcado, então na prática ninguém vê este erro — ele existe
 * para a requisição forjada e para o `""` que o Select devolveria se a lista
 * chegasse vazia.
 */
export const centroIdObrigatorio = z.uuid("Escolha o centro de evangelização.");

export function rotuloDoTipo(tipo: (typeof TIPOS_CENTRO)[number]["valor"]) {
  return TIPOS_CENTRO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}
