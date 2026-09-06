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
export type Papel = "admin" | "responsavel" | "auxiliar";

export type Escopo = {
  firebaseUid?: string;
  usuarioId?: string;
  papel?: Papel;
  /** Nula para o admin, que não pertence a missão alguma. */
  missaoId?: string | null;
};

export type OpcoesEscopo = {
  /**
   * Carimba `ultimo_acesso_em` de quem está no escopo, junto do COMMIT.
   *
   * Só o carregamento da sessão liga isto, e a transação precisa ser somente
   * leitura: em caso de falha o carimbo é descartado junto com ela — ver o
   * tratamento de erro abaixo.
   */
  registrarAcesso?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UID_FIREBASE = /^[A-Za-z0-9_-]{1,128}$/;
const PAPEIS = new Set<Papel>(["admin", "responsavel", "auxiliar"]);

/**
 * O escopo entra na mesma ida ao banco que o BEGIN.
 *
 * Com o banco a alguma distância, cada ida e volta pesa mais que a consulta em
 * si — juntar as duas primeiras corta um quarto do tempo da transação. Isso
 * exige o protocolo simples, que não aceita parâmetros, então os valores são
 * validados por formato antes de entrar na string. Qualquer coisa fora do
 * padrão vira escopo vazio, que o RLS trata como "ninguém".
 */
function literal(valor: string | null | undefined, formato: RegExp) {
  return valor && formato.test(valor) ? valor : "";
}

export async function comEscopo<T>(
  escopo: Escopo,
  executar: (tx: Transacao) => Promise<T>,
  opcoes: OpcoesEscopo = {},
): Promise<T> {
  const firebaseUid = literal(escopo.firebaseUid, UID_FIREBASE);
  const usuarioId = literal(escopo.usuarioId, UUID);
  const missaoId = literal(escopo.missaoId, UUID);
  const papel = escopo.papel && PAPEIS.has(escopo.papel) ? escopo.papel : "";

  const cliente = await pool.connect();

  try {
    // `set_config(..., true)` é local à transação: some no commit ou rollback
    // e nunca vaza para a próxima requisição que reutilizar esta conexão.
    //
    // O `search_path` entra junto: o pooler do Neon recusa defini-lo como
    // parâmetro de inicialização da conexão.
    await cliente.query(
      `begin; ${DEFINIR_SEARCH_PATH};` +
        ` select set_config('app.firebase_uid', '${firebaseUid}', true),` +
        ` set_config('app.usuario_id', '${usuarioId}', true),` +
        ` set_config('app.papel', '${papel}', true),` +
        ` set_config('app.missao_id', '${missaoId}', true);`,
    );

    const tx = drizzle(cliente, { schema }) as Transacao;
    const resultado = await executar(tx);

    if (opcoes.registrarAcesso) {
      /*
       * O carimbo pega carona no COMMIT — nenhuma ida a mais ao banco, pela
       * mesma razão que o escopo viaja junto do BEGIN. E vai no fim, não no
       * começo: assim o lock da linha do usuário dura o fecho da transação, e
       * não a requisição inteira.
       *
       * Dentro de `try` porque registrar acesso jamais pode derrubar um login.
       * Se a função não existir — código no ar antes de `pnpm db:migrate` — o
       * Postgres aborta a transação e o COMMIT vira ROLLBACK; como só o
       * caminho de sessão liga esta opção, e ele apenas lê, o resultado já
       * está aqui na memória e nada se perde.
       */
      try {
        await cliente.query("select ie.registrar_acesso(); commit");
      } catch (erro) {
        console.error("Não foi possível registrar o último acesso:", erro);
        await cliente.query("rollback").catch(() => undefined);
      }
      return resultado;
    }

    await cliente.query("commit");
    return resultado;
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}
