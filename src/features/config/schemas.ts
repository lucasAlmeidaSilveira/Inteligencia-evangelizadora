import { z } from "zod";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Cores sugeridas: separadas entre si e legíveis nos dois temas. Quem quiser
 *  outra digita o hexadecimal — o banco só aceita `#rrggbb`. */
export const CORES_SUGERIDAS = [
  { hex: "#7f22fe", nome: "Roxo" },
  { hex: "#be7200", nome: "Dourado" },
  { hex: "#00abb9", nome: "Turquesa" },
  { hex: "#d93f61", nome: "Rosa" },
  { hex: "#116bb5", nome: "Azul" },
  { hex: "#1f8a4c", nome: "Verde" },
  { hex: "#c2410c", nome: "Laranja" },
  { hex: "#7c2d55", nome: "Vinho" },
  { hex: "#4338ca", nome: "Índigo" },
  { hex: "#525252", nome: "Grafite" },
] as const;

export const tipoEventoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do tipo.")
    .max(80, "No máximo 80 caracteres."),
  cor: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "Use uma cor no formato #rrggbb."),
  descricao: opcional(300),
  ordem: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: "Informe um número." }),
    )
    .pipe(z.number().int().min(0).max(999)),
  ativo: z.boolean(),
});

export type DadosTipoEvento = z.input<typeof tipoEventoSchema>;

export const categoriaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da categoria.")
    .max(80, "No máximo 80 caracteres."),
  tipo: z.enum(["receita", "despesa", "ambos"]),
  ordem: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: "Informe um número." }),
    )
    .pipe(z.number().int().min(0).max(999)),
  ativo: z.boolean(),
});

export type DadosCategoria = z.input<typeof categoriaSchema>;

export const TIPOS_CATEGORIA = [
  { valor: "receita", rotulo: "Só receitas" },
  { valor: "despesa", rotulo: "Só despesas" },
  { valor: "ambos", rotulo: "Receitas e despesas" },
] as const;

export const usuarioSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Informe o nome completo.")
      .max(120, "No máximo 120 caracteres."),
    email: z.email("E-mail inválido.").toLowerCase(),
    papel: z.enum(["admin", "responsavel", "auxiliar"]),
    /** Nula apenas para o admin master. */
    missaoId: z
      .union([z.uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    ativo: z.boolean(),
  })
  // O banco impõe o mesmo por CHECK; aqui a mensagem chega no campo certo.
  .refine((d) => (d.papel === "admin" ? !d.missaoId : Boolean(d.missaoId)), {
    message: "Escolha a missão a que esta pessoa pertence.",
    path: ["missaoId"],
  });

export type DadosUsuario = z.input<typeof usuarioSchema>;

export const PAPEIS = [
  {
    valor: "auxiliar",
    rotulo: "Auxiliar",
    descricao:
      "Registra grupos, ações, financeiro e indicadores da missão. Não altera o cadastro da missão nem convida ninguém.",
  },
  {
    valor: "responsavel",
    rotulo: "Responsável pela missão",
    descricao:
      "Tudo que o auxiliar faz, mais editar o cadastro da missão e convidar auxiliares. Um por missão.",
  },
  {
    valor: "admin",
    rotulo: "Administrador master",
    descricao:
      "Cria missões, configura o sistema e enxerga todas as missões. Não pertence a nenhuma.",
  },
] as const;

export const ROTULO_PAPEL: Record<string, string> = {
  admin: "Administrador master",
  responsavel: "Responsável",
  auxiliar: "Auxiliar",
};

/** Quem convida escolhe entre menos papéis do que o admin master. */
export function papeisDisponiveis(ehAdmin: boolean) {
  return ehAdmin ? PAPEIS : PAPEIS.filter((p) => p.valor === "auxiliar");
}
