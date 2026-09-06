import "server-only";

import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Lê uma coluna de timestamp como ISO-8601 em vez de `Date`.
 *
 * Existe por causa do cache. O `unstable_cache` grava com `JSON.stringify` e
 * lê com `JSON.parse`: na falta da entrada a consulta devolve o `Date` que o
 * driver produziu, e no acerto devolve a string que voltou do JSON. O tipo
 * declarado seria verdade na primeira visita e mentira na segunda, e o
 * `.getTime()` quebraria só depois de o cache esquentar — em produção, nunca
 * no teste.
 *
 * Fixando ISO na origem, a consulta devolve sempre a mesma coisa. É a mesma
 * escolha que o projeto já faz com dinheiro: a forma que atravessa
 * serialização sem perder nada vale mais que o tipo mais rico.
 *
 * Os formatadores de `lib/format.ts` aceitam `string | Date`, então nenhuma
 * tela precisa mudar.
 *
 * A coluna é interpolada no template, não escrita como texto: assim o Drizzle
 * emite a referência qualificada. Nome de tabela solto dentro de `sql` é o que
 * o Postgres resolve para a coluna homônima da tabela interna, devolvendo
 * resultado errado sem erro algum.
 */
export function emIso(coluna: PgColumn) {
  return sql<string>`${coluna}`.mapWith((valor) =>
    valor instanceof Date
      ? valor.toISOString()
      : new Date(valor as string).toISOString(),
  );
}

/** Versão para coluna anulável — `null` continua `null`. */
export function emIsoOuNulo(coluna: PgColumn) {
  return sql<string | null>`${coluna}`.mapWith((valor) =>
    valor === null || valor === undefined
      ? null
      : valor instanceof Date
        ? valor.toISOString()
        : new Date(valor as string).toISOString(),
  );
}
