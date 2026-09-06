import type { FiltrosRelatorio } from "./queries";

type Parametros = Record<string, string | string[] | undefined>;

const texto = (p: Parametros, chave: string) => {
  const v = p[chave];
  return typeof v === "string" && v ? v : undefined;
};

const dataOu = (valor: string | undefined, padrao: Date) => {
  if (!valor || Number.isNaN(Date.parse(valor))) return padrao;
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1);
};

/** Leitura única dos filtros, compartilhada pela página e pela exportação —
 *  assim o CSV traz exatamente o que está na tela.
 *
 *  A missão não vem da URL: é a missão em foco, escolhida na barra lateral e
 *  válida para o acompanhamento inteiro. Chega por parâmetro para esta função
 *  continuar pura, e é justamente por a página e a rota de exportação lerem o
 *  mesmo foco que a promessa acima segue de pé. */
export function lerFiltros(
  parametros: Parametros,
  missaoId?: string,
): FiltrosRelatorio {
  const hoje = new Date();
  const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);

  const de = dataOu(texto(parametros, "de"), inicioDoAno);
  const ate = dataOu(texto(parametros, "ate"), hoje);
  ate.setHours(23, 59, 59, 999);

  return {
    de,
    ate: ate >= de ? ate : new Date(de.getFullYear(), de.getMonth(), de.getDate(), 23, 59, 59, 999),
    missaoId,
    tipoEventoId: texto(parametros, "tipo"),
    incluirCancelados: texto(parametros, "cancelados") === "1",
  };
}

export function paraQueryString(filtros: FiltrosRelatorio) {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const p = new URLSearchParams({ de: iso(filtros.de), ate: iso(filtros.ate) });
  if (filtros.tipoEventoId) p.set("tipo", filtros.tipoEventoId);
  if (filtros.incluirCancelados) p.set("cancelados", "1");
  return p.toString();
}
