import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSAO } from "@/lib/auth-cookie";

const ROTAS_PUBLICAS = [
  "/login",
  "/api/auth",
  // Diagnóstico de implantação: precisa responder justamente quando ninguém
  // consegue entrar. Devolve apenas situações — presente/ausente,
  // alcançável/não —, nunca valores ou credenciais.
  "/api/saude",
];

/**
 * O middleware roda no Edge, onde o SDK do Firebase Admin não existe — ele
 * apenas verifica se há cookie de sessão, para redirecionar cedo e evitar um
 * piscar de tela protegida.
 *
 * Isto é conveniência, não segurança: quem valida o cookie de verdade é
 * `usuarioAtual()`, no servidor, em toda página e Server Action.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));
  const temCookie = request.cookies.has(COOKIE_SESSAO);

  if (!temCookie && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirecionar", pathname);
    return NextResponse.redirect(url);
  }

  if (temCookie && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
