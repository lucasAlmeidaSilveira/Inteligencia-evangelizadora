/**
 * O erro do Postgres de verdade, por baixo do que o Drizzle embrulha.
 *
 * `tx.execute()` e os builders lançam `DrizzleQueryError`, que carrega o erro
 * do `pg` em `cause` — e é lá que estão `code` e `constraint`. Ler no de cima
 * faz toda tradução cair no genérico "Não foi possível concluir", em silêncio,
 * e a mensagem do embrulho ainda traz os parâmetros da consulta (num
 * comentário de pesquisa, o texto do participante).
 *
 * Em `lib/` e sem `server-only` para poder ser testado por `testar:schemas`;
 * não toca banco algum.
 */
export type ErroDePostgres = {
  code?: string;
  constraint?: string;
  message?: string;
};

export function erroDeBanco(erro: unknown): ErroDePostgres {
  let atual = erro as (ErroDePostgres & { cause?: unknown }) | null | undefined;
  for (let i = 0; i < 5 && atual && !atual.code && atual.cause; i++) {
    atual = atual.cause as typeof atual;
  }
  return atual ?? {};
}

/** O que pode ir para o log: nunca a consulta nem os parâmetros. */
export function resumoDoErro(erro: unknown) {
  const base = erroDeBanco(erro);
  return {
    code: base.code,
    constraint: base.constraint,
    mensagem: base.message,
  };
}
