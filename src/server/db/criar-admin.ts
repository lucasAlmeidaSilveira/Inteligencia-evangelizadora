import { config } from "dotenv";

config({ path: ".env.local" });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlAdministrativa,
} from "./conexao";

import { usuarios } from "./schema";

/**
 * Cria o primeiro administrador — o problema do ovo e da galinha: sem um admin
 * não há quem cadastre usuários pela interface.
 *
 *   pnpm admin:criar email@exemplo.com "Nome Completo"
 *
 * Não define senha. Ao final imprime um link de definição de senha, que é
 * mais seguro do que gerar uma senha provisória e mandá-la por mensagem.
 */
async function principal() {
  const [email, nome] = process.argv.slice(2);

  if (!email || !nome) {
    console.error('Uso: pnpm admin:criar <email> "<Nome Completo>"');
    process.exit(1);
  }

  const chavePrivada = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!chavePrivada) throw new Error("FIREBASE_PRIVATE_KEY ausente");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: chavePrivada,
      }),
    });
  }

  const auth = getAuth();

  const usuarioFirebase = await auth
    .getUserByEmail(email)
    .catch(() => auth.createUser({ email, displayName: nome }));

  const pool = new Pool({
    ...configuracaoDeConexao(urlAdministrativa()),
    max: 1,
  });

  try {
    await drizzle(pool).transaction(async (tx) => {
      await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
      await tx.execute(sql`select set_config('app.eh_admin', 'on', true)`);
      await tx
        .insert(usuarios)
        .values({
          firebaseUid: usuarioFirebase.uid,
          nome,
          email,
          papel: "admin",
        })
        .onConflictDoUpdate({
          target: usuarios.firebaseUid,
          set: { papel: "admin", nome, ativo: true },
        });
    });

    const link = await auth.generatePasswordResetLink(email);

    console.log(`\n✓ Administrador pronto: ${nome} <${email}>`);
    console.log("\nEnvie este link para que a pessoa defina a senha:\n");
    console.log(link);
    console.log("");
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha:", erro);
  process.exit(1);
});
