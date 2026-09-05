import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { serverEnv } from "@/server/env";

let app: App | undefined;

function obterApp() {
  if (app) return app;

  const existente = getApps()[0];
  if (existente) {
    app = existente;
    return app;
  }

  const env = serverEnv();
  app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
  return app;
}

export function adminAuth() {
  return getAuth(obterApp());
}
