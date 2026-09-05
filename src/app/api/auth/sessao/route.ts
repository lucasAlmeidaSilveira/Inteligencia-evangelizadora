import { NextResponse } from "next/server";
import { z } from "zod";

import { criarSessao, encerrarSessao } from "@/server/auth/sessao";

const corpo = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  const dados = corpo.safeParse(await request.json().catch(() => null));

  if (!dados.success) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  try {
    const usuario = await criarSessao(dados.data.idToken);
    return NextResponse.json({ usuario });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Não foi possível entrar.";
    return NextResponse.json({ erro: mensagem }, { status: 401 });
  }
}

export async function DELETE() {
  await encerrarSessao();
  return NextResponse.json({ ok: true });
}
