import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { comEscopo, type Escopo } from "@/server/db/escopo";
import { usuarioMissoes, usuarios } from "@/server/db/schema";
import type { Papel } from "@/server/db/schema";
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
  ehAdmin: boolean;
  /** Missões que este usuário pode enxergar. Vazio para admin — ele vê todas. */
  missoes: string[];
};

/**
 * Troca o token do Firebase por um cookie de sessão httpOnly.
 * O token do cliente vive 1 hora e fica acessível ao JavaScript da página;
 * o cookie de sessão dura mais e o navegador nunca o entrega a script algum.
 */
export async function criarSessao(idToken: string) {
  const auth = adminAuth();

  // `true` força checar revogação: uma conta desativada há segundos não entra.
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
      const token = await adminAuth().verifySessionCookie(cookie);
      // Invalida os refresh tokens: encerra a sessão em todos os dispositivos.
      await adminAuth().revokeRefreshTokens(token.sub);
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
    const [usuario] = await tx
      .select()
      .from(usuarios)
      .where(eq(usuarios.firebaseUid, firebaseUid))
      .limit(1);

    if (!usuario || !usuario.ativo) return null;

    const ehAdmin = usuario.papel === "admin";

    // Agora que sabemos quem é, ampliamos o escopo dentro da mesma transação
    // para poder ler os vínculos com as missões.
    await tx.execute(sql`
      select
        set_config('app.usuario_id', ${usuario.id}, true),
        set_config('app.eh_admin', ${ehAdmin ? "on" : "off"}, true)
    `);

    const vinculos = ehAdmin
      ? []
      : await tx
          .select({ missaoId: usuarioMissoes.missaoId })
          .from(usuarioMissoes)
          .where(eq(usuarioMissoes.usuarioId, usuario.id));

    return {
      id: usuario.id,
      firebaseUid: usuario.firebaseUid,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ehAdmin,
      missoes: vinculos.map((v) => v.missaoId),
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
    const token = await adminAuth().verifySessionCookie(cookie, true);
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

/** Escopo de banco correspondente ao usuário — o que as policies vão ler. */
export function escopoDe(usuario: UsuarioSessao): Escopo {
  return {
    firebaseUid: usuario.firebaseUid,
    usuarioId: usuario.id,
    ehAdmin: usuario.ehAdmin,
  };
}
