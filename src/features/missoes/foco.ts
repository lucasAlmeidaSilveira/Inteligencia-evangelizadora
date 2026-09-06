import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { missoesDisponiveis } from "@/features/eventos/queries";
import { requerUsuario } from "@/server/auth/sessao";

export const COOKIE_FOCO = "ie_missao_foco";

/** Um ano: o foco é contexto de trabalho, não sessão. Expirar antes só faria
 *  o painel mudar sozinho entre uma visita e outra. */
export const DURACAO_FOCO_S = 60 * 60 * 24 * 365;

export type Foco = {
  /** Missão escolhida. `undefined` significa "todas". */
  missaoId?: string;
  missaoNome?: string;
  /** Missões oferecidas no seletor. Vazio para quem não escolhe. */
  opcoes: { id: string; nome: string }[];
};

/**
 * Missão em foco — o recorte de leitura que o administrador master escolhe na
 * barra lateral e leva consigo por painel, calendário, ações e relatórios.
 *
 * Mora em cookie, não na URL. Os filtros de listagem ficam na query string
 * justamente para serem compartilháveis, mas um recorte que atravessa quatro
 * telas exigiria carregá-lo em cada `<Link>` do menu — inclusive nos que ainda
 * não existem. Aqui o preço do link não compartilhável compra o menu intacto.
 *
 * Só o admin tem foco: responsável e auxiliar já estão presos à própria missão
 * pelo RLS, e ler o cookie para eles abriria caminho para a tela dizer uma
 * coisa e o banco devolver outra.
 *
 * O foco nunca amplia acesso — a validação contra `opcoes` é o que garante
 * isso, e de quebra faz o cookie que aponta para missão apagada ou desativada
 * voltar sozinho para "todas", sem erro em tela alguma.
 */
export const focoAtual = cache(async (): Promise<Foco> => {
  const usuario = await requerUsuario();
  if (!usuario.ehAdmin) return { opcoes: [] };

  const [opcoes, jar] = await Promise.all([missoesDisponiveis(), cookies()]);
  const escolhida = opcoes.find((m) => m.id === jar.get(COOKIE_FOCO)?.value);

  return {
    missaoId: escolhida?.id,
    missaoNome: escolhida?.nome,
    opcoes,
  };
});
