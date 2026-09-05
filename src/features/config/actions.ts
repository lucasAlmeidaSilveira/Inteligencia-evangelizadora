"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { comUsuario, falha, sucesso, traduzirErroDeBanco } from "@/server/dados";
import {
  categoriasFinanceiras,
  missoes,
  tiposEvento,
  usuarios,
} from "@/server/db/schema";
import { adminAuth } from "@/server/firebase/admin";

import { categoriaSchema, tipoEventoSchema, usuarioSchema } from "./schemas";

const APENAS_ADMIN = "Apenas o administrador geral pode fazer isso.";

function revalidar() {
  revalidatePath("/config", "layout");
  revalidatePath("/eventos", "layout");
  revalidatePath("/calendario");
  revalidatePath("/");
}

function camposComErro(erro: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const caminho = problema.path.map(String).join(".");
    if (caminho && !campos[caminho]) campos[caminho] = problema.message;
  }
  return campos;
}

/** Toda ação daqui é privativa do admin. O RLS já barra, mas a mensagem aqui
 *  é legível — e a checagem evita uma ida ao banco para falhar. */
function exigirAdmin(ehAdmin: boolean) {
  if (!ehAdmin) throw new Error(APENAS_ADMIN);
}

function tratar(erro: unknown) {
  if (erro instanceof Error && erro.message.startsWith("Apenas o admin")) {
    return falha(erro.message);
  }
  if (
    erro instanceof Error &&
    erro.message.startsWith("Apenas o administrador master")
  ) {
    return falha(erro.message);
  }
  if (erro instanceof Error && erro.message === APENAS_ADMIN) {
    return falha(APENAS_ADMIN);
  }
  return falha(traduzirErroDeBanco(erro));
}

/* ═════════════════════════ Tipos de ação ══════════════════════════════════ */

export async function salvarTipoEvento(id: string | null, entrada: unknown) {
  const validado = tipoEventoSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    await comUsuario(async (tx, usuario) => {
      exigirAdmin(usuario.ehAdmin);
      if (id) {
        await tx.update(tiposEvento).set(validado.data).where(eq(tiposEvento.id, id));
      } else {
        await tx.insert(tiposEvento).values(validado.data);
      }
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    return tratar(erro);
  }
}

export async function excluirTipoEvento(id: string) {
  try {
    await comUsuario(async (tx, usuario) => {
      exigirAdmin(usuario.ehAdmin);
      await tx.delete(tiposEvento).where(eq(tiposEvento.id, id));
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    // O banco recusa apagar tipo em uso (`on delete restrict`) — de propósito:
    // apagar levaria junto o histórico de eventos que o referenciam.
    return tratar(erro);
  }
}

/* ══════════════════════ Categorias financeiras ════════════════════════════ */

export async function salvarCategoria(id: string | null, entrada: unknown) {
  const validado = categoriaSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    await comUsuario(async (tx, usuario) => {
      exigirAdmin(usuario.ehAdmin);
      if (id) {
        await tx
          .update(categoriasFinanceiras)
          .set(validado.data)
          .where(eq(categoriasFinanceiras.id, id));
      } else {
        await tx.insert(categoriasFinanceiras).values(validado.data);
      }
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    return tratar(erro);
  }
}

export async function excluirCategoria(id: string) {
  try {
    await comUsuario(async (tx, usuario) => {
      exigirAdmin(usuario.ehAdmin);
      // Lançamentos que a usavam ficam sem categoria, não desaparecem.
      await tx
        .delete(categoriasFinanceiras)
        .where(eq(categoriasFinanceiras.id, id));
    });

    revalidar();
    return sucesso();
  } catch (erro) {
    return tratar(erro);
  }
}

/* ═════════════════════════════ Usuários ═══════════════════════════════════ */

const SO_QUEM_CONVIDA =
  "Apenas o administrador master ou o responsável pela missão podem fazer isso.";

/**
 * Normaliza o que será gravado conforme quem está pedindo.
 *
 * O papel e a missão vindos do formulário só valem para o admin master. Para o
 * responsável, os dois são impostos aqui: auxiliar, na missão dele. Confiar no
 * que o cliente enviou permitiria a um responsável forjar uma requisição e
 * criar outro administrador — o RLS barraria, mas com erro de banco em vez de
 * uma regra explícita.
 */
function normalizar(
  dados: {
    nome: string;
    email: string;
    papel: "admin" | "responsavel" | "auxiliar";
    missaoId: string | null;
    ativo: boolean;
  },
  quemPede: { ehAdmin: boolean; ehResponsavel: boolean; missaoId: string | null },
) {
  if (quemPede.ehAdmin) return dados;

  if (!quemPede.ehResponsavel || !quemPede.missaoId) {
    throw new Error(SO_QUEM_CONVIDA);
  }

  return {
    ...dados,
    papel: "auxiliar" as const,
    missaoId: quemPede.missaoId,
  };
}

/**
 * Cria o acesso de alguém.
 *
 * A conta nasce sem senha: o retorno é um link para a própria pessoa definir a
 * dela. É mais seguro que gerar uma senha provisória e mandá-la por mensagem —
 * a senha nunca passa por ninguém além de quem vai usá-la.
 */
export async function convidarUsuario(entrada: unknown) {
  const validado = usuarioSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const auth = adminAuth();

    // Pode já existir no Firebase sem estar liberado aqui — nesse caso é só
    // vincular, não criar de novo.
    const conta = await auth
      .getUserByEmail(validado.data.email)
      .catch(() =>
        auth.createUser({
          email: validado.data.email,
          displayName: validado.data.nome,
        }),
      );

    await comUsuario(async (tx, usuario) => {
      if (!usuario.podeConvidar) throw new Error(SO_QUEM_CONVIDA);

      const dados = normalizar(validado.data, usuario);

      await tx
        .insert(usuarios)
        .values({ firebaseUid: conta.uid, ...dados })
        .onConflictDoUpdate({
          target: usuarios.firebaseUid,
          set: dados,
        });
    });

    const link = await auth.generatePasswordResetLink(validado.data.email);

    revalidar();
    return sucesso({ link, email: validado.data.email });
  } catch (erro) {
    return tratar(erro);
  }
}

export async function atualizarUsuario(id: string, entrada: unknown) {
  const validado = usuarioSchema.safeParse(entrada);
  if (!validado.success) {
    return falha("Confira os campos destacados.", camposComErro(validado.error));
  }

  try {
    const resultado = await comUsuario(async (tx, usuario) => {
      if (!usuario.podeConvidar) throw new Error(SO_QUEM_CONVIDA);

      // Trancar-se para fora é irreversível pela interface: sem nenhum admin
      // ativo, ninguém consegue devolver acesso a ninguém.
      if (
        id === usuario.id &&
        (validado.data.papel !== usuario.papel || !validado.data.ativo)
      ) {
        return "propria-conta" as const;
      }

      const dados = normalizar(validado.data, usuario);

      const [atualizado] = await tx
        .update(usuarios)
        .set(dados)
        .where(eq(usuarios.id, id))
        .returning({ id: usuarios.id });

      return atualizado ? ("ok" as const) : ("ausente" as const);
    });

    if (resultado === "propria-conta") {
      return falha(
        "Você não pode alterar o próprio papel nem remover o próprio acesso. Peça a outro administrador.",
      );
    }
    if (resultado === "ausente") return falha("Usuário não encontrado.");

    revalidar();
    return sucesso();
  } catch (erro) {
    return tratar(erro);
  }
}

/** Novo link de definição de senha, para quem perdeu ou nunca recebeu o dele. */
export async function gerarLinkDeSenha(usuarioId: string) {
  try {
    const email = await comUsuario(async (tx, usuario) => {
      if (!usuario.podeConvidar) throw new Error(SO_QUEM_CONVIDA);

      // O RLS já limita o que o responsável alcança: se a pessoa é de outra
      // missão, esta consulta simplesmente não a encontra.
      const [alvo] = await tx
        .select({ email: usuarios.email })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId))
        .limit(1);

      return alvo?.email ?? null;
    });

    if (!email) return falha("Usuário não encontrado.");

    const link = await adminAuth().generatePasswordResetLink(email);
    return sucesso({ link, email });
  } catch (erro) {
    return tratar(erro);
  }
}

/** Missões disponíveis para vincular — só o admin master escolhe. */
export async function missoesParaVincular() {
  return comUsuario(async (tx, usuario) => {
    exigirAdmin(usuario.ehAdmin);
    return tx
      .select({ id: missoes.id, nome: missoes.nome })
      .from(missoes)
      .orderBy(missoes.nome);
  });
}
