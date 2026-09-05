import "server-only";

import { sql } from "drizzle-orm";

import { db, type Transacao } from "./index";

/**
 * Com o Supabase, o Postgres identificava o usuário sozinho pelo JWT. Usando
 * Firebase Auth, o banco vê apenas o usuário da aplicação — então somos nós
 * que informamos, a cada transação, quem está do outro lado.
 *
 * As policies de RLS leem esses valores. Toda leitura e escrita de dados de
 * missão passa por aqui: é o que torna impossível esquecer um filtro e
 * devolver dados de outra missão.
 */
export type Escopo = {
  firebaseUid?: string;
  usuarioId?: string;
  ehAdmin?: boolean;
};

async function aplicarEscopo(tx: Transacao, escopo: Escopo) {
  // `set_config(..., true)` é local à transação: some no commit ou rollback e
  // nunca vaza para a próxima requisição que reutilizar esta conexão do pool.
  // Um `SET LOCAL` normal não aceita parâmetros e exigiria interpolar string.
  await tx.execute(sql`
    select
      set_config('app.firebase_uid', ${escopo.firebaseUid ?? ""}, true),
      set_config('app.usuario_id', ${escopo.usuarioId ?? ""}, true),
      set_config('app.eh_admin', ${escopo.ehAdmin ? "on" : "off"}, true)
  `);
}

/** Executa o trabalho dentro de uma transação com o escopo do usuário ativo. */
export async function comEscopo<T>(
  escopo: Escopo,
  executar: (tx: Transacao) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await aplicarEscopo(tx, escopo);
    return executar(tx);
  });
}
