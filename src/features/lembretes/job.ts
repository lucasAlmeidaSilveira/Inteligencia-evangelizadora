import { and, eq, inArray, sql } from "drizzle-orm";

import type { Transacao } from "@/server/db/index";
import {
  grupoContagens,
  gruposOracao,
  lembretesContagem,
  missoes,
  notificacoes,
  usuarios,
} from "@/server/db/schema";
import type { EnviarEmail } from "@/server/email";

import {
  emailDoLembrete,
  mensagemDaNotificacao,
  tituloDaNotificacao,
  urlDaNotificacao,
  type GrupoNoLembrete,
} from "./mensagens";
import { contagemVencida, lembreteRecente } from "./regras";

/**
 * A rotina do lembrete bimestral.
 *
 * Recebe a transação em vez de abri-la: quem chama decide o escopo. Em
 * produção é `comSistema()`, pela rota `/api/lembretes/contagem`; no teste é
 * uma transação revertida sobre o banco local. Por isso este arquivo não tem
 * `server-only` — o `tsx` do teste não conseguiria importá-lo.
 *
 * Roda todo dia e decide sozinha quem está no prazo. É isso que a torna
 * indiferente ao agendador: atraso, falha ou execução dobrada não duplicam
 * aviso nem pulam bimestre, porque a decisão olha para o histórico de
 * contagens e de lembretes, não para o calendário da execução.
 */

export type Destinatario = {
  usuarioId: string;
  nome: string;
  email: string;
  missaoId: string;
};

export type Envio = {
  destinatario: Destinatario;
  grupos: GrupoNoLembrete[];
};

export type Plano = {
  /** Grupos ativos cuja contagem venceu e que ainda não foram avisados neste bimestre. */
  vencidos: GrupoNoLembrete[];
  /** Um por pessoa, com todos os grupos vencidos da missão dela. */
  envios: Envio[];
  /** Missões com grupo vencido mas sem ninguém ativo para receber o aviso. */
  semDestinatario: { missaoId: string; missaoNome: string; grupos: string[] }[];
};

export type Relatorio = {
  executadoEm: string;
  simulado: boolean;
  gruposVencidos: number;
  destinatarios: number;
  notificacoesCriadas: number;
  emailsEnviados: number;
  /** `null` quando o e-mail não está configurado — a rotina seguiu só com a notificação. */
  emailConfigurado: boolean;
  semDestinatario: Plano["semDestinatario"];
  erros: string[];
  envios: {
    para: string;
    missao: string;
    grupos: string[];
    canais: ("interno" | "email")[];
  }[];
};

const emIso = (valor: unknown) =>
  valor === null || valor === undefined
    ? null
    : valor instanceof Date
      ? valor.toISOString()
      : new Date(valor as string).toISOString();

export async function planejarLembretes(
  tx: Transacao,
  agora: Date = new Date(),
): Promise<Plano> {
  /* Só grupos ativos de missões ativas: grupo inativo saiu das contagens, e
     missão arquivada não tem quem responda. As duas datas vêm por subconsulta
     com as referências interpoladas — nunca nome de tabela solto dentro de
     `sql`, pela razão documentada em `agregadosPorMissao`. */
  const linhas = await tx
    .select({
      grupoId: gruposOracao.id,
      grupoNome: gruposOracao.nome,
      missaoId: gruposOracao.missaoId,
      missaoNome: missoes.nome,
      ultimaContagemEm: sql<string | null>`(
        select max(${grupoContagens.registradoEm})
          from ${grupoContagens}
         where ${grupoContagens.grupoId} = ${gruposOracao.id}
      )`.mapWith(emIso),
      ultimoLembreteEm: sql<string | null>`(
        select max(${lembretesContagem.enviadoEm})
          from ${lembretesContagem}
         where ${lembretesContagem.grupoId} = ${gruposOracao.id}
      )`.mapWith(emIso),
    })
    .from(gruposOracao)
    .innerJoin(missoes, eq(missoes.id, gruposOracao.missaoId))
    .where(and(eq(gruposOracao.ativo, true), eq(missoes.ativo, true)))
    .orderBy(missoes.nome, gruposOracao.nome);

  // A regra fica em `regras.ts`, não no SQL: é a mesma função que a tela usa
  // para marcar o grupo como pendente, e o teste a cobre direto.
  const vencidos: GrupoNoLembrete[] = linhas
    .filter(
      (g) =>
        contagemVencida(g.ultimaContagemEm, agora) &&
        !lembreteRecente(g.ultimoLembreteEm, agora),
    )
    .map(({ grupoId, grupoNome, missaoId, missaoNome, ultimaContagemEm }) => ({
      grupoId,
      grupoNome,
      missaoId,
      missaoNome,
      ultimaContagemEm,
    }));

  if (vencidos.length === 0) {
    return { vencidos, envios: [], semDestinatario: [] };
  }

  const missoesAfetadas = [...new Set(vencidos.map((g) => g.missaoId))];

  /* Quem registra grupos recebe o aviso: o responsável e os auxiliares da
     missão. O admin master fica de fora — ele acompanha todas e seria
     soterrado por lembretes de contagens que não são dele para fazer. */
  const pessoas = await tx
    .select({
      usuarioId: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      missaoId: usuarios.missaoId,
    })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.ativo, true),
        inArray(usuarios.papel, ["responsavel", "auxiliar"]),
        inArray(usuarios.missaoId, missoesAfetadas),
      ),
    )
    .orderBy(usuarios.nome);

  const envios: Envio[] = pessoas.flatMap((pessoa) => {
    if (!pessoa.missaoId) return [];
    const grupos = vencidos.filter((g) => g.missaoId === pessoa.missaoId);
    return grupos.length > 0
      ? [{ destinatario: { ...pessoa, missaoId: pessoa.missaoId }, grupos }]
      : [];
  });

  const comAlguem = new Set(pessoas.map((p) => p.missaoId));
  const semDestinatario = missoesAfetadas
    .filter((id) => !comAlguem.has(id))
    .map((id) => {
      const grupos = vencidos.filter((g) => g.missaoId === id);
      return {
        missaoId: id,
        missaoNome: grupos[0].missaoNome,
        grupos: grupos.map((g) => g.grupoNome),
      };
    });

  return { vencidos, envios, semDestinatario };
}

export async function executarLembretes(
  tx: Transacao,
  opcoes: {
    agora?: Date;
    /** Endereço público da aplicação, para os links do e-mail. */
    baseUrl: string;
    /** `null` = e-mail não configurado; só a notificação interna sai. */
    enviarEmail: EnviarEmail | null;
    /** Planeja e relata, sem gravar nem enviar nada. */
    simular?: boolean;
  },
): Promise<Relatorio> {
  const agora = opcoes.agora ?? new Date();
  const simular = opcoes.simular ?? false;
  const plano = await planejarLembretes(tx, agora);

  const relatorio: Relatorio = {
    executadoEm: agora.toISOString(),
    simulado: simular,
    gruposVencidos: plano.vencidos.length,
    destinatarios: plano.envios.length,
    notificacoesCriadas: 0,
    emailsEnviados: 0,
    emailConfigurado: opcoes.enviarEmail !== null,
    semDestinatario: plano.semDestinatario,
    erros: [],
    envios: [],
  };

  for (const { destinatario, grupos } of plano.envios) {
    const canais: ("interno" | "email")[] = [];

    if (!simular) {
      await tx.insert(notificacoes).values({
        usuarioId: destinatario.usuarioId,
        titulo: tituloDaNotificacao(grupos),
        mensagem: mensagemDaNotificacao(grupos),
        url: urlDaNotificacao(grupos),
      });
      await registrarEnvio(tx, destinatario.usuarioId, grupos, "interno", agora);
      relatorio.notificacoesCriadas++;
    }
    canais.push("interno");

    if (opcoes.enviarEmail) {
      if (simular) {
        canais.push("email");
      } else {
        /* Falha de e-mail não derruba a rodada nem desfaz a notificação: fica
           no relatório, e o lembrete interno já cumpriu o aviso. Sem registrar
           o canal `email`, a próxima rodada não tenta de novo — o bimestre do
           grupo já foi marcado pelo canal interno. */
        try {
          const email = emailDoLembrete({
            nome: destinatario.nome,
            grupos,
            baseUrl: opcoes.baseUrl,
          });
          await opcoes.enviarEmail({ para: destinatario.email, ...email });
          await registrarEnvio(tx, destinatario.usuarioId, grupos, "email", agora);
          relatorio.emailsEnviados++;
          canais.push("email");
        } catch (erro) {
          relatorio.erros.push(
            `E-mail para ${destinatario.email}: ${erro instanceof Error ? erro.message : String(erro)}`,
          );
        }
      }
    }

    relatorio.envios.push({
      para: destinatario.email,
      missao: grupos[0].missaoNome,
      grupos: grupos.map((g) => g.grupoNome),
      canais,
    });
  }

  return relatorio;
}

async function registrarEnvio(
  tx: Transacao,
  usuarioId: string,
  grupos: GrupoNoLembrete[],
  canal: "interno" | "email",
  agora: Date,
) {
  await tx.insert(lembretesContagem).values(
    grupos.map((g) => ({
      grupoId: g.grupoId,
      usuarioId,
      canal,
      enviadoEm: agora,
    })),
  );
}
