import { isSameDay } from "date-fns";

import { formatarCompetencia, formatarData } from "./format";
import { fimDoMes, inicioDoMes, intervaloDoMes, lerChaveDeMes } from "./mes";

/**
 * Período como recorte de leitura, numa definição só.
 *
 * Vive em `lib/` porque atravessa a fronteira: a página lê o recorte da URL no
 * servidor e monta os links dos cartões, enquanto o seletor monta os atalhos e
 * escreve a URL no navegador. Três lugares com a própria conta de "primeiro e
 * último instante do intervalo" acabariam discordando na virada — o cartão
 * diria 7 ações e a tela de destino mostraria 6, sem erro em lugar nenhum.
 *
 * Substituiu `?mes=` como vocabulário principal. `lib/mes.ts` continua vivo
 * para o calendário, cuja grade é de um mês por definição, e para converter os
 * links antigos que ainda chegam com `?mes=`.
 */

/** Como o dia viaja na URL: `?de=2026-09-06`. */
const CHAVE = /^\d{4}-\d{2}-\d{2}$/;

/** Recorte "sem fim": ausência de `de`/`ate` já significa outra coisa no
 *  painel, então o acumulado precisa de valor próprio. */
export const TODO_O_PERIODO = "tudo";

export type Periodo = { de: Date; ate: Date };

/** O dia na forma que vai para a URL. */
export function chaveDoDia(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Lê um `?de=`/`?ate=` da URL, que qualquer um edita.
 *
 * Montada por componentes locais, nunca por `new Date(texto)`: a string
 * `"2026-09-06"` é interpretada como UTC pelo construtor, e num fuso negativo
 * viraria dia 5 às 21h — o recorte perderia o primeiro dia.
 *
 * O que não é dia possível vira `undefined`. Sem isto, um "2026-13-40" chegaria
 * à consulta como `Invalid Date` numa comparação com coluna `timestamp`.
 */
export function lerChaveDeDia(valor: unknown) {
  if (typeof valor !== "string" || !CHAVE.test(valor)) return undefined;

  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);

  /* `new Date(2026, 12, 40)` não falha: transborda para outro mês. Comparar de
     volta é o que separa data real de data que só parece uma. */
  const real =
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia;

  return real ? data : undefined;
}

/* O fim vai até 999 milissegundos porque a comparação é `<=`: parar em
   23:59:59 deixaria de fora a ação marcada no último segundo do dia. É a mesma
   conta que `fimDoMes` faz, pelo mesmo motivo. */
function fimDoDia(data: Date) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate(),
    23,
    59,
    59,
    999,
  );
}

type Parametros = Record<string, string | string[] | undefined>;

const texto = (parametros: Parametros, chave: string) => {
  const valor = parametros[chave];
  return typeof valor === "string" && valor ? valor : undefined;
};

/**
 * Lê o recorte da URL.
 *
 * `padrao` é o que vale sem parâmetro nenhum, e é justamente onde as telas
 * discordam: o painel abre no mês corrente (a pergunta de quem entra uma vez
 * por mês), /eventos abre em todo o período. Por isso ele é argumento em vez de
 * constante — e por isso `?periodo=tudo` existe: onde a ausência já significa
 * um recorte, pedir o acumulado precisa de uma forma própria.
 *
 * `?mes=` ainda é aceito. Um link guardado ou mandado por e-mail em outubro
 * continua abrindo outubro; ignorá-lo levaria essa pessoa ao recorte padrão
 * sem avisar que o pedido dela foi descartado.
 */
export function lerPeriodo(
  parametros: Parametros,
  padrao?: Periodo,
): Periodo | undefined {
  if (texto(parametros, "periodo") === TODO_O_PERIODO) return undefined;

  const de = lerChaveDeDia(texto(parametros, "de"));
  const ate = lerChaveDeDia(texto(parametros, "ate"));

  if (de || ate) {
    /* Um lado só é intervalo válido: quem escolheu um dia no calendário e
       recarregou antes do segundo clique tem um começo, não um erro. */
    const inicio = de ?? ate!;
    const fim = ate ?? de!;
    // Invertido é engano de quem editou a URL, não pedido — vale o menor.
    return fim >= inicio
      ? { de: inicio, ate: fimDoDia(fim) }
      : { de: fim, ate: fimDoDia(inicio) };
  }

  const mes = lerChaveDeMes(texto(parametros, "mes"));
  if (mes) return intervaloDoMes(mes);

  return padrao;
}

/** Escreve o recorte na URL, no lugar do que estiver lá. */
export function escreverPeriodo(
  parametros: URLSearchParams,
  periodo: Periodo | undefined,
  { vazioEhTudo = false } = {},
) {
  /* O `?mes=` sai junto: deixá-lo para trás faria a URL carregar dois recortes
     e a leitura preferir o novo — o endereço diria uma coisa e a tela outra. */
  parametros.delete("mes");
  parametros.delete("periodo");
  parametros.delete("de");
  parametros.delete("ate");

  if (!periodo) {
    /* Só onde a ausência significa um recorte (o painel) o acumulado precisa
       ser dito. Nas outras telas ele já é o que sobra sem parâmetro. */
    if (vazioEhTudo) parametros.set("periodo", TODO_O_PERIODO);
    return;
  }

  parametros.set("de", chaveDoDia(periodo.de));
  parametros.set("ate", chaveDoDia(periodo.ate));
}

/**
 * O recorte reduzido a uma string estável.
 *
 * É o que viaja até as consultas cacheadas. O argumento compõe a chave do
 * `unstable_cache`, e a de um `Date` seria o instante em que a página montou —
 * uma entrada nova a cada visita, nenhum acerto. Ver `server/cache.ts`.
 */
export function chaveDoPeriodo(periodo: Periodo | undefined) {
  if (!periodo) return undefined;
  return `${chaveDoDia(periodo.de)}..${chaveDoDia(periodo.ate)}`;
}

/** Volta da chave ao intervalo, do outro lado do cache. */
export function lerChaveDePeriodo(chave: string | undefined) {
  if (!chave) return undefined;

  const [de, ate] = chave.split("..");
  const inicio = lerChaveDeDia(de);
  const fim = lerChaveDeDia(ate);

  return inicio && fim ? { de: inicio, ate: fimDoDia(fim) } : undefined;
}

/**
 * Os atalhos do seletor.
 *
 * `hoje` é argumento, e não `new Date()` aqui dentro, por causa da hidratação:
 * o servidor renderiza em UTC e o navegador em `America/Sao_Paulo`. Perto da
 * virada do dia os dois montariam atalhos diferentes para o mesmo HTML, e o
 * React trocaria a árvore inteira sem dizer por quê.
 */
export function atalhosDePeriodo(hoje: Date) {
  const dias = (quantos: number) =>
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - quantos);

  /* Dia 1 do mês anterior. Ancorar no dia 1, e não em `hoje`, evita o salto de
     31 de março para 3 de março que `setMonth(-1)` faria em fevereiro. */
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  return [
    { rotulo: "Hoje", de: dias(0), ate: dias(0) },
    { rotulo: "Ontem", de: dias(1), ate: dias(1) },
    { rotulo: "Última semana", de: dias(7), ate: dias(0) },
    { rotulo: "Últimos 30 dias", de: dias(30), ate: dias(0) },
    {
      rotulo: "Último mês",
      de: inicioDoMes(mesPassado),
      ate: fimDoMes(mesPassado),
    },
  ];
}

/**
 * Como o recorte se diz na tela.
 *
 * Prefere o nome do atalho ao par de datas: "Últimos 30 dias" responde à
 * pergunta que a pessoa fez, enquanto "07/08/2026 a 06/09/2026" obriga a
 * reconstruí-la de cabeça.
 */
export function rotuloDoPeriodo(
  periodo: Periodo | undefined,
  hoje: Date,
  vazio: string,
) {
  if (!periodo) return vazio;

  const atalho = atalhosDePeriodo(hoje).find(
    (a) => isSameDay(periodo.de, a.de) && isSameDay(periodo.ate, a.ate),
  );
  if (atalho) return atalho.rotulo;

  /* Um mês fechado se diz pelo nome. O painel abre no mês corrente por padrão,
     e "01/09/2026 a 30/09/2026" obrigaria a reconhecer setembro a partir das
     bordas — trabalho que o nome do mês poupa, na tela mais visitada. */
  if (
    isSameDay(periodo.de, inicioDoMes(periodo.de)) &&
    isSameDay(periodo.ate, fimDoMes(periodo.de))
  ) {
    const nome = formatarCompetencia(periodo.de);
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }

  if (isSameDay(periodo.de, periodo.ate)) return formatarData(periodo.de);
  return `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`;
}

/**
 * O recorte na forma que `SeletorPeriodo` entende.
 *
 * Datas viram texto na fronteira porque o seletor é Componente de Cliente:
 * `Date` atravessa a serialização como string de qualquer jeito, e declarar o
 * que de fato chega evita um `toLocaleDateString` no fuso do navegador.
 */
export function paraSeletor(periodo: { de?: Date; ate?: Date } | undefined) {
  if (!periodo?.de || !periodo.ate) return undefined;
  return { de: chaveDoDia(periodo.de), ate: chaveDoDia(periodo.ate) };
}

/** O recorte como sufixo de URL, para os cartões do painel levarem-no
 *  consigo. Sem ele o cartão diria um número e a tela de destino mostraria
 *  outro — a lista inteira, de todos os meses. */
export function sufixoDePeriodo(periodo: Periodo | undefined) {
  if (!periodo) return "";
  return `&de=${chaveDoDia(periodo.de)}&ate=${chaveDoDia(periodo.ate)}`;
}

/** O mês em que o recorte termina — a âncora das leituras por competência,
 *  que é mensal por natureza. */
export function competenciaDoFim(periodo: Periodo | undefined) {
  const referencia = periodo ? periodo.ate : new Date();
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

/**
 * Onde o calendário abre.
 *
 * Um mês antes do fim do recorte: com dois meses à vista, o painel da direita
 * cai justamente sobre o fim do período em vigor. Abrir no início deixaria um
 * recorte longo terminando fora da tela, e quem quisesse mudar só a data final
 * teria de navegar antes de enxergar o que está mudando.
 */
export function mesDeAbertura(periodo: Periodo | undefined, hoje: Date) {
  const referencia = periodo?.ate ?? hoje;
  return new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1);
}
