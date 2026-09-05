import type { Relatorio } from "./queries";

/**
 * CSV no dialeto que o Excel brasileiro entende.
 *
 * Três detalhes que decidem se o arquivo abre certo ou vira uma coluna só de
 * texto ilegível: separador ponto e vírgula (a vírgula é decimal aqui),
 * decimal com vírgula, e um BOM no início — sem ele o Excel lê UTF-8 como
 * Latin-1 e "Ação" vira "AÃ§Ã£o".
 */
const BOM = "\uFEFF";

function celula(valor: string | number) {
  const texto = String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const dinheiro = (v: number) => v.toFixed(2).replace(".", ",");
const data = (d: Date) => d.toLocaleDateString("pt-BR");

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
    ].join(";"),
  );

  return BOM + linhas.join("\r\n");
}

export function nomeDoArquivo(relatorio: Relatorio) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return `relatorio-${iso(relatorio.periodo.de)}-a-${iso(relatorio.periodo.ate)}.csv`;
}
