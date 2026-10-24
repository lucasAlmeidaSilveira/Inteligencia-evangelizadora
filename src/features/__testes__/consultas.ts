import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";



import {
  calcularFinanceiro,
  paraCentavos,
  somarLancamentos,
} from "@/features/eventos/financeiro";
import { vinculadosPorCentro } from "@/features/centros/vinculados";
import { pastoresPorGrupo } from "@/features/grupos/pastores";
import {
  COMENTARIOS_POR_PAGINA,
  comentariosPaginados,
  respostasPorEvento,
} from "@/features/pesquisas/agregados";
import {
  agregadosPorMissao,
  membrosDaMissao,
} from "@/features/missoes/agregados";
import {
  configuracaoDeConexao,
  DEFINIR_SEARCH_PATH,
  urlDaAplicacao,
} from "@/server/db/conexao";
import * as schema from "@/server/db/schema";

/**
 * Confere os agregados e a leitura de pastores contra dados conhecidos.
 *
 *   pnpm testar:consultas
 *
 * Existe por causa de um bug real: uma subconsulta correlacionada escrita em
 * `sql` bruto referenciava a tabela externa sem qualificar o schema, o
 * Postgres resolvia o nome para a coluna homônima da tabela interna, e todas
 * as contagens voltavam zeradas — sem erro, sem aviso, só números errados na
 * tela. Consulta que falha em silêncio precisa de teste com números esperados.
 *
 * Roda em transação revertida: não deixa resíduo.
 */
let falhas = 0;

function ok(descricao: string, obtido: unknown, esperado: unknown) {
  const igual = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`${igual ? "  ✓" : "  ✗"} ${descricao}`);
  if (!igual) {
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
    console.log(`      obtido:   ${JSON.stringify(obtido)}`);
    falhas++;
  }
}

async function principal() {
  const pool = new Pool({
    ...configuracaoDeConexao(urlDaAplicacao()),
    max: 1,
  });
  // Com o schema, o tipo da transação bate com o que as funções esperam —
  // sem precisar de cast, que só esconderia uma incompatibilidade real.
  const db = drizzle(pool, { schema });

  try {
    await db
      .transaction(async (tx) => {
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
        await tx.execute(sql.raw(DEFINIR_SEARCH_PATH));
      await tx.execute(sql`select set_config('app.papel', 'admin', true)`);

        // ─── Cenário com números escolhidos a dedo ──────────────────────────
        const missao = (
          await tx.execute<{ id: string }>(
            sql`insert into missoes (nome, slug, membros_total)
                values ('Consultas Teste', 'consultas-teste', 240) returning id`,
          )
        ).rows[0].id;

        const outra = (
          await tx.execute<{ id: string }>(
            sql`insert into missoes (nome, slug) values ('Outra', 'outra-teste') returning id`,
          )
        ).rows[0].id;

        /* O principal entra primeiro: é para ele que apontam os grupos e as
           ações que não foram separados em outra frente — o mesmo papel que
           a migration deu aos dados que já existiam. */
        const c = (
          await tx.execute<{ id: string }>(
            sql`insert into centros_evangelizacao (missao_id, nome, tipo, principal, ativo) values
                  (${missao}, 'Principal',         'centro_evangelizacao', true,  true),
                  (${missao}, 'Centro Ativo',      'centro_evangelizacao', false, true),
                  (${missao}, 'Irradiação Ativa',  'irradiacao',           false, true),
                  (${missao}, 'Centro Encerrado',  'centro_evangelizacao', false, false)
                returning id`,
          )
        ).rows.map((r) => r.id);

        // A outra missão fica só com o principal: é o estado de uma missão
        // recém-criada, e o agregado precisa contá-lo.
        await tx.execute(
          sql`insert into centros_evangelizacao (missao_id, nome, tipo, principal)
              values (${outra}, 'Principal da Outra', 'centro_evangelizacao', true)`,
        );

        const g = (
          await tx.execute<{ id: string }>(
            /* Os totais (12, 8, 500) são efetivos + flutuantes; os evadidos
               entram só para provar que ficam fora da soma dos agregados. */
            sql`insert into grupos_oracao (missao_id, centro_id, nome, membros_efetivos, membros_flutuantes, membros_evadidos, ativo) values
                  (${missao}, ${c[1]}, 'Grupo A', 10, 2, 3, true),
                  (${missao}, ${c[0]}, 'Grupo B', 8, 0, 1, true),
                  (${missao}, ${c[1]}, 'Grupo Encerrado', 500, 0, 0, false)
                returning id`,
          )
        ).rows.map((r) => r.id);

        await tx.execute(sql`
          insert into grupo_responsaveis (grupo_id, nome, telefone, ordem) values
            (${g[0]}, 'Ana Primeira',  '(11) 90000-0001', 1),
            (${g[0]}, 'Bruno Segundo', null,              2),
            (${g[0]}, 'Zé',            null,              3),
            (${g[1]}, 'Carla Única',   '(11) 90000-0002', 1)
        `);

        const tipo = (
          await tx.execute<{ id: string }>(sql`select id from tipos_evento limit 1`)
        ).rows[0].id;

        await tx.execute(sql`
          insert into eventos (missao_id, centro_id, tipo_evento_id, titulo, data_inicio, data_fim, status) values
            (${missao}, ${c[1]}, ${tipo}, 'Já aconteceu', now() - interval '30 days', now() - interval '29 days', 'realizado'),
            (${missao}, ${c[0]}, ${tipo}, 'Daqui a 10 dias', now() + interval '10 days', now() + interval '11 days', 'planejado'),
            (${missao}, ${c[0]}, ${tipo}, 'Daqui a 3 dias',  now() + interval '3 days',  now() + interval '4 days',  'planejado'),
            (${missao}, ${c[0]}, ${tipo}, 'Cancelado amanhã', now() + interval '1 day',  now() + interval '2 days',  'cancelado')
        `);

        // ─── Agregados ──────────────────────────────────────────────────────
        console.log("\nAgregados da missão");
        const agregados = await agregadosPorMissao(tx, [missao, outra]);
        const a = agregados.get(missao);

        ok("conta só os centros ativos (3 de 4)", a?.centrosAtivos, 3);
        ok("conta só os grupos ativos (2 de 3)", a?.gruposAtivos, 2);
        ok("soma pessoas só dos grupos ativos (12 + 8)", a?.pessoasEmGrupos, 20);
        ok("conta todas as ações apostólicas (4)", a?.eventosTotal, 4);
        ok(
          "próxima ação ignora o passado e o cancelado (a de 3 dias)",
          a?.proximoEvento !== null &&
            a?.proximoEvento !== undefined &&
            // `proximoEvento` trafega em ISO para sobreviver ao cache; aqui a
            // data volta a ser Date só para a conta de dias.
            Math.round(
              (new Date(a.proximoEvento).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          3,
        );

        console.log("\nMissão só com o principal");
        const b = agregados.get(outra);
        ok("conta o principal e nada mais", b?.centrosAtivos, 1);
        ok("sem grupos", b?.gruposAtivos, 0);
        ok("sem ações", b?.eventosTotal, 0);

        // ─── Vínculos por centro ────────────────────────────────────────────
        console.log("\nGrupos e ações por centro");
        const vinculados = await vinculadosPorCentro(tx, c);

        // Inclui o grupo inativo de propósito: o cartão do centro conta o que
        // está pendurado nele, não o que está ativo — excluir o centro move os
        // dois igualmente para o principal.
        ok("Centro Ativo tem 2 grupos", vinculados.get(c[1])?.grupos, 2);
        ok("Centro Ativo tem 1 ação", vinculados.get(c[1])?.eventos, 1);
        ok("o principal recebeu o resto", vinculados.get(c[0])?.grupos, 1);
        ok("e as ações que sobraram", vinculados.get(c[0])?.eventos, 3);
        ok(
          "centro sem nada pendurado não entra no mapa",
          vinculados.get(c[2]),
          undefined,
        );
        ok(
          "sem centros, devolve mapa vazio sem consultar",
          (await vinculadosPorCentro(tx, [])).size,
          0,
        );

        // ─── Pastores ───────────────────────────────────────────────────────
        console.log("\nPastores por grupo");
        const pastores = await pastoresPorGrupo(tx, g);

        ok("Grupo A tem 3 pastores", pastores.get(g[0])?.length, 3);
        ok(
          "vêm na ordem cadastrada",
          pastores.get(g[0])?.map((p) => p.nome),
          ["Ana Primeira", "Bruno Segundo", "Zé"],
        );
        ok(
          "telefone ausente vem como null",
          pastores.get(g[0])?.[1].telefone,
          null,
        );
        ok("Grupo B tem 1 pastor", pastores.get(g[1])?.length, 1);
        ok("grupo sem pastor não entra no mapa", pastores.get(g[2]), undefined);

        console.log("\nMembros exibidos");
        ok(
          "usa o total informado quando existe",
          membrosDaMissao(240, 20),
          { valor: 240, estimado: false },
        );
        ok(
          "estima pela soma dos grupos quando não foi informado",
          membrosDaMissao(0, 20),
          { valor: 20, estimado: true },
        );
        ok(
          "sem total e sem grupos, zero não é estimativa",
          membrosDaMissao(0, 0),
          { valor: 0, estimado: false },
        );
        ok(
          "total informado prevalece mesmo se menor que os grupos",
          membrosDaMissao(5, 500),
          { valor: 5, estimado: false },
        );

        console.log("\nFinanceiro — precisão");
        ok('paraCentavos("1234.56")', paraCentavos("1234.56"), 123456);
        ok("paraCentavos(null) é zero", paraCentavos(null), 0);
        ok('paraCentavos("") é zero', paraCentavos(""), 0);
        ok(
          "saldo = receitas − despesas",
          calcularFinanceiro("1500.50", "300.25"),
          { receitas: 1500.5, despesas: 300.25, saldo: 1200.25 },
        );

        // Em ponto flutuante, 0.1 + 0.2 dá 0.30000000000000004. Somando em
        // centavos inteiros, o centavo não some do relatório.
        ok(
          "soma de valores que derivam em ponto flutuante",
          somarLancamentos([
            { tipo: "receita", valor: "0.10" },
            { tipo: "receita", valor: "0.20" },
          ]),
          { receitas: 0.3, despesas: 0, saldo: 0.3 },
        );

        ok(
          "mistura de receitas e despesas",
          somarLancamentos([
            { tipo: "receita", valor: "1000.00" },
            { tipo: "receita", valor: "500.50" },
            { tipo: "despesa", valor: "300.25" },
            { tipo: "despesa", valor: "0.01" },
          ]),
          { receitas: 1500.5, despesas: 300.26, saldo: 1200.24 },
        );

        ok(
          "saldo negativo quando as despesas superam",
          somarLancamentos([
            { tipo: "receita", valor: "10.00" },
            { tipo: "despesa", valor: "25.50" },
          ]).saldo,
          -15.5,
        );

        ok("lista vazia soma zero", somarLancamentos([]), {
          receitas: 0,
          despesas: 0,
          saldo: 0,
        });

        // ─── Pesquisa: agregado e lista paginada de comentários ─────────────
        /*
         * 30 respostas numa ação: 25 com comentário, 5 sem, notas em ciclo de
         * 0 a 10. Entram por ie.responder_pesquisa(), no escopo da pesquisa
         * pública — `evento_respostas` não tem policy de INSERT para ninguém
         * logado, nem para o admin, e é assim que deve ser.
         *
         * Dentro de uma transação `now()` não anda, então as 30 respostas
         * empatam no mesmo instante. É o pior caso da paginação, e o que se
         * quer provar: só o desempate por id impede que um comentário apareça
         * em duas páginas enquanto outro some.
         */
        console.log("\nPesquisa — respostas e comentários");
        const eventoPesquisa = (
          await tx.execute<{ id: string }>(
            sql`select id from eventos where missao_id = ${missao} and titulo = 'Já aconteceu'`,
          )
        ).rows[0].id;
        const TOKEN = "q".repeat(43);
        await tx.execute(
          sql`insert into evento_pesquisas (evento_id, token, encerra_em)
              values (${eventoPesquisa}, ${TOKEN}, now() + interval '7 days')`,
        );

        await tx.execute(
          sql`select set_config('app.papel', 'pesquisa', true),
                     set_config('app.pesquisa_token', ${TOKEN}, true)`,
        );
        for (let n = 1; n <= 30; n++) {
          const comentario = n <= 25 ? `Comentário ${n}` : null;
          await tx.execute(
            sql`select ie.responder_pesquisa(${n % 11}::int, ${comentario}::text)`,
          );
        }
        await tx.execute(
          sql`select set_config('app.papel', 'admin', true),
                     set_config('app.pesquisa_token', '', true)`,
        );

        const agregado = (await respostasPorEvento(tx, [eventoPesquisa])).get(
          eventoPesquisa,
        );
        ok("conta as 30 respostas", agregado?.quantidade, 30);
        ok("conta só as 25 com comentário", agregado?.comentarios, 25);

        const p1 = await comentariosPaginados(tx, eventoPesquisa, null, 1);
        const p2 = await comentariosPaginados(tx, eventoPesquisa, null, 2);
        ok("primeira página cheia", p1.itens.length, COMENTARIOS_POR_PAGINA);
        ok("segunda página com o resto", p2.itens.length, 25 - COMENTARIOS_POR_PAGINA);
        ok("total e páginas", [p1.total, p1.paginas], [25, 2]);
        ok(
          "com todos empatados no horário, a ordem é a do id, decrescente",
          [...p1.itens, ...p2.itens].map((c) => c.id),
          [...p1.itens, ...p2.itens].map((c) => c.id).sort().reverse(),
        );
        ok(
          "nenhum comentário aparece em duas páginas, nenhum some",
          new Set([...p1.itens, ...p2.itens].map((c) => c.id)).size,
          25,
        );
        ok(
          "respondidaEm vem em ISO, para atravessar o cache",
          typeof p1.itens[0]?.respondidaEm === "string" &&
            p1.itens[0].respondidaEm.endsWith("Z"),
          true,
        );

        const alem = await comentariosPaginados(tx, eventoPesquisa, null, 99);
        ok("página além da última vira a última", alem.pagina, 2);

        // Notas n % 11 para n de 1 a 25: 1..10, depois 0..10, depois 0..3.
        // 0 a 6: 6 + 7 + 4 = 17 · 7 e 8: 2 + 2 = 4 · 9 e 10: 2 + 2 = 4.
        const esperadoPorFaixa = { todas: 25, "0-6": 17, "7-8": 4, "9-10": 4 };
        ok("contagem por faixa", p1.porFaixa, esperadoPorFaixa);
        ok(
          "as faixas somam o total",
          p1.porFaixa["0-6"] + p1.porFaixa["7-8"] + p1.porFaixa["9-10"],
          p1.porFaixa.todas,
        );

        const altas = await comentariosPaginados(tx, eventoPesquisa, "9-10", 1);
        ok(
          "filtro 9 e 10 traz só essas notas",
          altas.itens.every((c) => c.nota >= 9) && altas.itens.length === 4,
          true,
        );
        ok("filtro ajusta o total e as páginas", [altas.total, altas.paginas], [4, 1]);

        const semComentario = await comentariosPaginados(
          tx,
          (
            await tx.execute<{ id: string }>(
              sql`select id from eventos where missao_id = ${missao} and titulo = 'Daqui a 3 dias'`,
            )
          ).rows[0].id,
          null,
          1,
        );
        ok(
          "ação sem resposta: lista vazia, uma página",
          [semComentario.itens.length, semComentario.total, semComentario.paginas],
          [0, 0, 1],
        );

        console.log("\nCasos de borda");
        ok(
          "lista vazia de missões devolve mapa vazio",
          (await agregadosPorMissao(tx, [])).size,
          0,
        );
        ok(
          "lista vazia de grupos devolve mapa vazio",
          (await pastoresPorGrupo(tx, [])).size,
          0,
        );

        throw new Error("__reverter__");
      })
      .catch((erro) => {
        if (erro?.message !== "__reverter__") throw erro;
      });
  } finally {
    await pool.end();
  }

  if (falhas) {
    console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
    process.exit(1);
  }
  console.log("\n✓ Consultas devolvem os números esperados.\n");
}

principal().catch((erro) => {
  console.error("\n✗ Erro:", erro?.message ?? erro);
  process.exit(1);
});
