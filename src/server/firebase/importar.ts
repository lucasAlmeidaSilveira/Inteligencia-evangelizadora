import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Preenche as credenciais do Firebase a partir do JSON da conta de serviço.
 *
 *   pnpm firebase:importar ~/Downloads/meu-projeto-firebase-adminsdk.json
 *
 * Copiar a chave privada à mão quase sempre dá errado: ela tem quebras de
 * linha, e num arquivo .env elas precisam virar a sequência literal \n.
 * Ler o JSON elimina esse passo.
 */
const CAMINHO_ENV = resolve(".env.local");

function principal() {
  const arquivo = process.argv[2];

  if (!arquivo) {
    console.error("Uso: pnpm firebase:importar <caminho-do-json>");
    console.error(
      "\nO arquivo vem de: console.firebase.google.com → Configurações do projeto",
    );
    console.error("→ Contas de serviço → Gerar nova chave privada");
    process.exit(1);
  }

  let conta: Record<string, string>;
  try {
    conta = JSON.parse(readFileSync(resolve(arquivo.replace(/^~/, process.env.HOME ?? "~")), "utf8"));
  } catch (erro) {
    console.error(`✗ Não consegui ler o JSON: ${(erro as Error).message}`);
    process.exit(1);
  }

  if (conta.type !== "service_account") {
    console.error(
      '✗ Este não é o JSON da conta de serviço (falta "type": "service_account").',
    );
    console.error(
      "  Talvez você tenha baixado a configuração do app web, que é outro arquivo.",
    );
    process.exit(1);
  }

  for (const campo of ["project_id", "client_email", "private_key"]) {
    if (!conta[campo]) {
      console.error(`✗ Campo "${campo}" ausente no JSON.`);
      process.exit(1);
    }
  }

  const valores: Record<string, string> = {
    FIREBASE_PROJECT_ID: conta.project_id,
    FIREBASE_CLIENT_EMAIL: conta.client_email,
    // Quebras de linha reais viram \n literal, que é como o .env as carrega.
    FIREBASE_PRIVATE_KEY: conta.private_key.replace(/\n/g, "\\n"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: conta.project_id,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${conta.project_id}.firebaseapp.com`,
  };

  let env = readFileSync(CAMINHO_ENV, "utf8");

  for (const [chave, valor] of Object.entries(valores)) {
    const linha = `${chave}=${valor}`;
    const padrao = new RegExp(`^${chave}=.*$`, "m");
    env = padrao.test(env) ? env.replace(padrao, () => linha) : `${env}\n${linha}`;
  }

  writeFileSync(CAMINHO_ENV, env);

  console.log(`✓ Projeto:  ${conta.project_id}`);
  console.log(`✓ Conta:    ${conta.client_email}`);
  console.log(`✓ Chave privada gravada (${conta.private_key.length} caracteres)`);
  console.log("\n5 variáveis atualizadas em .env.local.");
  console.log(
    "\nFalta apenas NEXT_PUBLIC_FIREBASE_API_KEY — ela não está neste JSON.",
  );
  console.log("Pegue em: Configurações do projeto → Geral → Seus apps → Configuração do SDK");
  console.log("\nDepois rode: pnpm firebase:testar");
}

principal();
