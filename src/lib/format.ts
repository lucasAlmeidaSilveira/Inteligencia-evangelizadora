import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  CHAVE_DE_DIA,
  dataDaChave,
  diaNoFuso,
  FUSO,
  horaNoFuso,
  relogioNoFuso,
} from "./fuso";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Valores monetários. Recebe number ou string — o Postgres devolve
 *  `numeric` como string para não perder precisão em valores grandes. */
export function formatarMoeda(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return moeda.format(0);
  return moeda.format(typeof valor === "string" ? Number(valor) : valor);
}

export function formatarNumero(valor: number | null | undefined) {
  return inteiro.format(valor ?? 0);
}

/** Variação percentual entre dois períodos. `null` quando não há base de
 *  comparação — mostrar "+∞%" ou "0%" seria mentir sobre o dado. */
export function variacaoPercentual(atual: number, anterior: number) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

/* ─── Datas ──────────────────────────────────────────────────────────────── */

/*
 * Tudo no relógio de São Paulo, nunca no de quem roda — ver `lib/fuso.ts`.
 * Estas funções rodam dos dois lados: no servidor, que na Vercel está em UTC,
 * e no navegador, em São Paulo. Com `date-fns/format`, que usa o fuso do
 * processo, a página da ação dizia "11:00" no HTML do servidor e "08:00" na
 * hidratação — horário errado na tela e texto divergente entre as duas pontas.
 *
 * Um valor só de dia (`"2026-09-06"`, o que uma coluna `date` devolve) é dia
 * do calendário, não instante: formata-se como está. `new Date("2026-09-06")`
 * seria meia-noite UTC, que em São Paulo ainda é dia 5 — a fundação da missão
 * e a competência recuariam um dia.
 */

const CHAVE_DE_MES = /^\d{4}-\d{2}$/;

type Valor = string | Date;

/** Ano, mês e dia do valor: lidos direto de uma chave, ou do relógio de São
 *  Paulo se for instante. */
function partesDoDia(valor: Valor) {
  if (typeof valor === "string" && CHAVE_DE_DIA.test(valor)) {
    const [ano, mes, dia] = valor.split("-").map(Number);
    return { ano, mes, dia };
  }
  if (typeof valor === "string" && CHAVE_DE_MES.test(valor)) {
    const [ano, mes] = valor.split("-").map(Number);
    return { ano, mes, dia: 1 };
  }
  return relogioNoFuso(new Date(valor));
}

const dois = (n: number) => String(n).padStart(2, "0");

const nomeDoMes = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});

/** "06/09/2026". Aceita instante (`Date` ou ISO) e chave de dia. */
export function formatarData(valor: Valor) {
  const { ano, mes, dia } = partesDoDia(valor);
  return `${dois(dia)}/${dois(mes)}/${ano}`;
}

/** "06/09/2026 às 08:00", no relógio de São Paulo. */
export function formatarDataHora(instante: Valor) {
  return `${formatarData(instante)} às ${horaNoFuso(instante)}`;
}

/** "setembro de 2026". Aceita instante, chave de dia e chave de mês
 *  (`"2026-09"`) — a competência é o mês, e chega das duas últimas formas. */
export function formatarCompetencia(valor: Valor) {
  const { ano, mes } = partesDoDia(valor);
  return `${nomeDoMes.format(dataDaChave(`${ano}-${dois(mes)}-01`))} de ${ano}`;
}

export function formatarRelativo(data: Valor) {
  return formatDistanceToNowStrict(new Date(data), {
    locale: ptBR,
    addSuffix: true,
  });
}

/** Período de um evento, sem repetir o que já está óbvio:
 *  mesmo dia → "12/03/2026, 09:00 às 17:00"
 *  dias diferentes → "12/03/2026 09:00 até 14/03/2026 17:00" */
export function formatarPeriodo(inicio: Valor, fim: Valor) {
  if (diaNoFuso(inicio) === diaNoFuso(fim)) {
    return `${formatarData(inicio)}, ${horaNoFuso(inicio)} às ${horaNoFuso(fim)}`;
  }
  return `${formatarData(inicio)} ${horaNoFuso(inicio)} até ${formatarData(fim)} ${horaNoFuso(fim)}`;
}

export function formatarTamanhoArquivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { FUSO };

/**
 * Converte para o formato aceito por `<input type="datetime-local">`, no
 * relógio de São Paulo — o input não entende deslocamento de fuso.
 *
 * Em São Paulo e não no fuso de quem roda porque a página de edição chama isto
 * no servidor, e o valor volta pelo navegador por `paraInstante`
 * (`lib/fuso.ts`): os dois lendo o mesmo relógio é o que faz a ida e a volta
 * se cancelarem em vez de deslocar a ação a cada salvamento.
 */
export function paraDatetimeLocal(data: Date | string) {
  return `${diaNoFuso(data)}T${horaNoFuso(data)}`;
}

/** Data no formato de `<input type="date">`, no relógio de São Paulo. */
export function paraDateInput(data: Date | string = new Date()) {
  return diaNoFuso(data);
}
