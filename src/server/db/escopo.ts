import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";

import { DEFINIR_SEARCH_PATH } from "./conexao";
import { pool, type Transacao } from "./index";
import * as schema from "./schema";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UID_FIREBASE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * O escopo entra na mesma ida ao banco que o BEGIN.
 *
 * Com o banco a 200 ms de distância, cada ida e volta pesa mais que a consulta
 * em si — juntar as duas primeiras corta um quarto do tempo da transação.
 * Isso exige o protocolo simples, que não aceita parâmetros, então os valores
 * são validados por formato antes de entrar na string. Qualquer coisa fora do
 * padrão vira escopo vazio, que o RLS trata como "ninguém".
 */
function literal(valor: string | undefined, formato: RegExp) {
  return valor && formato.test(valor) ? valor : "";
}

export async function comEscopo<T>(
  escopo: Escopo,
  executar: (tx: Transacao) => Promise<T>,
): Promise<T> {
  const firebaseUid = literal(escopo.firebaseUid, UID_FIREBASE);
  const usuarioId = literal(escopo.usuarioId, UUID);
  const ehAdmin = escopo.ehAdmin ? "on" : "off";

  const cliente = await pool.connect();

  try {
    // `set_config(..., true)` é local à transação: some no commit ou rollback
    // e nunca vaza para a próxima requisição que reutilizar esta conexão.
    // O `search_path` entra junto: o pooler do Neon recusa defini-lo como
    // parâmetro de inicialização da conexão, e por transação é mais seguro
    // com pooling — a conexão é compartilhada entre requisições.
    await cliente.query(
      `begin; ${DEFINIR_SEARCH_PATH};` +
        ` select set_config('app.firebase_uid', '${firebaseUid}', true),` +
        ` set_config('app.usuario_id', '${usuarioId}', true),` +
        ` set_config('app.eh_admin', '${ehAdmin}', true);`,
    );

    const tx = drizzle(cliente, { schema }) as Transacao;
    const resultado = await executar(tx);

    await cliente.query("commit");
    return resultado;
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}
