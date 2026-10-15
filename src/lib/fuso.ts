/** O fuso das missões. `lib/format.ts` o reexporta. */
export const FUSO = "America/Sao_Paulo";

/**
 * Que dia é em São Paulo — perguntado do mesmo jeito no servidor e no
 * navegador.
 *
 * Existe por um bug real: em produção, o calendário de setembro desenhava a
 * grade de agosto, e a ação do dia 6 não aparecia em mês nenhum. O servidor da
 * Vercel roda em UTC e o navegador em São Paulo; o `Date` que a página montava
 * como "1º de setembro, meia-noite" chegava ao Client Component como 31 de
 * agosto, 21h — o mesmo instante, lido em outro relógio. Em desenvolvimento
 * nada disso aparece, porque as duas pontas rodam no mesmo fuso.
 *
 * Daí a regra: **dia não atravessa a fronteira como `Date`.** Viaja como chave
 * (`"2026-09-06"`, a mesma forma de `chaveDoDia`), e a pergunta "em que dia
 * cai este instante?" se faz no fuso das missões, nunca no da máquina que por
 * acaso está rodando o código.
 */

const dois = (n: number) => String(n).padStart(2, "0");

const UM_DIA_MS = 86_400_000;

/* `hourCycle: "h23"` e não `hour12: false`: com o segundo, há motores que
   escrevem a meia-noite como "24", e o dia lido sairia um à frente. */
const relogio = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** O que o relógio de São Paulo marca num instante. `mes` vai de 1 a 12. */
export function relogioNoFuso(instante: Date) {
  const partes: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const parte of relogio.formatToParts(instante)) {
    if (parte.type !== "literal") partes[parte.type] = Number(parte.value);
  }
  return {
    ano: partes.year ?? 0,
    mes: partes.month ?? 0,
    dia: partes.day ?? 0,
    hora: partes.hour ?? 0,
    minuto: partes.minute ?? 0,
    segundo: partes.second ?? 0,
  };
}

/** O dia de um instante em São Paulo, como `"2026-09-06"`. Compara com outras
 *  chaves como texto: a ordem alfabética delas é a ordem do calendário. */
export function diaNoFuso(instante: string | Date) {
  const r = relogioNoFuso(new Date(instante));
  return `${r.ano}-${dois(r.mes)}-${dois(r.dia)}`;
}

/** A hora de um instante em São Paulo, como `"08:00"`. */
export function horaNoFuso(instante: string | Date) {
  const r = relogioNoFuso(new Date(instante));
  return `${dois(r.hora)}:${dois(r.minuto)}`;
}

/** O que o relógio de São Paulo marca num instante, escrito como se fosse UTC.
 *  A diferença entre os dois é o deslocamento do fuso — hoje, -3h. */
function marcacao(instante: number) {
  const r = relogioNoFuso(new Date(instante));
  // O relógio não mostra milissegundos; eles passam como estão.
  const milissegundos = instante - Math.floor(instante / 1000) * 1000;
  return (
    Date.UTC(r.ano, r.mes - 1, r.dia, r.hora, r.minuto, r.segundo) +
    milissegundos
  );
}

/**
 * O instante em que o relógio de São Paulo marca esta data e hora — o inverso
 * de `diaNoFuso`, para limite de consulta. O 1º de janeiro do relatório anual
 * começa às 3h em UTC; a meia-noite UTC deixaria de fora a ação da noite de 31
 * de dezembro.
 *
 * O deslocamento depende do próprio instante, e o Brasil teve horário de verão
 * até 2019. Por isso dois candidatos — com o deslocamento de um dia antes e o
 * de um dia depois, que só diferem perto de uma troca — e vale o que o relógio
 * de fato marcou. Hora que existiu duas vezes (o fim do horário de verão)
 * fica com a primeira; hora que não existiu (o início, quando a meia-noite
 * pulava para 1h) fica com o instante em que o relógio voltou a andar — o
 * começo de verdade daquele dia.
 */
export function instanteNoFuso(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
  milissegundo = 0,
) {
  const pedido = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, milissegundo);
  const candidato = (sonda: number) => pedido - (marcacao(sonda) - sonda);

  const antes = candidato(pedido - UM_DIA_MS);
  const depois = candidato(pedido + UM_DIA_MS);
  const marcados = [antes, depois].filter((c) => marcacao(c) === pedido);

  return new Date(marcados.length > 0 ? Math.min(...marcados) : antes);
}

/* ─── O dia como limite de consulta ──────────────────────────────────────── */

/** Como o dia viaja na URL e entre componentes: `"2026-09-06"`. */
export const CHAVE_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O primeiro instante do dia em São Paulo, para `>=` em coluna `timestamp`.
 *
 * O dia que não existe (`"2026-13-40"`) vira `undefined` em vez de transbordar
 * para outro mês: `Date.UTC(2026, 12, 40)` não falha, mas o dia lido de volta
 * não seria o pedido — e é essa volta que separa data real de data que só
 * parece uma.
 */
export function inicioDoDia(chave: string) {
  if (!CHAVE_DE_DIA.test(chave)) return undefined;
  const [ano, mes, dia] = chave.split("-").map(Number);
  const instante = instanteNoFuso(ano, mes, dia);
  return diaNoFuso(instante) === chave ? instante : undefined;
}

/** O último instante do dia em São Paulo, para `<=`. Vai até 999
 *  milissegundos: parar em 23:59:59 deixaria de fora a ação marcada no último
 *  segundo do dia. */
export function fimDoDia(chave: string) {
  if (!inicioDoDia(chave)) return undefined;
  const [ano, mes, dia] = chave.split("-").map(Number);
  return instanteNoFuso(ano, mes, dia, 23, 59, 59, 999);
}

/* ─── Aritmética de dias ─────────────────────────────────────────────────── */

/* Feita em UTC porque é conta de calendário, não de relógio: em UTC nenhum dia
   tem 23 ou 25 horas, e nenhum some ou se repete numa troca de horário. */

function chaveUtc(data: Date) {
  return `${data.getUTCFullYear()}-${dois(data.getUTCMonth() + 1)}-${dois(data.getUTCDate())}`;
}

/** A chave como data à meia-noite UTC, para conta e para `Intl` com
 *  `timeZone: "UTC"` — nunca para comparar com instante de evento. */
export function dataDaChave(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Os dias de `de` a `ate`, inclusive, como chaves. */
export function diasEntre(de: string, ate: string) {
  const fim = dataDaChave(ate).getTime();
  const dias: string[] = [];
  for (let t = dataDaChave(de).getTime(); t <= fim; t += UM_DIA_MS) {
    dias.push(chaveUtc(new Date(t)));
  }
  return dias;
}

/** A chave `quantos` dias depois (ou antes, se negativo). */
export function somarDias(chave: string, quantos: number) {
  return chaveUtc(new Date(dataDaChave(chave).getTime() + quantos * UM_DIA_MS));
}

/* ─── O que o formulário digita ──────────────────────────────────────────── */

const DATETIME_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `"2026-09-06T08:00"` em instante ISO, lido no relógio de São Paulo.
 *
 * É o inverso exato de `paraDatetimeLocal` (`lib/format.ts`), que escreve
 * nesse mesmo relógio — e os dois precisam concordar porque rodam em lugares
 * diferentes: a página de edição monta o valor inicial no servidor, e o
 * formulário o devolve pelo navegador. Com cada um lendo o fuso da própria
 * máquina, a ação de 8h abriria às 11h na Vercel (UTC) e voltaria gravada às
 * 14h: três horas a cada salvamento, até mudar de dia. Fixando São Paulo nas
 * duas pontas, a ida e a volta se cancelam em qualquer máquina.
 *
 * O texto sem fuso nunca chega assim à Server Action: `new Date(texto)` lá
 * seria o relógio do servidor.
 */
export function paraInstante(datetimeLocal: string) {
  const m = DATETIME_LOCAL.exec(datetimeLocal);
  if (!m) return new Date(datetimeLocal).toISOString();
  const [, ano, mes, dia, hora, minuto, segundo] = m.map(Number);
  return instanteNoFuso(ano, mes, dia, hora, minuto, segundo || 0).toISOString();
}
