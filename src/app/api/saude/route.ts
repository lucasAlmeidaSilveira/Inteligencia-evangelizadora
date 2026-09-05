import { NextResponse } from "next/server";

/**
 * Diagnóstico de implantação.
 *
 *   GET /api/saude
 *
 * Existe para responder "por que não consigo entrar em produção?" sem depender
 * de logs. Devolve apenas situações — presente/ausente, alcançável/não —, nunca
 * valores, hostnames ou credenciais. Pode ser apagado depois de resolvido.
 */
type Verificacao = {
  nome: string;
  ok: boolean;
  detalhe?: string;
};

/** Sem estas, ninguém entra. */
const ESSENCIAIS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

/** Sem estas, só o anexo de documentos deixa de funcionar. */
const DOCUMENTOS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export async function GET() {
  const verificacoes: Verificacao[] = [];

  // ─── Variáveis de ambiente ────────────────────────────────────────────────
  const faltamEssenciais = ESSENCIAIS.filter((nome) => !process.env[nome]);
  verificacoes.push({
    nome: "Variáveis essenciais",
    ok: faltamEssenciais.length === 0,
    detalhe:
      faltamEssenciais.length === 0
        ? `todas as ${ESSENCIAIS.length} presentes`
        : `faltando: ${faltamEssenciais.join(", ")}`,
  });

  const faltamDocumentos = DOCUMENTOS.filter((nome) => !process.env[nome]);
  verificacoes.push({
    nome: "Variáveis do armazenamento de documentos",
    ok: faltamDocumentos.length === 0,
    detalhe:
      faltamDocumentos.length === 0
        ? "todas presentes"
        : `faltando: ${faltamDocumentos.join(", ")} — o resto do sistema funciona, só o anexo de arquivos fica indisponível`,
  });

  const chave = process.env.FIREBASE_PRIVATE_KEY ?? "";
  if (chave) {
    verificacoes.push({
      nome: "Formato da chave privada do Firebase",
      ok: chave.includes("BEGIN PRIVATE KEY"),
      detalhe: chave.includes("BEGIN PRIVATE KEY")
        ? "parece uma chave PEM"
        : "não contém BEGIN PRIVATE KEY — cole o campo private_key inteiro do JSON",
    });
  }

  // ─── Banco ────────────────────────────────────────────────────────────────
  try {
    const { pool } = await import("@/server/db/index");
    const { DEFINIR_SEARCH_PATH } = await import("@/server/db/conexao");

    const cliente = await pool.connect();
    try {
      await cliente.query(DEFINIR_SEARCH_PATH);

      const { rows: papel } = await cliente.query<{
        usuario: string;
        rolbypassrls: boolean;
        rolsuper: boolean;
      }>(`select current_user as usuario, rolbypassrls, rolsuper
            from pg_roles where rolname = current_user`);

      verificacoes.push({ nome: "Conexão com o banco", ok: true });

      const ignoraRls = papel[0].rolbypassrls || papel[0].rolsuper;
      verificacoes.push({
        nome: "Papel do banco sujeito ao RLS",
        ok: !ignoraRls,
        detalhe: ignoraRls
          ? `conectando como "${papel[0].usuario}", que IGNORA as políticas — ` +
            "o isolamento entre missões está desligado. Use a DATABASE_URL " +
            "gerada por `pnpm db:criar-papel`."
          : `conectando como "${papel[0].usuario}"`,
      });

      const { rows: tabelas } = await cliente.query<{ total: number }>(
        "select count(*)::int as total from information_schema.tables where table_schema = 'ie'",
      );
      verificacoes.push({
        nome: "Schema aplicado",
        ok: tabelas[0].total >= 11,
        detalhe: `${tabelas[0].total} tabelas no schema ie`,
      });

      /* A contagem precisa de escopo: `usuarios` tem RLS, e sem escopo a
         consulta devolve zero — o que pareceria "nenhum admin" mesmo havendo.
         Transação isolada, só para contar; nada é lido além do número. */
      await cliente.query("begin");
      await cliente.query("select set_config('app.papel', 'admin', true)");
      const { rows: admins } = await cliente.query<{ total: number }>(
        "select count(*)::int as total from ie.usuarios where papel = 'admin' and ativo",
      );
      await cliente.query("rollback");
      verificacoes.push({
        nome: "Administrador cadastrado",
        ok: admins[0].total > 0,
        detalhe:
          admins[0].total > 0
            ? `${admins[0].total} ativo(s)`
            : "nenhum — rode `pnpm admin:criar` apontando para este banco",
      });
    } finally {
      cliente.release();
    }
  } catch (erro) {
    verificacoes.push({
      nome: "Conexão com o banco",
      ok: false,
      detalhe: (erro as Error)?.message?.slice(0, 160) ?? "falhou",
    });
  }

  // ─── Firebase Admin ───────────────────────────────────────────────────────
  try {
    const { adminAuth } = await import("@/server/firebase/admin");
    await adminAuth().listUsers(1);
    verificacoes.push({ nome: "Credenciais do Firebase Admin", ok: true });
  } catch (erro) {
    verificacoes.push({
      nome: "Credenciais do Firebase Admin",
      ok: false,
      detalhe: (erro as Error)?.message?.slice(0, 160) ?? "falhou",
    });
  }

  // O armazenamento de documentos não impede o acesso; separá-lo evita um
  // alarme vermelho por algo que não trava ninguém.
  const opcional = "Variáveis do armazenamento de documentos";
  const bloqueia = verificacoes.filter((v) => !v.ok && v.nome !== opcional);

  return NextResponse.json(
    {
      situacao:
        bloqueia.length === 0
          ? verificacoes.every((v) => v.ok)
            ? "tudo certo"
            : "funciona, com pendência não crítica"
          : "há problemas que impedem o acesso",
      verificacoes,
    },
    {
      status: bloqueia.length === 0 ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
