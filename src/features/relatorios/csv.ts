import { formatarData } from "@/lib/format";
import { diaNoFuso } from "@/lib/fuso";

import type { Relatorio } from "./queries";

/**
 * CSV no dialeto que o Excel brasileiro entende.
 *
 * Três detalhes que decidem se o arquivo abre certo ou vira uma coluna só de
 * texto ilegível: separador ponto e vírgula (a vírgula é decimal aqui),
 * decimal com vírgula, e um BOM no início — sem ele o Excel lê UTF-8 como
 * Latin-1 e "Ação" vira "AÃ§Ã£o".
 */
export const BOM = "\uFEFF";

/* Exportada, com o BOM, para o relat\u00F3rio anual (`anual.ts`) escrever no mesmo
   dialeto: duas c\u00F3pias da regra de aspas divergiriam na primeira corre\u00E7\u00E3o. */
export function celula(valor: string | number) {
  const texto = String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const dinheiro = (v: number) => v.toFixed(2).replace(".", ",");
// No relógio de São Paulo, como a tela: o arquivo sai do servidor, em UTC.
const data = (d: Date) => formatarData(d);
/* Vazio, não "0", quando não há informação: no Excel, zero entra na média e
   um "sem pesquisa" viraria nota mínima. */
const nota = (v: number | null) => (v === null ? "" : v.toFixed(1).replace(".", ","));
const indice = (v: number | null) => (v === null ? "" : String(Math.round(v)));

export function relatorioParaCsv(relatorio: Relatorio) {
  const linhas: string[] = [];

  linhas.push(
    celula(
      `Relatório de ${data(relatorio.periodo.de)} a ${data(relatorio.periodo.ate)}`,
    ),
  );
  linhas.push("");

  const cabecalho = [
    "Nome",
    "Ações",
    "Participantes",
    "Servos engajados",
    "Receitas",
    "Despesas",
    "Saldo",
    "NPS médio",
    "Ações com NPS",
    "Índice de impacto",
    "Ações com índice",
  ];

  const secao = (titulo: string, dados: Relatorio["porMissao"]) => {
    linhas.push(celula(titulo));
    linhas.push(cabecalho.map(celula).join(";"));
    for (const l of dados) {
      linhas.push(
        [
          celula(l.nome),
          l.acoes,
          l.participantes,
          l.servos,
          dinheiro(l.receitas),
          dinheiro(l.despesas),
          dinheiro(l.saldo),
          nota(l.nps),
          l.comNps,
          indice(l.impacto),
          l.comImpacto,
        ].join(";"),
      );
    }
    linhas.push("");
  };

  secao("Por missão", relatorio.porMissao);
  secao("Por tipo de ação", relatorio.porTipo);

  linhas.push(celula("Total"));
  linhas.push(cabecalho.map(celula).join(";"));
  linhas.push(
    [
      celula("Geral"),
      relatorio.total.acoes,
      relatorio.total.participantes,
      relatorio.total.servos,
      dinheiro(relatorio.total.receitas),
      dinheiro(relatorio.total.despesas),
      dinheiro(relatorio.total.saldo),
      nota(relatorio.total.nps),
      relatorio.total.comNps,
      indice(relatorio.total.impacto),
      relatorio.total.comImpacto,
    ].join(";"),
  );

  return BOM + linhas.join("\r\n");
}

export function nomeDoArquivo(relatorio: Relatorio) {
  /* Pelo dia em São Paulo, não por `toISOString`: o recorte termina em
     23:59:59.999 de lá, que em UTC já é o dia seguinte — o arquivo de
     setembro se chamaria "a-2026-10-01". */
  return `relatorio-${diaNoFuso(relatorio.periodo.de)}-a-${diaNoFuso(relatorio.periodo.ate)}.csv`;
}
