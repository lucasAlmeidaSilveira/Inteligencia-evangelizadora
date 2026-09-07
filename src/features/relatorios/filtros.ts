import { chaveDoDia, lerPeriodo } from "@/lib/periodo";

import type { FiltrosRelatorio } from "./queries";

type Parametros = Record<string, string | string[] | undefined>;

const texto = (p: Parametros, chave: string) => {
  const v = p[chave];
  return typeof v === "string" && v ? v : undefined;
};

/** O ano corrente até hoje: a prestação de contas que a tela existe para
 *  responder. Um recorte menor por padrão esconderia ações já realizadas. */
function padraoDoAno() {
  const hoje = new Date();
  return {
    de: new Date(hoje.getFullYear(), 0, 1),
    ate: new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
      999,
    ),
  };
}

/** Leitura única dos filtros, compartilhada pela página e pela exportação —
 *  assim o CSV traz exatamente o que está na tela.
 *
 *  O período vem de `lib/periodo.ts`, o mesmo que o painel e as ações usam:
 *  ali moram a validação, o fim de dia em 23:59:59.999 e o intervalo invertido.
 *  Aqui fica só o padrão, que é o que distingue esta tela das outras.
 *
 *  A missão não vem da URL: é a missão em foco, escolhida na barra lateral e
 *  válida para o acompanhamento inteiro. Chega por parâmetro para esta função
 *  continuar pura, e é justamente por a página e a rota de exportação lerem o
 *  mesmo foco que a promessa acima segue de pé. */
export function lerFiltros(
  parametros: Parametros,
  missaoId?: string,
): FiltrosRelatorio {
  /* Sem `permiteVazio` no seletor desta tela, "sem recorte" não é estado
     alcançável: o `!` diz o que o tipo `FiltrosRelatorio` já exige. */
  const periodo = lerPeriodo(parametros, padraoDoAno())!;

  return {
    de: periodo.de,
    ate: periodo.ate,
    missaoId,
    tipoEventoId: texto(parametros, "tipo"),
    incluirCancelados: texto(parametros, "cancelados") === "1",
  };
}

export function paraQueryString(filtros: FiltrosRelatorio) {
  const p = new URLSearchParams({
    de: chaveDoDia(filtros.de),
    ate: chaveDoDia(filtros.ate),
  });
  if (filtros.tipoEventoId) p.set("tipo", filtros.tipoEventoId);
  if (filtros.incluirCancelados) p.set("cancelados", "1");
  return p.toString();
}
