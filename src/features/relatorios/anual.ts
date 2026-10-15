import { STATUS_EVENTO } from "@/features/eventos/schemas";
import {
  dataDaChave,
  diaNoFuso,
  diasEntre,
  horaNoFuso,
  instanteNoFuso,
} from "@/lib/fuso";

import { BOM, celula } from "./csv";
import type { AcaoDoAno } from "./queries-anual";

/**
 * O relatório anual: toda ação apostólica do ano, uma por linha, com o nome,
 * a categoria (o tipo de ação), o período e os dias exatos em que aconteceu.
 *
 * Responde a uma pergunta diferente da do relatório consolidado. Aquele soma
 * — quantas ações, quantos participantes, que saldo; este lista, para a
 * coordenação regional conferir que nenhuma ação do ano ficou de fora.
 *
 * Tudo aqui é puro: a tela, a exportação e o teste montam o relatório pelo
 * mesmo caminho, e o CSV sai igual ao que está na tela.
 */

/* ─── Filtros ────────────────────────────────────────────────────────────── */

type Parametros = Record<string, string | string[] | undefined>;

export type FiltrosAnuais = {
  ano: number;
  missaoId?: string;
  incluirCancelados?: boolean;
};

/** Piso só para a URL não pedir o ano 1: folhear um ano sem registro é
 *  permitido, e a tela diz que ele está vazio. */
export const PRIMEIRO_ANO = 2000;

/**
 * Lê `?ano=` e `?cancelados=` da URL, que qualquer um edita.
 *
 * O teto é o ano seguinte ao corrente — quem planeja já cadastra ações dele.
 * Fora disso, ou sem parâmetro, vale o ano corrente. A missão, como no
 * relatório consolidado, é a missão em foco e chega por parâmetro.
 */
export function lerFiltrosAnuais(
  parametros: Parametros,
  anoCorrente: number,
  missaoId?: string,
): FiltrosAnuais {
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" && valor ? valor : undefined;
  };

  const pedido = Number(texto("ano"));
  const valido =
    Number.isInteger(pedido) &&
    pedido >= PRIMEIRO_ANO &&
    pedido <= anoCorrente + 1;

  return {
    ano: valido ? pedido : anoCorrente,
    missaoId,
    incluirCancelados: texto("cancelados") === "1",
  };
}

/** O ano vai sempre explícito no link da exportação: o CSV baixado em 31 de
 *  dezembro não pode virar o do ano seguinte se for aberto depois. */
export function paraQueryStringAnual(filtros: FiltrosAnuais) {
  const parametros = new URLSearchParams({ ano: String(filtros.ano) });
  if (filtros.incluirCancelados) parametros.set("cancelados", "1");
  return parametros.toString();
}

/**
 * O primeiro e o último instante do ano no relógio de São Paulo.
 *
 * Não é meia-noite UTC: com ela, a ação da noite de 31 de dezembro — 22h em
 * São Paulo, 1h do dia seguinte em UTC — cairia fora do ano em que aconteceu,
 * e o relatório que existe para não omitir nada a omitiria.
 */
export function limitesDoAno(ano: number) {
  return {
    de: instanteNoFuso(ano, 1, 1),
    ate: instanteNoFuso(ano, 12, 31, 23, 59, 59, 999),
  };
}

/* ─── Montagem ───────────────────────────────────────────────────────────── */

export type AcaoNoRelatorio = AcaoDoAno & {
  /** Primeiro e último dia em São Paulo, como `"2026-09-06"`. */
  primeiroDia: string;
  ultimoDia: string;
  quantidadeDeDias: number;
};

export type MesDoRelatorio = { chave: string; acoes: AcaoNoRelatorio[] };

export type RelatorioAnual = {
  ano: number;
  /** Só os meses com ação, em ordem. */
  meses: MesDoRelatorio[];
  /** Meses já encerrados em que nenhuma ação aconteceu — cancelada não
   *  conta como acontecida, mesmo quando está na lista. */
  mesesSemAcao: string[];
  total: {
    acoes: number;
    realizadas: number;
    /** Planejadas e em andamento. */
    agendadas: number;
    canceladas: number;
    destaques: number;
    /** Dias do ano com alguma ação — cada dia conta uma vez. */
    diasComAcao: number;
  };
};

const UM_DIA_MS = 86_400_000;

/**
 * `hoje` é a chave do dia em São Paulo e só decide quais meses já terminaram:
 * dizer "nenhuma ação em novembro" no meio de outubro seria anunciar uma
 * lacuna que ainda não existe.
 */
export function montarRelatorioAnual(
  acoes: AcaoDoAno[],
  ano: number,
  hoje: string,
): RelatorioAnual {
  const primeiroDoAno = `${ano}-01-01`;
  const ultimoDoAno = `${ano}-12-31`;

  const porMes = new Map<string, AcaoNoRelatorio[]>();
  const diasDoAno = new Set<string>();
  const total = {
    acoes: acoes.length,
    realizadas: 0,
    agendadas: 0,
    canceladas: 0,
    destaques: 0,
    diasComAcao: 0,
  };

  for (const acao of acoes) {
    const primeiroDia = diaNoFuso(acao.dataInicio);
    const ultimoDia = diaNoFuso(acao.dataFim);
    const linha: AcaoNoRelatorio = {
      ...acao,
      primeiroDia,
      ultimoDia,
      quantidadeDeDias:
        Math.round(
          (dataDaChave(ultimoDia).getTime() - dataDaChave(primeiroDia).getTime()) /
            UM_DIA_MS,
        ) + 1,
    };

    /* A ação entra no mês em que começou. A que começou no ano anterior abre
       janeiro, que é o primeiro mês deste ano em que ela aconteceu — o mesmo
       critério de sobreposição da consulta, que a trouxe para cá. */
    const mes = primeiroDia < primeiroDoAno ? `${ano}-01` : primeiroDia.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), linha]);

    if (acao.status === "cancelado") {
      total.canceladas += 1;
      continue;
    }
    if (acao.status === "realizado") total.realizadas += 1;
    else total.agendadas += 1;
    if (acao.destaqueRegional) total.destaques += 1;

    // Só os dias dentro do ano, e no máximo 366: uma data de término digitada
    // com o ano errado não pode virar milhares de chaves.
    const de = primeiroDia < primeiroDoAno ? primeiroDoAno : primeiroDia;
    const ate = ultimoDia > ultimoDoAno ? ultimoDoAno : ultimoDia;
    for (const dia of diasEntre(de, ate)) diasDoAno.add(dia);
  }

  total.diasComAcao = diasDoAno.size;

  const mesesComAcao = new Set([...diasDoAno].map((dia) => dia.slice(0, 7)));
  const mesCorrente = hoje.slice(0, 7);
  const mesesSemAcao = Array.from(
    { length: 12 },
    (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`,
  ).filter((mes) => mes < mesCorrente && !mesesComAcao.has(mes));

  return {
    ano,
    meses: [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, lista]) => ({ chave, acoes: lista })),
    mesesSemAcao,
    total,
  };
}

/* ─── Como se escreve ────────────────────────────────────────────────────── */

/*
 * Tudo no relógio de São Paulo, como os formatadores de `lib/format.ts`: esta
 * tela e o CSV saem do servidor, que está em UTC — no fuso de quem roda, a
 * ação das 8h sairia às 11h, e a das 22h, no dia seguinte. O período de cada
 * ação é o `formatarPeriodo` comum; aqui ficam só os dias exatos, que são
 * conta de calendário sobre as chaves.
 */

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaDaSemana = (chave: string) => SEMANA[dataDaChave(chave).getUTCDay()];
const diaMes = (chave: string) => `${chave.slice(8)}/${chave.slice(5, 7)}`;
const diaMesAno = (chave: string) => `${diaMes(chave)}/${chave.slice(0, 4)}`;

const nomeDoMesUtc = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});

/** "Setembro", da chave `"2026-09"`. */
export function nomeDoMes(mes: string) {
  const nome = nomeDoMesUtc.format(dataDaChave(`${mes}-01`));
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** "março e julho", "março, maio e julho". */
export function listarMeses(meses: string[]) {
  const nomes = meses.map((mes) => nomeDoMes(mes).toLowerCase());
  return nomes.length > 1
    ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`
    : (nomes[0] ?? "");
}

/** Até uma semana de ação, cada dia aparece listado. */
export const DIAS_LISTADOS = 7;

/**
 * Os dias exatos da ação: "sex 05/09, sáb 06/09, dom 07/09".
 *
 * A ação ocupa dias seguidos — o cadastro guarda início e fim, não encontros
 * avulsos —, então a faixa já é a resposta exata. Até uma semana, cada dia vai
 * listado com o dia da semana, que é o que o regional pergunta ("foi no
 * domingo?"). Além disso, trinta datas numa célula esconderiam a informação
 * em vez de dá-la: vale a faixa com a contagem.
 */
export function rotuloDosDias(
  acao: AcaoNoRelatorio,
  { comAno = false }: { comAno?: boolean } = {},
) {
  const data = comAno ? diaMesAno : diaMes;
  if (acao.quantidadeDeDias > DIAS_LISTADOS) {
    return `${data(acao.primeiroDia)} a ${data(acao.ultimoDia)}, ${acao.quantidadeDeDias} dias seguidos`;
  }
  return diasEntre(acao.primeiroDia, acao.ultimoDia)
    .map((dia) => `${diaDaSemana(dia)} ${data(dia)}`)
    .join(", ");
}

/* ─── Exportação ─────────────────────────────────────────────────────────── */

const ROTULO_DA_SITUACAO: Record<string, string> = Object.fromEntries(
  STATUS_EVENTO.map((s) => [s.valor, s.rotulo]),
);

/**
 * Uma tabela só, uma ação por linha, com o mês como coluna: é a forma que o
 * Excel filtra e agrupa sem ninguém precisar desfazer seções à mão. Início e
 * término vão em colunas próprias, com data e hora, e os dias exatos levam o
 * ano — fora da tela, a planilha circula sem o título que dizia qual era.
 */
export function relatorioAnualParaCsv(
  relatorio: RelatorioAnual,
  missaoNome?: string,
) {
  const linhas: string[] = [];

  linhas.push(
    celula(
      `Relatório anual de ${relatorio.ano}${missaoNome ? ` · ${missaoNome}` : ""}`,
    ),
  );
  linhas.push("");

  const cabecalho = [
    "Mês",
    "Ação",
    "Categoria",
    "Missão",
    "Centro",
    "Local",
    "Início",
    "Término",
    "Dias",
    "Dias de realização",
    "Situação",
    "Destaque regional",
  ];
  linhas.push(cabecalho.map(celula).join(";"));

  for (const mes of relatorio.meses) {
    for (const acao of mes.acoes) {
      linhas.push(
        [
          celula(nomeDoMes(mes.chave)),
          celula(acao.titulo),
          celula(acao.tipoNome),
          celula(acao.missaoNome),
          celula(acao.centroNome),
          celula(acao.local ?? ""),
          celula(`${diaMesAno(acao.primeiroDia)} ${horaNoFuso(acao.dataInicio)}`),
          celula(`${diaMesAno(acao.ultimoDia)} ${horaNoFuso(acao.dataFim)}`),
          acao.quantidadeDeDias,
          celula(rotuloDosDias(acao, { comAno: true })),
          celula(ROTULO_DA_SITUACAO[acao.status] ?? acao.status),
          acao.destaqueRegional ? "Sim" : "Não",
        ].join(";"),
      );
    }
  }

  linhas.push("");
  const { total } = relatorio;
  const totais: [string, number][] = [
    ["Ações no ano", total.acoes],
    ["Realizadas", total.realizadas],
    ["Agendadas", total.agendadas],
    // Só quando há: sem a opção de incluí-las, "Canceladas: 0" afirmaria que
    // nenhuma foi cancelada — e elas só ficaram de fora.
    ...(total.canceladas > 0
      ? [["Canceladas", total.canceladas] as [string, number]]
      : []),
    ["Destaques regionais", total.destaques],
    ["Dias com ação", total.diasComAcao],
  ];
  for (const [rotulo, valor] of totais) {
    linhas.push([celula(rotulo), valor].join(";"));
  }

  return BOM + linhas.join("\r\n");
}

export function nomeDoArquivoAnual(relatorio: RelatorioAnual) {
  return `relatorio-anual-${relatorio.ano}.csv`;
}
