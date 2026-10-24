import "server-only";

import { headers } from "next/headers";

import { envPublico } from "@/server/env";

/**
 * Origem absoluta para montar links que saem do sistema (o da pesquisa vai
 * num QR impresso e projetado).
 *
 * Em produção vem só de `APP_URL`: o cabeçalho `Host` é escrito pelo cliente,
 * e um valor forjado iria parar num QR em papel, sem volta. Sem a variável,
 * devolve `null` e a tela diz o que configurar. Fora de produção o fallback
 * para a origem da requisição é o que faz o link funcionar em `localhost`.
 *
 * Lê `headers()`, então só pode ser chamada em página ou action — nunca dentro
 * de `leituraCacheada`, que não tem requisição.
 */
export async function urlPublica(): Promise<string | null> {
  const fixa = envPublico().APP_URL;
  if (fixa) return fixa.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") return null;

  const cabecalhos = await headers();
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  return host ? `${protocolo}://${host}` : null;
}
