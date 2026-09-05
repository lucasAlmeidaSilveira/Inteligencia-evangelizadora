import "server-only";

import type { Auth } from "firebase-admin/auth";

import { envFirebase } from "@/server/env";

let auth: Auth | null = null;

/**
 * Acesso ao Firebase Admin, carregado sob demanda.
 *
 * O import é dinâmico de propósito. Estático, uma falha ao carregar a
 * biblioteca — como a que o `jose` ESM provocou em produção — derrubava o
 * módulo inteiro no carregamento, e toda página respondia 500 antes de
 * conseguir sequer redirecionar para o login. Dinâmico, a falha vira uma
 * exceção comum, que quem chama trata: sessão inválida leva ao login, que é
 * o comportamento seguro.
 */
export async function adminAuth(): Promise<Auth> {
  if (auth) return auth;

  const [{ cert, getApps, initializeApp }, { getAuth }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth"),
  ]);

  const app =
    getApps()[0] ??
    (() => {
      const env = envFirebase();
      return initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
      });
    })();

  auth = getAuth(app);
  return auth;
}
