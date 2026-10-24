import {
  calcularImpacto,
  faixaDoImpacto,
  formatarIndice,
  formatarNps,
  mediaDeImpacto,
  mediaDeNps,
  pontuarFinanceiro,
} from "@/features/eventos/impacto";
import {
  contarComentarios,
  descreverFonte,
  FAIXAS_DE_NOTA,
  fraseDeLeitura,
  percentual,
  resumirSatisfacao,
  SEM_RESPOSTAS,
} from "@/features/pesquisas/satisfacao";

/**
 * Confere o Índice de Impacto Evangelizador contra números escolhidos a dedo.
 *
 *   pnpm testar:impacto
 *
 * Puro, sem banco: o índice é conta sobre o que já foi lido. O que se protege
 * aqui é o que falha em silêncio — um componente ausente contado como zero
 * rebaixaria toda ação antiga sem erro nenhum, e um peso somado errado
 * mudaria o ranking entre ações sem ninguém notar.
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

const arredondar = (n: number | null) =>
  n === null ? null : Math.round(n * 100) / 100;

const semMovimento = { receitas: 0, despesas: 0, saldo: 0 };

console.log("\nComponente financeiro");
ok("sem lançamento algum é sem informação", pontuarFinanceiro(semMovimento, null), null);
ok(
  "receitas cobrem as despesas, sem orçamento: 100",
  pontuarFinanceiro({ receitas: 1000, despesas: 800, saldo: 200 }, null),
  100,
);
ok(
  "receitas cobrem metade das despesas: 50",
  pontuarFinanceiro({ receitas: 400, despesas: 800, saldo: -400 }, null),
  50,
);
ok(
  "só receita, nenhuma despesa: 100",
  pontuarFinanceiro({ receitas: 300, despesas: 0, saldo: 300 }, null),
  100,
);
ok(
  "gasto exatamente no orçamento não é estouro",
  pontuarFinanceiro({ receitas: 1000, despesas: 1000, saldo: 0 }, "1000.00"),
  100,
);
ok(
  "estouro de 30% do orçamento tira 30 pontos",
  pontuarFinanceiro({ receitas: 2000, despesas: 1300, saldo: 700 }, "1000.00"),
  70,
);
ok(
  "vale a pior das duas: coberto, mas estourado em 100%",
  pontuarFinanceiro({ receitas: 5000, despesas: 2000, saldo: 3000 }, "1000.00"),
  0,
);
ok(
  "orçamento zerado não gera percentual, e não pune",
  pontuarFinanceiro({ receitas: 100, despesas: 50, saldo: 50 }, "0.00"),
  100,
);

console.log("\nÍndice completo");
const completa = calcularImpacto({
  participantesInscritos: 200,
  participantesTotal: 160, // 80% de comparecimento
  participantesNovos: 60,
  participantesPermaneceram: 40, // 25% de permanência
  nps: "9.0", // 90
  orcamentoPrevisto: null,
  financeiro: { receitas: 1000, despesas: 800, saldo: 200 }, // 100
});
ok(
  "componentes na escala de 0 a 100",
  completa.componentes,
  { permanencia: 25, satisfacao: 90, engajamento: 80, financeiro: 100 },
);
// 25×35 + 90×25 + 80×20 + 100×20 = 875 + 2250 + 1600 + 2000 = 6725 → 67,25
ok("média ponderada pelos pesos 35/25/20/20", arredondar(completa.indice), 67.25);
ok("nada falta", completa.faltam, []);

console.log("\nÍndice parcial");
const semPesquisaNemContas = calcularImpacto({
  participantesInscritos: 100,
  participantesTotal: 100,
  participantesNovos: 10,
  participantesPermaneceram: 50,
  nps: null,
  orcamentoPrevisto: null,
  financeiro: semMovimento,
});
ok(
  "o que falta fica como null, não zero",
  semPesquisaNemContas.componentes,
  { permanencia: 50, satisfacao: null, engajamento: 100, financeiro: null },
);
// Só permanência (35) e engajamento (20): (50×35 + 100×20) ÷ 55 = 3750 ÷ 55
ok(
  "pesos renormalizados sobre o que existe",
  arredondar(semPesquisaNemContas.indice),
  68.18,
);
ok(
  "lista o que falta, na ordem de peso",
  semPesquisaNemContas.faltam,
  ["satisfacao", "financeiro"],
);

ok(
  "ação sem informação alguma não tem índice",
  calcularImpacto({
    participantesInscritos: 0,
    participantesTotal: 0,
    participantesNovos: 0,
    participantesPermaneceram: 0,
    nps: null,
    orcamentoPrevisto: null,
    financeiro: semMovimento,
  }).indice,
  null,
);

console.log("\nBordas da escala");
const bordas = calcularImpacto({
  participantesInscritos: 50,
  participantesTotal: 80, // 160% de comparecimento, limitado a 100
  participantesNovos: 0,
  participantesPermaneceram: 0, // 0% é informação, não ausência
  nps: "0.0", // nota zero é informação, não ausência
  orcamentoPrevisto: null,
  financeiro: semMovimento,
});
ok("comparecimento acima de 100% é limitado a 100", bordas.componentes.engajamento, 100);
ok("permanência zero conta como zero", bordas.componentes.permanencia, 0);
ok("NPS zero conta como zero, não como ausente", bordas.componentes.satisfacao, 0);
ok("NPS numérico também é aceito", calcularImpacto({
  participantesInscritos: 0,
  participantesTotal: 0,
  participantesNovos: 0,
  participantesPermaneceram: 0,
  nps: 7.5,
  orcamentoPrevisto: null,
  financeiro: semMovimento,
}).componentes.satisfacao, 75);

console.log("\nMédias do relatório");
ok("média só de quem tem índice", mediaDeImpacto([80, null, 60]), { media: 70, comIndice: 2 });
ok("sem índice algum", mediaDeImpacto([null, null]), { media: null, comIndice: 0 });
ok(
  "NPS como volta do banco (string) e ausente",
  mediaDeNps(["8.0", null, "9.0", ""]),
  { media: 8.5, comNps: 2 },
);

console.log("\nFormatação");
ok("índice arredonda para inteiro", formatarIndice(67.25), "67");
ok("índice ausente é travessão", formatarIndice(null), "—");
ok("NPS com vírgula", formatarNps("8.7"), "8,7");
ok("NPS inteiro sem casa decimal", formatarNps("10.0"), "10");
ok("NPS ausente é travessão", formatarNps(null), "—");
ok("faixa alta a partir de 90", faixaDoImpacto(90)?.rotulo, "Alto");
ok("faixa média a partir de 70", faixaDoImpacto(70)?.rotulo, "Médio");
ok("abaixo de 70 é baixa", faixaDoImpacto(69.9)?.rotulo, "Baixo");
ok("sem índice, sem faixa", faixaDoImpacto(null), null);

console.log("\nSatisfação efetiva (pesquisa × nota manual)");
const manual = resumirSatisfacao(undefined, "8.0");
ok("sem respostas, vale a nota manual", [manual.nota, manual.fonte], [8, "manual"]);
ok("fonte manual se descreve", descreverFonte(manual), "informada manualmente");

const comRespostas = resumirSatisfacao(
  {
    quantidade: 3,
    soma: 26, // 9 + 9 + 8 → 8,666…
    promotores: 2,
    detratores: 0,
    comentarios: 1,
    distribuicao: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0],
  },
  "5.0",
);
ok("a contagem de comentários atravessa o resumo", comRespostas.comentarios, 1);

console.log("\nComentários e respostas juntos");
ok("sem respostas", contarComentarios({ respostas: 0, comentarios: 0 }), "Nenhuma resposta ainda");
ok(
  "respostas sem comentário",
  contarComentarios({ respostas: 3, comentarios: 0 }),
  "Nenhum comentário em 3 respostas",
);
ok(
  "singular dos dois lados",
  contarComentarios({ respostas: 1, comentarios: 1 }),
  "1 comentário em 1 resposta",
);
ok(
  "plural",
  contarComentarios({ respostas: 40, comentarios: 12 }),
  "12 comentários em 40 respostas",
);
ok(
  "as faixas cobrem 0 a 10 sem buraco nem sobreposição",
  FAIXAS_DE_NOTA.flatMap((f) =>
    Array.from({ length: f.ate - f.de + 1 }, (_, i) => f.de + i),
  ),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);
ok(
  "com respostas, a pesquisa vence a nota manual e arredonda a uma casa",
  [comRespostas.nota, comRespostas.fonte, comRespostas.respostas],
  [8.7, "pesquisa", 3],
);
ok("fonte pesquisa conta as respostas", descreverFonte(comRespostas), "3 respostas");
ok(
  "frase de leitura por faixas",
  fraseDeLeitura(comRespostas),
  "67% deram 9 ou 10 · 0% deram 6 ou menos",
);
ok("uma resposta, no singular", descreverFonte(resumirSatisfacao({ ...SEM_RESPOSTAS, quantidade: 1, soma: 10 }, null)), "1 resposta");

const nada = resumirSatisfacao(SEM_RESPOSTAS, null);
ok("sem nada, não há nota nem fonte", [nada.nota, nada.fonte], [null, null]);
ok("sem nada se descreve como sem pesquisa", descreverFonte(nada), "Sem pesquisa");
ok("sem respostas não há frase", fraseDeLeitura(manual), null);
ok("percentual sem base é null", percentual(3, 0), null);
ok("percentual com base", percentual(1, 4), 25);
ok(
  "o índice usa a nota efetiva: 8,7 vira 87 de satisfação",
  calcularImpacto({
    participantesInscritos: 0,
    participantesTotal: 0,
    participantesNovos: 0,
    participantesPermaneceram: 0,
    nps: comRespostas.nota,
    orcamentoPrevisto: null,
    financeiro: semMovimento,
  }).componentes.satisfacao,
  87,
);

if (falhas) {
  console.error(`\n✗ ${falhas} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("\n✓ Índice de impacto calcula o esperado.\n");
