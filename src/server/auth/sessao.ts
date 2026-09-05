import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { comEscopo, type Escopo, type Papel } from "@/server/db/escopo";
import { missoes, usuarios } from "@/server/db/schema";
import type { Transacao } from "@/server/db/index";
import { adminAuth } from "@/server/firebase/admin";
import { COOKIE_SESSAO } from "@/lib/auth-cookie";

export { COOKIE_SESSAO };


const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 24 * 5; // 5 dias

export type UsuarioSessao = {
  id: string;
  firebaseUid: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Missão a que pertence. Nula para o admin, que enxerga todas. */
  missaoId: string | null;
  missaoNome: string | null;
  ehAdmin: boolean;
  ehResponsavel: boolean;
  /** Admin convida qualquer um; responsável, auxiliares da própria missão. */
  podeConvidar: boolean;
  /** Alterar o cadastro da missão — o auxiliar registra, mas não altera. */
  podeEditarMissao: boolean;
};

/**
 * Troca o token do Firebase por um cookie de sessão httpOnly.
 * O token do cliente vive 1 hora e fica acessível ao JavaScript da página;
 * o cookie de sessão dura mais e o navegador nunca o entrega a script algum.
 */
export async function criarSessao(idToken: string) {
  const auth = await (await adminAuth());

  // No login vale a checagem de revogação: acontece uma vez, não a cada página.
  const token = await auth.verifyIdToken(idToken, true);

  const usuario = await carregarPorFirebaseUid(token.uid);
  if (!usuario) {
    throw new Error(
      "Sua conta ainda não foi liberada. Peça ao administrador para cadastrá-la.",
    );
  }

  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn: DURACAO_SESSAO_MS,
  });

  const jar = await cookies();
  jar.set(COOKIE_SESSAO, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });

  return usuario;
}

export async function encerrarSessao() {
  const jar = await cookies();
  const cookie = jar.get(COOKIE_SESSAO)?.value;

  if (cookie) {
    try {
      const token = await (await adminAuth()).verifySessionCookie(cookie);
      // Invalida os refresh tokens: encerra a sessão em todos os dispositivos.
      await (await adminAuth()).revokeRefreshTokens(token.sub);
    } catch {
      // Cookie já inválido — apagar basta.
    }
  }

  jar.delete(COOKIE_SESSAO);
}

async function carregarPorFirebaseUid(
  firebaseUid: string,
): Promise<UsuarioSessao | null> {
  return comEscopo({ firebaseUid }, async (tx: Transacao) => {
    // Uma consulta só. A missão vem por junção, não por consulta separada:
    // cada ida a menos ao banco aparece no tempo de resposta de toda página.
    const [linha] = await tx
      .select({
        id: usuarios.id,
        firebaseUid: usuarios.firebaseUid,
        nome: usuarios.nome,
        email: usuarios.email,
        papel: usuarios.papel,
        ativo: usuarios.ativo,
        missaoId: usuarios.missaoId,
        missaoNome: missoes.nome,
        missaoAtiva: missoes.ativo,
      })
      .from(usuarios)
      .leftJoin(missoes, eq(missoes.id, usuarios.missaoId))
      .where(eq(usuarios.firebaseUid, firebaseUid))
      .limit(1);

    if (!linha || !linha.ativo) return null;

    // Missão arquivada tranca quem depende dela: sem isso, desativar uma
    // missão deixaria seus responsáveis navegando num sistema vazio, sem
    // entender por quê.
    if (linha.papel !== "admin" && !linha.missaoAtiva) return null;

    const ehAdmin = linha.papel === "admin";
    const ehResponsavel = linha.papel === "responsavel";

    return {
      id: linha.id,
      firebaseUid: linha.firebaseUid,
      nome: linha.nome,
      email: linha.email,
      papel: linha.papel,
      missaoId: linha.missaoId,
      missaoNome: linha.missaoNome,
      ehAdmin,
      ehResponsavel,
      podeConvidar: ehAdmin || ehResponsavel,
      podeEditarMissao: ehAdmin || ehResponsavel,
    };
  });
}

/**
 * Usuário da requisição atual, ou `null`.
 * `cache` do React garante uma única verificação por renderização, mesmo que
 * dez Server Components diferentes perguntem quem está logado.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const jar = await cookies();
  const cookie = jar.get(COOKIE_SESSAO)?.value;
  if (!cookie) return null;

  try {
    /*
     * Sem `checkRevoked`: essa opção faz uma chamada à API do Firebase em
     * toda requisição (~300 ms medidos), só para saber se o token foi
     * revogado. A verificação local já confere assinatura e validade, e o
     * que realmente precisa surtir efeito imediato — desativar alguém — é
     * lido do nosso banco logo abaixo, pelo campo `ativo`.
     */
    const token = await (await adminAuth()).verifySessionCookie(cookie);
    return await carregarPorFirebaseUid(token.uid);
  } catch {
    // Expirado, revogado ou adulterado. Tratar como visitante.
    return null;
  }
});

/** Para páginas que exigem sessão. Redireciona em vez de lançar erro. */
export async function requerUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function requerAdmin(): Promise<UsuarioSessao> {
  const usuario = await requerUsuario();
  if (!usuario.ehAdmin) redirect("/");
  return usuario;
}

/** Para telas de gestão de acessos: admin master ou responsável da missão. */
export async function requerQuemConvida(): Promise<UsuarioSessao> {
  const usuario = await requerUsuario();
  if (!usuario.podeConvidar) redirect("/");
  return usuario;
}

/** Escopo de banco correspondente ao usuário — o que as policies vão ler. */
export function escopoDe(usuario: UsuarioSessao): Escopo {
  return {
    firebaseUid: usuario.firebaseUid,
    usuarioId: usuario.id,
    papel: usuario.papel,
    missaoId: usuario.missaoId,
  };
}
