import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import { executarLembretes, planejarLembretes } from "@/features/lembretes/job";
import {
  emailDoLembrete,
  tituloDaNotificacao,
  urlDaNotificacao,
} from "@/features/lembretes/mensagens";
import {
  contagemVencida,
  lembreteRecente,
  limiteDeContagem,
} from "@/features/lembretes/regras";
import type { Mensagem } from "@/server/email";
import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlDaAplicacao,
} from "@/server/db/conexao";
import * as schema from "@/server/db/schema";

/**
 * Exercita a rotina do lembrete bimestral contra um cenário montado à mão.
 *
 *   pnpm testar:lembretes
 *
 * Aponte o `.env.local` para um banco local (`pnpm ambiente demo`) — o teste
 * grava dentro de uma transação e a reverte no fim, mas não há motivo para
 * rodá-lo em produção.
 *
 * O banco pode ter outros dados (a demonstração, por exemplo): as verificações
 * olham só para o que o cenário criou — missões e pessoas `@teste.local`.
 *
 * O que precisa ser verdade:
 *  - grupo com contagem de três meses recebe lembrete; grupo contado há dias, não;
 *  - grupo inativo e grupo de missão arquivada ficam de fora;
 *  - uma notificação por pessoa, listando todos os grupos vencidos da missão;
 *  - o e-mail sai com um link por grupo, apontando para o diálogo de contagem;
 *  - rodar de novo no mesmo dia não envia nada (o lembrete fica registrado);
 *  - registrar a contagem tira o grupo da lista;
 *  - a simulação não grava nada.
 */
let falhas = 0;

function ok(descricao: string, condicao: boolean, detalhe?: string) {
  console.log(`${condicao ? "  ✓" : "  ✗"} ${descricao}`);
  if (!condicao) {
    if (detalhe) console.log(`      ${detalhe}`);
    falhas++;
  }
}

function igual(descricao: string, obtido: unknown, esperado: unknown) {
  ok(
    descricao,
    JSON.stringify(obtido) === JSON.stringify(esperado),
    `esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`,
  );
}

const DIA = 24 * 60 * 60 * 1000;

// ─── Regras puras ──────────────────────────────────────────────────────────
console.log("\nRegras");
{
  const agora = new Date("2026-10-24T12:00:00Z");
  igual(
    "o limite é exatamente dois meses antes",
    limiteDeContagem(agora).toISOString(),
    "2026-08-24T12:00:00.000Z",
  );
  ok("contagem de 61 dias está vencida", contagemVencida(new Date(agora.getTime() - 61 * DIA), agora));
  ok("contagem de 59 dias não está vencida", !contagemVencida(new Date(agora.getTime() - 59 * DIA), agora));
  ok("grupo sem contagem alguma conta como vencido", contagemVencida(null, agora));
  ok("lembrete de 10 dias é recente", lembreteRecente(new Date(agora.getTime() - 10 * DIA), agora));
  ok("lembrete de 70 dias não é mais recente", !lembreteRecente(new Date(agora.getTime() - 70 * DIA), agora));
  ok("sem lembrete não há lembrete recente", !lembreteRecente(null, agora));
}

async function principal() {
  const pool = new Pool({ ...configuracaoDeConexao(urlDaAplicacao()), max: 1 });
  const db = drizzle(pool, { schema });

  try {
    await db
      .transaction(async (tx) => {
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
        await tx.execute(
          sql`select set_config('app.papel', 'admin', true),
                     set_config('app.usuario_id', '00000000-0000-0000-0000-000000000000', true)`,
        );

        // ─── Cenário ───────────────────────────────────────────────────────
        const id = async (consulta: ReturnType<typeof sql>) =>
          (await tx.execute<{ id: string }>(consulta)).rows[0].id;

        const missao = await id(
          sql`insert into missoes (nome, slug) values ('Lembretes Teste', 'lembretes-teste') returning id`,
        );
        const arquivada = await id(
          sql`insert into missoes (nome, slug, ativo) values ('Arquivada', 'arquivada-teste', false) returning id`,
        );
        const centro = await id(
          sql`insert into centros_evangelizacao (missao_id, nome, principal) values (${missao}, 'Principal', true) returning id`,
        );
        const centroArquivada = await id(
          sql`insert into centros_evangelizacao (missao_id, nome, principal) values (${arquivada}, 'Principal', true) returning id`,
        );

        const grupo = async (nome: string, missaoId: string, centroId: string, ativo = true) =>
          id(
            sql`insert into grupos_oracao (missao_id, centro_id, nome, membros_efetivos, membros_flutuantes, membros_evadidos, ativo)
                values (${missaoId}, ${centroId}, ${nome}, 10, 2, 1, ${ativo}) returning id`,
          );
        const contagem = (grupoId: string, diasAtras: number) =>
          tx.execute(
            sql`insert into grupo_contagens (grupo_id, membros_efetivos, membros_flutuantes, membros_evadidos, registrado_em)
                values (${grupoId}, 10, 2, 1, now() - (${String(diasAtras)} || ' days')::interval)`,
          );

        const vencido = await grupo("Vencido", missao, centro);
        await contagem(vencido, 95);
        const vencidoDois = await grupo("Também vencido", missao, centro);
        await contagem(vencidoDois, 61);
        const emDia = await grupo("Em dia", missao, centro);
        await contagem(emDia, 12);
        await grupo("Nunca contado", missao, centro);
        const inativo = await grupo("Inativo", missao, centro, false);
        await contagem(inativo, 200);
        const daArquivada = await grupo("Da arquivada", arquivada, centroArquivada);
        await contagem(daArquivada, 200);

        const usuario = async (nome: string, email: string, papel: string, missaoId: string | null, ativo = true) =>
          id(
            sql`insert into usuarios (firebase_uid, nome, email, papel, missao_id, ativo)
                values (${`teste-${email}`}, ${nome}, ${email}, ${papel}::ie.papel, ${missaoId}, ${ativo}) returning id`,
          );
        const responsavel = await usuario("Ana Responsável", "ana@teste.local", "responsavel", missao);
        const auxiliar = await usuario("Bento Auxiliar", "bento@teste.local", "auxiliar", missao);
        await usuario("Carla Desligada", "carla@teste.local", "auxiliar", missao, false);
        await usuario("Admin Geral", "admin@teste.local", "admin", null);

        const agora = new Date();

        /* Recorte ao cenário: o banco pode ter outras missões vencidas (a
           demonstração tem, de propósito). O que se afirma aqui é sobre as
           duas missões e as pessoas criadas acima. */
        const minhasMissoes = new Set([missao, arquivada]);
        const doTeste = (email: string) => email.endsWith("@teste.local");
        const planoDoTeste = (plano: Awaited<ReturnType<typeof planejarLembretes>>) => ({
          vencidos: plano.vencidos.filter((g) => minhasMissoes.has(g.missaoId)),
          envios: plano.envios.filter((e) => doTeste(e.destinatario.email)),
          semDestinatario: plano.semDestinatario.filter((m) => minhasMissoes.has(m.missaoId)),
        });

        // ─── Planejamento ──────────────────────────────────────────────────
        console.log("\nPlanejamento");
        const plano = planoDoTeste(await planejarLembretes(tx, agora));
        igual(
          "só os grupos ativos, de missão ativa, com contagem vencida ou inexistente",
          plano.vencidos.map((g) => g.grupoNome).sort(),
          ["Nunca contado", "Também vencido", "Vencido"],
        );
        igual(
          "uma entrega por pessoa ativa da missão (responsável e auxiliar), sem o admin e sem quem foi desligado",
          plano.envios.map((e) => e.destinatario.email).sort(),
          ["ana@teste.local", "bento@teste.local"],
        );
        ok(
          "cada pessoa recebe os três grupos vencidos da missão",
          plano.envios.every((e) => e.grupos.length === 3),
        );
        igual("nenhuma missão sem destinatário", plano.semDestinatario, []);

        // ─── Textos e links ────────────────────────────────────────────────
        console.log("\nMensagens");
        const grupos = plano.envios[0].grupos;
        igual(
          "título fala em quantos grupos aguardam",
          tituloDaNotificacao(grupos),
          "Contagem bimestral: 3 grupos aguardam atualização",
        );
        igual(
          "vários grupos levam à lista recortada aos pendentes",
          urlDaNotificacao(grupos),
          `/missoes/${missao}/grupos?contagem=pendente`,
        );
        igual(
          "um grupo só leva direto ao diálogo dele",
          urlDaNotificacao([grupos[0]]),
          `/missoes/${missao}/grupos?grupo=${grupos[0].grupoId}`,
        );
        const email = emailDoLembrete({ nome: "Ana Responsável", grupos, baseUrl: "https://ie.exemplo.org/" });
        ok(
          "o e-mail tem um link absoluto por grupo, para o diálogo de contagem",
          grupos.every((g) =>
            email.html.includes(`https://ie.exemplo.org/missoes/${missao}/grupos?grupo=${g.grupoId}`) &&
            email.texto.includes(`https://ie.exemplo.org/missoes/${missao}/grupos?grupo=${g.grupoId}`),
          ),
        );
        ok("o e-mail chama a pessoa pelo primeiro nome", email.texto.startsWith("Olá, Ana."));
        ok("grupo nunca contado aparece como tal", email.texto.includes("Nunca contado (última contagem: nunca registrada)"));

        // ─── Simulação não grava ───────────────────────────────────────────
        console.log("\nSimulação");
        const simulado = await executarLembretes(tx, {
          agora,
          baseUrl: "https://ie.exemplo.org",
          enviarEmail: async () => undefined,
          simular: true,
        });
        const simuladoDoTeste = simulado.envios.filter((e) => doTeste(e.para));
        igual(
          "relata as 2 pessoas do cenário, cada uma com 3 grupos",
          simuladoDoTeste.map((e) => e.grupos.length),
          [3, 3],
        );
        ok("marca os dois canais como previstos", simuladoDoTeste.every((e) => e.canais.length === 2));
        const contar = async (consulta: ReturnType<typeof sql>) =>
          Number((await tx.execute<{ n: string }>(consulta)).rows[0].n);
        /* A política de `notificacoes` é "cada um lê as suas" — nem o escopo
           do sistema enxerga as dos outros. Para conferir o que foi gravado, o
           teste veste a pessoa por um instante e devolve o escopo em seguida. */
        const comoUsuario = async <T,>(usuarioId: string, consulta: () => Promise<T>) => {
          await tx.execute(sql`select set_config('app.usuario_id', ${usuarioId}, true)`);
          try {
            return await consulta();
          } finally {
            await tx.execute(
              sql`select set_config('app.usuario_id', '00000000-0000-0000-0000-000000000000', true)`,
            );
          }
        };
        const notificacoesDoTeste = async () => {
          let total = 0;
          for (const pessoa of [responsavel, auxiliar]) {
            total += await comoUsuario(pessoa, () =>
              contar(sql`select count(*) as n from notificacoes where usuario_id = ${pessoa}`),
            );
          }
          return total;
        };
        const lembretesDoTeste = () =>
          contar(sql`select count(*) as n from lembretes_contagem where usuario_id in (${responsavel}, ${auxiliar})`);
        igual("não cria notificação", await notificacoesDoTeste(), 0);
        igual("não registra lembrete", await lembretesDoTeste(), 0);

        // ─── Execução real, com e-mail que falha para uma pessoa ───────────
        console.log("\nExecução");
        const enviados: Mensagem[] = [];
        const relatorio = await executarLembretes(tx, {
          agora,
          baseUrl: "https://ie.exemplo.org",
          enviarEmail: async (mensagem) => {
            if (mensagem.para === "bento@teste.local") throw new Error("caixa cheia");
            enviados.push(mensagem);
          },
        });
        igual("duas notificações internas para o cenário", await notificacoesDoTeste(), 2);
        igual("a falha fica no relatório, nominal", relatorio.erros.length, 1);
        ok("a falha cita o destinatário", relatorio.erros[0].includes("bento@teste.local"));
        igual("quem falhou no e-mail ainda teve a notificação interna", relatorio.envios.find((e) => e.para === "bento@teste.local")?.canais, ["interno"]);
        igual("quem recebeu teve os dois canais", relatorio.envios.find((e) => e.para === "ana@teste.local")?.canais, ["interno", "email"]);
        const paraAna = enviados.find((m) => m.para === "ana@teste.local");
        igual("o e-mail saiu para a pessoa certa com o assunto certo", [paraAna?.para, paraAna?.assunto], ["ana@teste.local", "Hora de atualizar a contagem de 3 grupos de oração"]);
        ok("ninguém desligado nem admin recebeu e-mail", !enviados.some((m) => ["carla@teste.local", "admin@teste.local"].includes(m.para)));

        const notificacoes: { usuario_id: string; url: string; lida_em: string | null }[] = [];
        for (const pessoa of [responsavel, auxiliar].sort()) {
          notificacoes.push(
            ...(await comoUsuario(pessoa, async () =>
              (
                await tx.execute<{ usuario_id: string; url: string; lida_em: string | null }>(
                  sql`select usuario_id, url, lida_em from notificacoes where usuario_id = ${pessoa}`,
                )
              ).rows,
            )),
          );
        }
        igual(
          "o escopo do sistema não lê notificação de ninguém (política por pessoa)",
          await contar(sql`select count(*) as n from notificacoes`),
          0,
        );
        igual(
          "cada pessoa tem uma notificação não lida apontando para os pendentes",
          notificacoes.map((n) => [n.usuario_id, n.url, n.lida_em]).sort(),
          [responsavel, auxiliar]
            .sort()
            .map((u) => [u, `/missoes/${missao}/grupos?contagem=pendente`, null]),
        );

        const lembretes = (
          await tx.execute<{ canal: string; n: string }>(
            sql`select canal, count(*) as n from lembretes_contagem
                 where usuario_id in (${responsavel}, ${auxiliar})
                 group by canal order by canal`,
          )
        ).rows.map((l) => [l.canal, Number(l.n)]);
        // Ordem do enum (`interno`, `email`), não alfabética.
        igual(
          "3 grupos × 2 internos e 3 grupos × 1 e-mail registrados",
          lembretes,
          [["interno", 6], ["email", 3]],
        );

        // ─── Idempotência ──────────────────────────────────────────────────
        console.log("\nRodar de novo");
        const repetido = await executarLembretes(tx, {
          agora: new Date(agora.getTime() + DIA),
          baseUrl: "https://ie.exemplo.org",
          enviarEmail: async () => undefined,
        });
        igual("no dia seguinte não há nada a enviar", [repetido.gruposVencidos, repetido.notificacoesCriadas, repetido.emailsEnviados], [0, 0, 0]);
        igual("e nenhuma notificação a mais para o cenário", await notificacoesDoTeste(), 2);

        const daquiADoisMeses = new Date(agora.getTime() + 62 * DIA);
        const depois = planoDoTeste(await planejarLembretes(tx, daquiADoisMeses));
        // "Em dia" tinha 12 dias; com mais 62, passou dos dois meses também.
        igual(
          "dois meses depois, sem contagem nova, os mesmos grupos voltam — e o que estava em dia venceu",
          depois.vencidos.map((g) => g.grupoNome).sort(),
          ["Em dia", "Nunca contado", "Também vencido", "Vencido"],
        );

        // ─── Contagem registrada tira o grupo da fila ──────────────────────
        console.log("\nDepois de contar");
        await tx.execute(
          sql`insert into grupo_contagens (grupo_id, membros_efetivos, membros_flutuantes, membros_evadidos, registrado_em)
              values (${vencido}, 11, 2, 1, ${daquiADoisMeses.toISOString()}::timestamptz - interval '1 day')`,
        );
        const contado = planoDoTeste(await planejarLembretes(tx, daquiADoisMeses));
        igual(
          "o grupo recontado sai; os outros continuam",
          contado.vencidos.map((g) => g.grupoNome).sort(),
          ["Em dia", "Nunca contado", "Também vencido"],
        );

        tx.rollback();
      })
      .catch((erro) => {
        if (erro instanceof Error && erro.message.includes("Rollback")) return;
        throw erro;
      });
  } finally {
    await pool.end();
  }

  console.log(falhas === 0 ? "\n✓ Lembretes: tudo certo.\n" : `\n✗ ${falhas} verificação(ões) falharam.\n`);
  if (falhas > 0) process.exit(1);
}

principal().catch((erro) => {
  console.error("✗ Falha:", erro);
  process.exit(1);
});
