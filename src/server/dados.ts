import "server-only";

import { escopoDe, requerUsuario, type UsuarioSessao } from "@/server/auth/sessao";
import { comEscopo } from "@/server/db/escopo";
import type { Transacao } from "@/server/db/index";

/**
 * Porta de entrada para qualquer dado de missão.
 *
 * Resolve a sessão e abre a transação já com o escopo aplicado, de modo que
 * as consultas dentro do callback só enxergam o que o usuário pode ver — sem
 * precisar lembrar de nenhum filtro por missão.
 */
export async function comUsuario<T>(
  executar: (tx: Transacao, usuario: UsuarioSessao) => Promise<T>,
): Promise<T> {
  const usuario = await requerUsuario();
  return comEscopo(escopoDe(usuario), (tx) => executar(tx, usuario));
}

/** Resultado padrão de Server Action, consumido pelos formulários. */
export type Resultado<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : { dados: T }))
  | { ok: false; erro: string; campos?: Record<string, string> };

export function sucesso(): Resultado;
export function sucesso<T>(dados: T): Resultado<T>;
export function sucesso<T>(dados?: T) {
  return dados === undefined ? { ok: true } : { ok: true, dados };
}

export function falha(erro: string, campos?: Record<string, string>) {
  return { ok: false as const, erro, campos };
}

/**
 * Traduz erros do Postgres em mensagens que o usuário entende.
 * Sem isso, uma violação de UNIQUE chega na tela como
 * "duplicate key value violates unique constraint uq_...".
 */
export function traduzirErroDeBanco(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code;
  const restricao = (erro as { constraint?: string })?.constraint ?? "";

  if (codigo === "23505") {
    // Antes do ramo genérico de "nome": aqui o conflito é dentro de uma missão,
    // e dizer isso poupa o usuário de procurar o homônimo nas outras.
    if (restricao.includes("centro_nome_por_missao")) {
      return "Esta missão já tem um centro com esse nome.";
    }
    if (restricao.includes("slug") || restricao.includes("nome")) {
      return "Já existe um registro com esse nome.";
    }
    if (restricao.includes("competencia")) {
      return "Já existe registro para esse mês.";
    }
    if (restricao.includes("responsavel_por_missao")) {
      return "Esta missão já tem um responsável. Troque o papel do atual antes de indicar outro.";
    }
    if (restricao.includes("email")) {
      return "Já existe usuário com esse e-mail.";
    }
    if (restricao.includes("responsavel_ordem")) {
      return "Essa posição de pastor já está ocupada.";
    }
    return "Esse registro já existe.";
  }

  if (codigo === "23514") {
    if (restricao.includes("periodo")) {
      return "A data de término não pode ser anterior à de início.";
    }
    if (restricao.includes("ordem_entre_um_e_tres")) {
      return "Um grupo aceita no máximo 3 pastores.";
    }
    if (restricao.includes("valor_positivo")) {
      return "O valor precisa ser maior que zero.";
    }
    if (restricao.includes("papel_e_missao_coerentes")) {
      return "O administrador master não pertence a missão alguma; os demais precisam de uma.";
    }
    return "Algum valor informado não é aceito.";
  }

  if (codigo === "23503") {
    if (restricao.includes("usuarios_missao_id")) {
      return "Esta missão ainda tem usuários vinculados. Transfira ou desative essas pessoas antes de excluí-la.";
    }
    // A chave composta (centro, missão) barrou a combinação: o centro
    // escolhido pertence a outra missão.
    if (restricao.includes("centro_da_missao")) {
      return "Esse centro não é desta missão. Escolha outro ou deixe em branco.";
    }
    return "Este registro está vinculado a outros e não pode ser removido.";
  }

  // RLS bloqueou a escrita: o usuário tentou algo fora da sua missão.
  if (codigo === "42501") {
    return "Você não tem permissão para essa ação.";
  }

  console.error("Erro de banco não tratado:", erro);
  return "Não foi possível concluir. Tente novamente.";
}
