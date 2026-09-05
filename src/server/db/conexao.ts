import type { PoolConfig } from "pg";

/** Aplicado no início de cada transação, para o SQL que não qualifica o schema. */
export const DEFINIR_SEARCH_PATH =
  "select set_config('search_path', 'ie,public', true)";

/**
 * Configuração de conexão, num lugar só.
 *
 * Dois detalhes que custaram um erro em produção e ficam registrados aqui:
 *
 * 1. Nada de `options: '-c search_path=...'`. O pooler do Neon rejeita
 *    parâmetros de inicialização e derruba a conexão com
 *    "unsupported startup parameter in options". O schema é definido por
 *    transação, via `DEFINIR_SEARCH_PATH` — o que também é mais correto com
 *    pooling em modo transação, onde a conexão é compartilhada.
 *
 * 2. `sslmode` e `channel_binding` na string de conexão disparam aviso de
 *    depreciação no driver. Removidos daqui e a política de TLS declarada
 *    explicitamente.
 */
export function configuracaoDeConexao(url: string | undefined): PoolConfig {
  if (!url) {
    throw new Error(
      "DATABASE_URL ausente. Preencha em .env.local antes de rodar este comando.",
    );
  }

  const endereco = new URL(url);
  endereco.searchParams.delete("sslmode");
  endereco.searchParams.delete("channel_binding");

  const local =
    endereco.hostname === "localhost" || endereco.hostname === "127.0.0.1";

  // O Neon apresenta certificado de autoridade pública; o Render usa um
  // autoassinado, que a verificação estrita recusaria. Banco local não fala
  // TLS — insistir nele só produz um erro de handshake confuso.
  const verificarCertificado = endereco.hostname.endsWith(".neon.tech");

  return {
    connectionString: endereco.toString(),
    ssl: local ? false : { rejectUnauthorized: verificarCertificado },
  };
}

/**
 * URL da aplicação: papel `ie_app`, sem BYPASSRLS, sujeito às políticas.
 * É a que o sistema usa para atender requisições — e a que os testes de
 * isolamento devem usar, sob pena de testarem outra coisa.
 */
export function urlDaAplicacao() {
  return process.env.DATABASE_URL;
}

/**
 * URL do dono do schema. Necessária apenas para criar e alterar estrutura.
 * Ela ignora o RLS, então nunca deve atender requisição de usuário.
 */
export function urlAdministrativa() {
  return process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
}
