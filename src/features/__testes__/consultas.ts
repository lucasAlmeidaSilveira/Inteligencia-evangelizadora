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
import { pastoresPorGrupo } from "@/features/grupos/pastores";
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

        const g = (
          await tx.execute<{ id: string }>(
            sql`insert into grupos_oracao (missao_id, nome, quantidade_pessoas, ativo) values
                  (${missao}, 'Grupo A', 12, true),
                  (${missao}, 'Grupo B', 8,  true),
                  (${missao}, 'Grupo Encerrado', 500, false)
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
          insert into eventos (missao_id, tipo_evento_id, titulo, data_inicio, data_fim, status) values
            (${missao}, ${tipo}, 'Já aconteceu', now() - interval '30 days', now() - interval '29 days', 'realizado'),
            (${missao}, ${tipo}, 'Daqui a 10 dias', now() + interval '10 days', now() + interval '11 days', 'planejado'),
            (${missao}, ${tipo}, 'Daqui a 3 dias',  now() + interval '3 days',  now() + interval '4 days',  'planejado'),
            (${missao}, ${tipo}, 'Cancelado amanhã', now() + interval '1 day',  now() + interval '2 days',  'cancelado')
        `);

        // ─── Agregados ──────────────────────────────────────────────────────
        console.log("\nAgregados da missão");
        const agregados = await agregadosPorMissao(tx, [missao, outra]);
        const a = agregados.get(missao);

        ok("conta só os grupos ativos (2 de 3)", a?.gruposAtivos, 2);
        ok("soma pessoas só dos grupos ativos (12 + 8)", a?.pessoasEmGrupos, 20);
        ok("conta todas as ações apostólicas (4)", a?.eventosTotal, 4);
        ok(
          "próxima ação ignora o passado e o cancelado (a de 3 dias)",
          a?.proximoEvento !== null &&
            a?.proximoEvento !== undefined &&
            Math.round(
              (a.proximoEvento.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            ),
          3,
        );

        console.log("\nMissão sem nada cadastrado");
        const b = agregados.get(outra);
        ok("não aparece no mapa, e o chamador usa o zerado", b, undefined);

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
