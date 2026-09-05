"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { env } from "@/lib/env";

/** Estas chaves são públicas por natureza — identificam o projeto, não
 *  autorizam nada. A proteção real está na verificação do token no servidor. */
const config = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(app);
