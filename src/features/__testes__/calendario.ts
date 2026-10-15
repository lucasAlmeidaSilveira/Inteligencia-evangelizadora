import { diasDaAcao, diasDaGrade, ocorreNoDia, rotuloDoDia, rotuloDoMes, tocaOMes } from "@/features/painel/grade";
import {
  lerFiltrosAnuais,
  limitesDoAno,
  montarRelatorioAnual,
  relatorioAnualParaCsv,
  rotuloDosDias,
} from "@/features/relatorios/anual";
import type { AcaoDoAno } from "@/features/relatorios/queries-anual";
import {
  formatarCompetencia,
  formatarData,
  formatarDataHora,
  formatarPeriodo,
  paraDatetimeLocal,
} from "@/lib/format";
import {
  diaNoFuso,
  fimDoDia,
  inicioDoDia,
  instanteNoFuso,
  paraInstante,
} from "@/lib/fuso";
import { deslocarMes, intervaloDoMes } from "@/lib/mes";
import {
  atalhosDePeriodo,
  chaveDoPeriodo,
  competenciaDoFim,
  lerChaveDePeriodo,
  lerPeriodo,
  rotuloDoPeriodo,
} from "@/lib/periodo";

/**
 * O calendário e o relatório anual, contra o fuso de quem roda o código.
 *
 *   pnpm testar:calendario
 *
 * Existe por um bug que só aparecia em produção. O servidor da Vercel roda em
 * UTC e o navegador em São Paulo: a grade de setembro saía com os dias de
 * agosto, e o Seminário de Vida no Espírito Santo de 6 de setembro não aparecia
 * em mês nenhum. Em desenvolvimento as duas pontas estão no mesmo fuso, e
 * nenhum teste rodado só ali o pegaria.
 *
 * Por isso tudo roda uma vez em cada fuso de processo abaixo, e o resultado
 * precisa ser o mesmo em todos. Puro: não toca banco nenhum.
 */
let falhas = 0;

function ok(descricao: string, obtido: unknown, esperado: unknown) {
  const igual = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!igual) {
    console.log(`  ✗ ${descricao}`);
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
    console.log(`      obtido:   ${JSON.stringify(obtido)}`);
    falhas++;
  }
  return igual;
}

/* ─── Ações de exemplo ───────────────────────────────────────────────────── */

const base = {
  tipoNome: "Retiro",
  tipoCor: "#2563eb",
  missaoNome: "Missão Guarulhos",
  centroNome: "Missão Guarulhos",
  local: null,
  destaqueRegional: false,
} satisfies Partial<AcaoDoAno>;

// Instantes em UTC; o comentário diz o que o relógio de São Paulo marcava.
const SEMINARIO: AcaoDoAno = {
  ...base,
  id: "sves",
  titulo: "Seminário de Vida no Espírito Santo de Guarulhos",
  tipoNome: "SVES",
  dataInicio: "2026-09-06T11:00:00.000Z", // dom 06/09, 08:00
  dataFim: "2026-09-06T21:00:00.000Z", //    dom 06/09, 18:00
  status: "realizado",
  destaqueRegional: true,
};

const RETIRO_DA_VIRADA: AcaoDoAno = {
  ...base,
  id: "retiro",
  titulo: "Retiro de Ano Novo",
  dataInicio: "2025-12-30T21:00:00.000Z", // ter 30/12/2025, 18:00
  dataFim: "2026-01-02T15:00:00.000Z", //    sex 02/01/2026, 12:00
  status: "realizado",
};

const VIGILIA: AcaoDoAno = {
  ...base,
  id: "vigilia",
  titulo: "Vigília de fim de ano",
  dataInicio: "2027-01-01T01:00:00.000Z", // qui 31/12/2026, 22:00
  dataFim: "2027-01-01T04:00:00.000Z", //    sex 01/01/2027, 01:00
  status: "planejado",
};

const QUARESMA: AcaoDoAno = {
  ...base,
  id: "quaresma",
  titulo: "Missão de Quaresma",
  dataInicio: "2026-02-18T12:00:00.000Z", // qua 18/02, 09:00
  dataFim: "2026-04-02T21:00:00.000Z", //    qui 02/04, 18:00
  status: "realizado",
};

const KAIROS: AcaoDoAno = {
  ...base,
  id: "kairos",
  // Aspas e ponto e vírgula: os dois caracteres que quebram CSV.
  titulo: 'Noite "Kairós"; jovens',
  dataInicio: "2026-06-13T22:00:00.000Z", // sáb 13/06, 19:00
  dataFim: "2026-06-14T01:00:00.000Z", //    sáb 13/06, 22:00
  status: "realizado",
  destaqueRegional: true,
};

const CANCELADA: AcaoDoAno = {
  ...base,
  id: "cancelada",
  titulo: "Encontro cancelado",
  dataInicio: "2026-05-10T13:00:00.000Z",
  dataFim: "2026-05-10T20:00:00.000Z",
  status: "cancelado",
};

/* ─── Verificações ───────────────────────────────────────────────────────── */

function verificarCalendario() {
  // A grade de setembro de 2026: domingo 30/08 a sábado 03/10.
  const setembro = diasDaGrade("2026-09");
  ok("grade de setembro começa no domingo 30/08", setembro[0].chave, "2026-08-30");
  ok("grade de setembro termina no sábado 03/10", setembro.at(-1)?.chave, "2026-10-03");
  ok("grade de setembro tem cinco semanas", setembro.length, 35);
  ok(
    "06/09 está na grade de setembro, como dia do mês",
    setembro.find((d) => d.chave === "2026-09-06"),
    { chave: "2026-09-06", numero: 6, doMes: true },
  );
  ok(
    "31/08 entra esmaecido na grade de setembro",
    setembro.find((d) => d.chave === "2026-08-31")?.doMes,
    false,
  );
  // Agosto de 2026 começa num sábado: seis semanas. Fevereiro, num domingo e
  // com 28 dias: quatro semanas exatas.
  ok("grade de agosto tem seis semanas", diasDaGrade("2026-08").length, 42);
  ok("grade de fevereiro tem quatro semanas", diasDaGrade("2026-02").length, 28);

  // O seminário cai no dia 6, e só nele.
  const seminario = diasDaAcao(SEMINARIO);
  ok(
    "o seminário ocupa 06/09 e só 06/09",
    ["2026-09-05", "2026-09-06", "2026-09-07"].map((d) => ocorreNoDia(seminario, d)),
    [false, true, false],
  );
  ok("o seminário conta em setembro", tocaOMes(seminario, "2026-09"), true);
  ok("o seminário não conta em agosto", tocaOMes(seminario, "2026-08"), false);

  // 22h de 05/09 em São Paulo já é 06/09 em UTC: o dia é o de São Paulo.
  ok("ação das 22h fica no dia em que aconteceu", diaNoFuso("2026-09-06T01:00:00.000Z"), "2026-09-05");

  // Ação que atravessa a virada do mês conta nos dois.
  const virada = diasDaAcao({ dataInicio: "2026-08-31T23:00:00.000Z", dataFim: "2026-09-01T05:00:00.000Z" });
  ok(
    "ação de 31/08 a 01/09 toca agosto e setembro, não outubro",
    ["2026-08", "2026-09", "2026-10"].map((m) => tocaOMes(virada, m)),
    [true, true, false],
  );

  ok("mês anterior a janeiro é dezembro do ano anterior", deslocarMes("2026-01", -1), "2025-12");
  ok("mês seguinte a dezembro é janeiro do ano seguinte", deslocarMes("2026-12", 1), "2027-01");
  ok("rótulo do mês", rotuloDoMes("2026-09"), "setembro de 2026");
  ok("rótulo do dia", rotuloDoDia("2026-09-06"), "domingo, 06 de setembro");
}

function verificarFuso() {
  ok("1º de janeiro começa às 3h UTC", instanteNoFuso(2026, 1, 1).toISOString(), "2026-01-01T03:00:00.000Z");
  ok(
    "31 de dezembro termina às 2h59 UTC do dia seguinte",
    instanteNoFuso(2026, 12, 31, 23, 59, 59, 999).toISOString(),
    "2027-01-01T02:59:59.999Z",
  );
  // Horário de verão de 2017–2018: São Paulo estava em UTC-2.
  ok("1º de janeiro de 2018, no horário de verão", instanteNoFuso(2018, 1, 1).toISOString(), "2018-01-01T02:00:00.000Z");
  // Em 04/11/2018 a meia-noite não existiu: o relógio pulou para 1h.
  ok(
    "dia em que a meia-noite não existiu começa quando o relógio voltou a andar",
    instanteNoFuso(2018, 11, 4).toISOString(),
    "2018-11-04T03:00:00.000Z",
  );
  ok(
    "e esse instante é do próprio dia, não do anterior",
    diaNoFuso(instanteNoFuso(2018, 11, 4)),
    "2018-11-04",
  );
}

function verificarRelatorioAnual() {
  const { de, ate } = limitesDoAno(2026);
  ok("limites do ano em São Paulo", [de.toISOString(), ate.toISOString()], [
    "2026-01-01T03:00:00.000Z",
    "2027-01-01T02:59:59.999Z",
  ]);
  // A vigília das 22h de 31/12 está dentro do ano — com meia-noite UTC, não.
  ok(
    "a vigília de 31/12 às 22h está dentro de 2026",
    new Date(VIGILIA.dataInicio) <= ate && new Date(VIGILIA.dataFim) >= de,
    true,
  );

  ok("ano da URL", lerFiltrosAnuais({ ano: "2025" }, 2026).ano, 2025);
  ok("o ano seguinte é aceito", lerFiltrosAnuais({ ano: "2027" }, 2026).ano, 2027);
  ok("dois anos à frente vira o corrente", lerFiltrosAnuais({ ano: "2028" }, 2026).ano, 2026);
  ok("ano inválido vira o corrente", lerFiltrosAnuais({ ano: "1" }, 2026).ano, 2026);
  ok("texto qualquer vira o corrente", lerFiltrosAnuais({ ano: "lixo" }, 2026).ano, 2026);
  ok("canceladas, pela URL", lerFiltrosAnuais({ cancelados: "1" }, 2026).incluirCancelados, true);

  const acoes = [RETIRO_DA_VIRADA, QUARESMA, CANCELADA, KAIROS, SEMINARIO, VIGILIA];
  const relatorio = montarRelatorioAnual(acoes, 2026, "2026-10-14");

  // Nenhuma omitida: toda ação recebida está em algum mês.
  ok(
    "toda ação recebida aparece no relatório",
    relatorio.meses.flatMap((m) => m.acoes.map((a) => a.id)).sort(),
    acoes.map((a) => a.id).sort(),
  );
  ok(
    "cada ação no mês em que começou; a da virada abre janeiro",
    relatorio.meses.map((m) => [m.chave, m.acoes.map((a) => a.id)]),
    [
      ["2026-01", ["retiro"]],
      ["2026-02", ["quaresma"]],
      ["2026-05", ["cancelada"]],
      ["2026-06", ["kairos"]],
      ["2026-09", ["sves"]],
      ["2026-12", ["vigilia"]],
    ],
  );
  ok("totais", relatorio.total, {
    acoes: 6,
    realizadas: 4,
    agendadas: 1,
    canceladas: 1,
    destaques: 2,
    // Retiro: 01 e 02/01 (os dias de 2025 não contam). Quaresma: 18/02 a
    // 02/04, 44 dias. Kairós, seminário e vigília: um dia cada em 2026.
    diasComAcao: 49,
  });
  // Maio só tem a cancelada, e outubro ainda não acabou.
  ok("meses encerrados sem ação", relatorio.mesesSemAcao, ["2026-05", "2026-07", "2026-08"]);

  const linha = (id: string) => relatorio.meses.flatMap((m) => m.acoes).find((a) => a.id === id)!;
  ok("dia exato do seminário", rotuloDosDias(linha("sves")), "dom 06/09");
  ok("dias do retiro, um por um", rotuloDosDias(linha("retiro")), "ter 30/12, qua 31/12, qui 01/01, sex 02/01");
  ok("quaresma: faixa em vez de 44 datas", rotuloDosDias(linha("quaresma")), "18/02 a 02/04, 44 dias seguidos");

  const csv = relatorioAnualParaCsv(relatorio, "Missão Guarulhos");
  const linhas = csv.split("\r\n");
  ok("CSV começa com BOM", csv.charCodeAt(0), 0xfeff);
  ok("CSV traz o ano e a missão no título", linhas[0], "﻿Relatório anual de 2026 · Missão Guarulhos");
  ok(
    "CSV tem o cabeçalho esperado",
    linhas[2],
    "Mês;Ação;Categoria;Missão;Centro;Local;Início;Término;Dias;Dias de realização;Situação;Destaque regional",
  );
  ok(
    "CSV traz o seminário com período, dia exato e destaque",
    linhas.find((l) => l.includes("Seminário")),
    "Setembro;Seminário de Vida no Espírito Santo de Guarulhos;SVES;Missão Guarulhos;Missão Guarulhos;;06/09/2026 08:00;06/09/2026 18:00;1;dom 06/09/2026;Realizado;Sim",
  );
  ok(
    "CSV escapa aspas e ponto e vírgula do título",
    linhas.some((l) => l.includes('"Noite ""Kairós""; jovens"')),
    true,
  );
  ok("CSV fecha com os totais", linhas.slice(-6), [
    "Ações no ano;6",
    "Realizadas;4",
    "Agendadas;1",
    "Canceladas;1",
    "Destaques regionais;2",
    "Dias com ação;49",
  ]);
}

/* O que o servidor escreve na tela, no relógio de São Paulo. Dia-só
   ("2026-09-06", o que uma coluna `date` devolve) é dia do calendário e sai
   como está; instante é lido em São Paulo. */
function verificarFormatadores() {
  ok("período de um dia", formatarPeriodo(SEMINARIO.dataInicio, SEMINARIO.dataFim), "06/09/2026, 08:00 às 18:00");
  ok(
    "período que atravessa a virada do ano",
    formatarPeriodo(VIGILIA.dataInicio, VIGILIA.dataFim),
    "31/12/2026 22:00 até 01/01/2027 01:00",
  );
  ok("data de um instante", formatarData(VIGILIA.dataInicio), "31/12/2026");
  ok("data com hora", formatarDataHora(SEMINARIO.dataInicio), "06/09/2026 às 08:00");
  // Meia-noite UTC de 1º de setembro ainda é 31 de agosto em São Paulo — mas
  // "2026-09-01" sem hora é a competência de setembro, não um instante.
  ok("dia-só não recua um dia", formatarData("2026-09-01"), "01/09/2026");
  ok("competência da coluna date", formatarCompetencia("2026-09-01"), "setembro de 2026");
  ok("competência da chave de mês", formatarCompetencia("2026-09"), "setembro de 2026");
  ok("competência de um instante", formatarCompetencia("2026-09-01T01:00:00.000Z"), "agosto de 2026");
}

/* O recorte de período: o dia viaja como chave e vira instante de São Paulo
   só na borda da consulta. */
function verificarPeriodo() {
  const setembro = lerPeriodo({ de: "2026-09-01", ate: "2026-09-30" })!;
  ok(
    "setembro vai das 3h UTC do dia 1º às 2h59 UTC de 1º de outubro",
    [setembro.de.toISOString(), setembro.ate.toISOString()],
    ["2026-09-01T03:00:00.000Z", "2026-10-01T02:59:59.999Z"],
  );
  // A ação das 22h de 30/09 (1h UTC de 01/10) está em setembro.
  ok("a ação das 22h do último dia entra no mês", new Date("2026-10-01T01:00:00.000Z") <= setembro.ate, true);
  ok("intervalo invertido vale o menor", chaveDoPeriodo(lerPeriodo({ de: "2026-09-30", ate: "2026-09-01" })), "2026-09-01..2026-09-30");
  ok("um lado só é intervalo de um dia", chaveDoPeriodo(lerPeriodo({ de: "2026-09-06" })), "2026-09-06..2026-09-06");
  ok("dia impossível é ignorado", lerPeriodo({ de: "2026-13-40" }), undefined);
  ok("`?mes=` antigo ainda abre o mês", chaveDoPeriodo(lerPeriodo({ mes: "2026-09" })), "2026-09-01..2026-09-30");
  ok("`?periodo=tudo` é ausência de recorte", lerPeriodo({ periodo: "tudo" }, intervaloDoMes("2026-09")), undefined);
  ok(
    "a chave do cache volta ao mesmo intervalo",
    [lerChaveDePeriodo("2026-09-01..2026-09-30")?.de.toISOString(), lerChaveDePeriodo("2026-09-01..2026-09-30")?.ate.toISOString()],
    [setembro.de.toISOString(), setembro.ate.toISOString()],
  );
  ok("limites de dia", [inicioDoDia("2026-09-06")?.toISOString(), fimDoDia("2026-09-06")?.toISOString()], [
    "2026-09-06T03:00:00.000Z",
    "2026-09-07T02:59:59.999Z",
  ]);

  ok(
    "atalhos a partir de hoje, em chaves",
    atalhosDePeriodo("2026-10-14").map((a) => [a.rotulo, a.de, a.ate]),
    [
      ["Hoje", "2026-10-14", "2026-10-14"],
      ["Ontem", "2026-10-13", "2026-10-13"],
      ["Última semana", "2026-10-07", "2026-10-14"],
      ["Últimos 30 dias", "2026-09-14", "2026-10-14"],
      ["Último mês", "2026-09-01", "2026-09-30"],
    ],
  );
  ok("rótulo do atalho", rotuloDoPeriodo({ de: "2026-10-07", ate: "2026-10-14" }, "2026-10-14", "Tudo"), "Última semana");
  ok("rótulo do mês fechado", rotuloDoPeriodo({ de: "2026-02-01", ate: "2026-02-28" }, "2026-10-14", "Tudo"), "Fevereiro de 2026");
  ok("rótulo de um dia", rotuloDoPeriodo({ de: "2026-09-06", ate: "2026-09-06" }, "2026-10-14", "Tudo"), "06/09/2026");
  ok("rótulo de intervalo", rotuloDoPeriodo({ de: "2026-09-06", ate: "2026-09-08" }, "2026-10-14", "Tudo"), "06/09/2026 a 08/09/2026");
  ok("rótulo sem recorte", rotuloDoPeriodo(undefined, "2026-10-14", "Tudo"), "Tudo");
  // O recorte termina às 23:59:59.999 de 30/09 em São Paulo, 1º/10 em UTC: a
  // competência é a de setembro.
  ok("competência do fim do recorte", competenciaDoFim(setembro), "2026-09");
}

/* A ida e a volta do formulário: a página de edição escreve o valor inicial no
   servidor e o navegador o devolve. Os dois no relógio de São Paulo, o
   resultado não depende de onde cada um roda. */
function verificarFormulario() {
  ok(
    "o formulário grava 8h de São Paulo como 11h UTC",
    paraInstante("2026-09-06T08:00"),
    "2026-09-06T11:00:00.000Z",
  );
  ok(
    "a edição reabre a ação na hora em que foi gravada",
    paraDatetimeLocal("2026-09-06T11:00:00.000Z"),
    "2026-09-06T08:00",
  );
  ok(
    "salvar sem mexer não desloca a ação",
    paraInstante(paraDatetimeLocal(SEMINARIO.dataInicio)),
    SEMINARIO.dataInicio,
  );
  // 22h de São Paulo já é o dia seguinte em UTC; o dia do input é o de lá.
  ok(
    "a vigília das 22h abre no dia 31, não no dia 1º",
    paraDatetimeLocal(VIGILIA.dataInicio),
    "2026-12-31T22:00",
  );
}

const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Los_Angeles"];

for (const fuso of FUSOS) {
  process.env.TZ = fuso;
  const antes = falhas;
  verificarCalendario();
  verificarFuso();
  verificarRelatorioAnual();
  verificarFormatadores();
  verificarPeriodo();
  verificarFormulario();
  console.log(`${falhas === antes ? "  ✓" : "  ✗"} processo em ${fuso}`);
}

if (falhas) {
  console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("\n✓ Calendário, recorte, formatadores e relatório anual iguais em qualquer fuso de servidor.\n");
