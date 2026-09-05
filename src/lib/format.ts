import { format, formatDistanceToNowStrict, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const FUSO = "America/Sao_Paulo";

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

export function formatarData(data: string | Date) {
  return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataHora(data: string | Date) {
  return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatarCompetencia(data: string | Date) {
  return format(new Date(data), "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatarRelativo(data: string | Date) {
  return formatDistanceToNowStrict(new Date(data), {
    locale: ptBR,
    addSuffix: true,
  });
}

/** Período de um evento, sem repetir o que já está óbvio:
 *  mesmo dia → "12/03/2026, 09:00 às 17:00"
 *  dias diferentes → "12/03/2026 09:00 até 14/03/2026 17:00" */
export function formatarPeriodo(inicio: string | Date, fim: string | Date) {
  const a = new Date(inicio);
  const b = new Date(fim);

  if (isSameDay(a, b)) {
    return `${format(a, "dd/MM/yyyy", { locale: ptBR })}, ${format(a, "HH:mm")} às ${format(b, "HH:mm")}`;
  }

  return `${format(a, "dd/MM/yyyy HH:mm", { locale: ptBR })} até ${format(b, "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
}

export function formatarTamanhoArquivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { FUSO };
