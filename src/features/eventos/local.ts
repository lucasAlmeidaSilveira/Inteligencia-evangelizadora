import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { centrosEvangelizacao, eventos } from "@/server/db/schema";

/*
 * Onde a ação acontece, para quem só lê.
 *
 * O local tem duas fontes: um centro da missão (`local_centro_id`) ou o texto
 * livre (`local` e `endereco`) — uma ou outra, nunca as duas, pelo CHECK
 * `local_centro_ou_texto`. Quem exibe não precisa saber qual: as expressões
 * abaixo devolvem o que se mostra, e é por isso que lista, painel, calendário
 * e relatório continuam lendo `local` como sempre leram. Só os formulários
 * olham as colunas cruas.
 *
 * Sem `server-only`: `relatorios/acoes-do-ano.ts` usa isto e precisa continuar
 * ao alcance de teste fora do Next.
 */

/** A segunda junção da ação com `centros_evangelizacao` — a primeira é a do
 *  centro de que a ação é —, daí o apelido. Sempre em `leftJoin`: o local é
 *  opcional, e um `innerJoin` sumiria com toda ação sem centro como local. */
export const centroDoLocal = alias(centrosEvangelizacao, "centro_do_local");

export const juncaoDoLocal = eq(centroDoLocal.id, eventos.localCentroId);

/** Nome pelo JOIN, não copiado: renomear o centro renomeia o local junto. */
export const nomeDoLocal = sql<
  string | null
>`coalesce(${centroDoLocal.nome}, ${eventos.local})`;

export const enderecoDoLocal = sql<
  string | null
>`coalesce(${centroDoLocal.endereco}, ${eventos.endereco})`;
