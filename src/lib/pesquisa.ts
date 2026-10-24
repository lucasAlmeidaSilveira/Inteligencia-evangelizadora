/**
 * Formato do token de pesquisa: 32 bytes aleatórios em base64url, sempre 43
 * caracteres. Vive em `lib/` porque a página pública valida o parâmetro da URL
 * antes de qualquer ida ao banco, e `escopo.ts` valida de novo antes de pôr o
 * valor no `set_config` — as duas pontas precisam concordar.
 */
export const TOKEN_PESQUISA = /^[A-Za-z0-9_-]{43}$/;

export function tokenDePesquisaValido(valor: unknown): valor is string {
  return typeof valor === "string" && TOKEN_PESQUISA.test(valor);
}
