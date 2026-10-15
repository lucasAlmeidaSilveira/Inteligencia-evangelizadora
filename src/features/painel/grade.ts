import { dataDaChave, diaNoFuso, diasEntre, somarDias } from "@/lib/fuso";

/**
 * A grade do calendário mensal, em chaves de dia.
 *
 * Mora fora do componente para ser a mesma conta no servidor, que renderiza o
 * HTML em UTC, e no navegador, que hidrata em São Paulo. A versão anterior
 * recebia o mês como `Date` e montava a grade no fuso de quem rodava: o
 * servidor desenhava setembro e o navegador redesenhava agosto por cima — a
 * ação de 6 de setembro sumia, e a do dia 1º aparecia esmaecida como se fosse
 * do mês seguinte. Partindo da chave `"2026-09"`, os dois lados chegam aos
 * mesmos dias sem perguntar o fuso a ninguém.
 */

export type DiaDaGrade = {
  /** `"2026-09-06"` — compara com `diaNoFuso` como texto. */
  chave: string;
  numero: number;
  /** Fora do mês exibido, o dia entra esmaecido para completar a semana. */
  doMes: boolean;
};

/** De domingo a sábado, para as semanas ficarem completas. */
export function diasDaGrade(mes: string): DiaDaGrade[] {
  const primeiro = `${mes}-01`;
  const [ano, numero] = mes.split("-").map(Number);
  // Dia 0 do mês seguinte é o último deste — sem tabela de 28/30/31.
  const ultimo = `${mes}-${String(new Date(Date.UTC(ano, numero, 0)).getUTCDate()).padStart(2, "0")}`;

  const inicio = somarDias(primeiro, -dataDaChave(primeiro).getUTCDay());
  const fim = somarDias(ultimo, 6 - dataDaChave(ultimo).getUTCDay());

  return diasEntre(inicio, fim).map((chave) => ({
    chave,
    numero: Number(chave.slice(8)),
    doMes: chave.startsWith(mes),
  }));
}

type DiasDaAcao = { primeiroDia: string; ultimoDia: string };

export type ComDias<E> = E & DiasDaAcao;

/**
 * O primeiro e o último dia da ação em São Paulo.
 *
 * Por dia, não por instante: "a ação ocupa o dia 6" é pergunta de calendário,
 * e a resposta precisa ser a mesma no servidor e no navegador. Uma ação que
 * atravessa a virada ocupa todos os dias entre as duas pontas.
 */
export function diasDaAcao<E extends { dataInicio: string; dataFim: string }>(
  evento: E,
): ComDias<E> {
  return {
    ...evento,
    primeiroDia: diaNoFuso(evento.dataInicio),
    ultimoDia: diaNoFuso(evento.dataFim),
  };
}

export function ocorreNoDia(evento: DiasDaAcao, chave: string) {
  return evento.primeiroDia <= chave && chave <= evento.ultimoDia;
}

/** Toca o mês se começa nele, termina nele ou o atravessa. */
export function tocaOMes(evento: DiasDaAcao, mes: string) {
  return (
    evento.primeiroDia.slice(0, 7) <= mes && mes <= evento.ultimoDia.slice(0, 7)
  );
}

/** "setembro de 2026", da chave — formatado em UTC porque `dataDaChave` é
 *  meia-noite UTC, e qualquer outro fuso poderia recuar para o mês anterior. */
export function rotuloDoMes(mes: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dataDaChave(`${mes}-01`));
}

/** "domingo, 06 de setembro", da chave — pelo mesmo motivo, em UTC. */
export function rotuloDoDia(chave: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(dataDaChave(chave));
}
