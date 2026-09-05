import { config } from "dotenv";

config({ path: ".env.local" });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Confere as credenciais do Firebase — as públicas e as da conta de serviço.
 *
 *   pnpm firebase:testar
 */
async function principal() {
  const vazia = (nome: string) =>
    !process.env[nome] || process.env[nome]!.startsWith("preencher");

  // A conta de serviço é a parte que costuma dar errado; vale poder validá-la
  // sozinha, sem depender da chave pública do app web.
  const daContaDeServico = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ].filter(vazia);

  if (daContaDeServico.length) {
    console.error(`✗ Não preenchidas em .env.local:\n   ${daContaDeServico.join("\n   ")}`);
    console.error("\n  Use: pnpm firebase:importar <caminho-do-json>");
    process.exit(1);
  }

  const doApp = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ].filter(vazia);

  const publico = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const servidor = process.env.FIREBASE_PROJECT_ID;

  if (publico !== servidor) {
    console.error(
      `✗ Projetos diferentes: público é "${publico}" e conta de serviço é "${servidor}".\n` +
        "  As duas metades precisam apontar para o mesmo projeto Firebase.",
    );
    process.exit(1);
  }

  const chave = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  if (!chave.includes("BEGIN PRIVATE KEY")) {
    console.error(
      "✗ FIREBASE_PRIVATE_KEY não parece uma chave.\n" +
        '  Cole o campo "private_key" inteiro do JSON, entre aspas, incluindo\n' +
        "  -----BEGIN PRIVATE KEY----- e -----END PRIVATE KEY-----.",
    );
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: servidor,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: chave,
      }),
    });
  }

  console.log(`→ Projeto: ${servidor}`);

  // Qualquer chamada administrativa serve para provar que a credencial vale.
  const { users } = await getAuth().listUsers(1);
  console.log("✓ Conta de serviço autenticada");
  console.log(
    users.length
      ? `✓ Authentication ativo (${users.length} usuário encontrado)`
      : "✓ Authentication ativo (nenhum usuário ainda — esperado)",
  );

  if (doApp.length) {
    console.log(
      `\n⚠ Conta de serviço OK, mas falta a configuração do app web:\n   ${doApp.join("\n   ")}`,
    );
    console.log(
      "\n  Console do Firebase → Configurações do projeto → Geral → Seus apps",
    );
    console.log("  → Configuração do SDK → copie o campo apiKey.\n");
    process.exit(1);
  }

  /*
   * Verificação de token de ponta a ponta.
   *
   * Existe porque a checagem de credenciais acima não toca o caminho que
   * realmente quebrou em produção: verificar um token passa pelo `jwks-rsa`,
   * que carrega o `jose`. Quando o `jose` virou ESM puro, esse caminho parou
   * de funcionar em runtimes sem require() de ESM — e nada aqui denunciava,
   * porque `listUsers` não usa `jwks-rsa`.
   */
  console.log("\nVerificação de token (o caminho que usa jwks-rsa → jose)");

  const email = `verificacao.token.${Date.now()}@inteligencia-evangelizadora.test`;
  const senha = `Verificacao#${Date.now()}`;
  const conta = await getAuth().createUser({ email, password: senha });

  try {
    const entrada = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
      },
    );
    const { idToken } = (await entrada.json()) as { idToken?: string };
    if (!idToken) throw new Error("não foi possível autenticar o usuário de teste");
    console.log("  ✓ autenticação por e-mail e senha");

    const decodificado = await getAuth().verifyIdToken(idToken, true);
    console.log(
      `  ✓ verificação do token de identidade${decodificado.uid === conta.uid ? "" : " (uid divergente!)"}`,
    );

    const cookie = await getAuth().createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 1000,
    });
    console.log("  ✓ criação do cookie de sessão");

    const sessao = await getAuth().verifySessionCookie(cookie);
    if (sessao.uid !== conta.uid) throw new Error("uid do cookie não confere");
    console.log("  ✓ verificação do cookie de sessão");
  } finally {
    await getAuth().deleteUser(conta.uid).catch(() => undefined);
  }

  console.log("\n✓ Firebase configurado corretamente.\n");
}

principal().catch((erro) => {
  const codigo = erro?.errorInfo?.code ?? erro?.code ?? "";
  console.error("\n✗ Falhou:", erro?.errorInfo?.message ?? erro?.message ?? erro);

  if (String(codigo).includes("invalid-credential") || String(erro?.message).includes("DECODER")) {
    console.error("  → A chave privada está incompleta ou com as quebras de linha erradas.");
  } else if (String(codigo).includes("project-not-found")) {
    console.error("  → FIREBASE_PROJECT_ID não corresponde a nenhum projeto.");
  } else if (String(erro?.message).includes("insufficient")) {
    console.error("  → Ative Authentication no console antes de testar.");
  }

  process.exit(1);
});
