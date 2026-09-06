import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Alterna a qual banco o `.env.local` aponta.
 *
 *   pnpm ambiente             mostra o ambiente atual
 *   pnpm ambiente demo        aponta para o banco local de demonstração
 *   pnpm ambiente producao    volta para o banco real
 *
 * As credenciais do outro ambiente não são descartadas: ficam guardadas em
 * linhas comentadas no próprio `.env.local`. Trocar de ambiente perdendo a
 * string de conexão do Neon seria fácil de fazer e chato de desfazer.
 */
const CAMINHO = resolve(".env.local");

const DEMO = {
  DATABASE_URL: "postgresql://ie_app:demo@localhost:5433/ie_demo",
  DATABASE_URL_ADMIN: "postgresql://postgres:demo@localhost:5433/ie_demo",
};

const CHAVES = ["DATABASE_URL", "DATABASE_URL_ADMIN"] as const;
const GUARDADO = (chave: string) => `#GUARDADO_${chave}`;

function ler() {
  return readFileSync(CAMINHO, "utf8");
}

function valor(env: string, chave: string) {
  const linha = env
    .split("\n")
    .find((l) => l.trim().startsWith(`${chave}=`));
  return linha ? linha.slice(linha.indexOf("=") + 1).trim() : null;
}

function definir(env: string, chave: string, novo: string) {
  const padrao = new RegExp(`^${chave.replace("#", "\\#")}=.*$`, "m");
  return padrao.test(env)
    ? env.replace(padrao, () => `${chave}=${novo}`)
    : `${env.trimEnd()}\n${chave}=${novo}\n`;
}

function ehLocal(url: string | null) {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function descrever(url: string | null) {
  if (!url) return "não configurado";
  try {
    const { hostname, username } = new URL(url);
    return `${username}@${hostname}`;
  } catch {
    return "malformado";
  }
}

function situacao() {
  const env = ler();
  const atual = valor(env, "DATABASE_URL");
  const local = ehLocal(atual);

  console.log(`\nAmbiente atual: ${local ? "DEMONSTRAÇÃO (local)" : "PRODUÇÃO"}`);
  for (const chave of CHAVES) {
    console.log(`  ${chave.padEnd(20)} ${descrever(valor(env, chave))}`);
  }

  const guardado = valor(env, GUARDADO("DATABASE_URL"));
  if (guardado) {
    console.log(
      `\n  guardado para voltar: ${descrever(guardado)}`,
    );
  }
  console.log(
    `\nPara trocar:  pnpm ambiente ${local ? "producao" : "demo"}\n`,
  );
}

function trocar(destino: "demo" | "producao") {
  let env = ler();
  const atual = valor(env, "DATABASE_URL");
  const jaEstaLa =
    destino === "demo" ? ehLocal(atual) : atual !== null && !ehLocal(atual);

  if (jaEstaLa) {
    console.log(`\nJá está apontando para ${destino}. Nada a fazer.\n`);
    return;
  }

  if (destino === "demo") {
    // Guarda o que está lá antes de sobrescrever.
    for (const chave of CHAVES) {
      const valorAtual = valor(env, chave);
      if (valorAtual) env = definir(env, GUARDADO(chave), valorAtual);
    }
    for (const chave of CHAVES) env = definir(env, chave, DEMO[chave]);
  } else {
    for (const chave of CHAVES) {
      const guardado = valor(env, GUARDADO(chave));
      if (!guardado) {
        console.error(
          `\n✗ Não há credencial de produção guardada para ${chave}.\n` +
            "  Cole a string de conexão do Neon manualmente em .env.local.\n",
        );
        process.exit(1);
      }
      env = definir(env, chave, guardado);
    }
  }

  writeFileSync(CAMINHO, env);
  console.log(
    `\n✓ .env.local agora aponta para ${destino === "demo" ? "a DEMONSTRAÇÃO local" : "a PRODUÇÃO"}.`,
  );
  console.log("  Reinicie o servidor: pnpm dev\n");
}

const acao = process.argv[2];

if (!acao) situacao();
else if (acao === "demo" || acao === "producao") trocar(acao);
else {
  console.error("uso: pnpm ambiente [demo|producao]");
  process.exit(1);
}
