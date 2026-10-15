import { formatarCompetencia, formatarData } from "./format";
import {
  CHAVE_DE_DIA,
  diaNoFuso,
  fimDoDia,
  inicioDoDia,
  somarDias,
} from "./fuso";
import {
  deslocarMes,
  intervaloDoMes,
  lerChaveDeMes,
  ultimoDiaDoMes,
} from "./mes";

/**
 * Período como recorte de leitura, numa definição só.
 *
 * Vive em `lib/` porque atravessa a fronteira: a página lê o recorte da URL no
 * servidor e monta os links dos cartões, enquanto o seletor monta os atalhos e
 * escreve a URL no navegador. Três lugares com a própria conta de "primeiro e
 * último instante do intervalo" acabariam discordando na virada — o cartão
 * diria 7 ações e a tela de destino mostraria 6, sem erro em lugar nenhum.
 *
 * O dia viaja como chave (`"2026-09-06"`) e só vira instante na borda da
 * consulta, no relógio de São Paulo (`lib/fuso.ts`). Antes era `Date` montado
 * pelos componentes locais, e o servidor da Vercel, em UTC, abria o recorte
 * três horas antes do dia em São Paulo: a ação das 22h de 31 de agosto entrava
 * em setembro, e a das 22h de 30 de setembro ficava de fora.
 *
 * Substituiu `?mes=` como vocabulário principal. `lib/mes.ts` continua vivo
 * para o calendário, cuja grade é de um mês por definição, e para converter os
 * links antigos que ainda chegam com `?mes=`.
 */

/** Recorte "sem fim": ausência de `de`/`ate` já significa outra coisa no
 *  painel, então o acumulado precisa de valor próprio. */
export const TODO_O_PERIODO = "tudo";

/** O recorte como limites de consulta: instantes em São Paulo, `de` à
 *  meia-noite e `ate` em 23:59:59.999. */
export type Periodo = { de: Date; ate: Date };

/** O recorte como viaja entre servidor e navegador: dois dias, em chave. */
export type DiasDoPeriodo = { de: string; ate: string };

/** O dia de um instante, na forma que vai para a URL. */
export function chaveDoDia(instante: Date | string) {
  return diaNoFuso(instante);
}

/**
 * Lê um `?de=`/`?ate=` da URL, que qualquer um edita.
 *
 * O que não é dia possível vira `undefined`. Sem isto, um "2026-13-40" chegaria
 * à consulta como `Invalid Date` numa comparação com coluna `timestamp`.
 */
export function lerDia(valor: unknown) {
  if (typeof valor !== "string" || !CHAVE_DE_DIA.test(valor)) return undefined;
  return inicioDoDia(valor) ? valor : undefined;
}

type Parametros = Record<string, string | string[] | undefined>;

const texto = (parametros: Parametros, chave: string) => {
  const valor = parametros[chave];
  return typeof valor === "string" && valor ? valor : undefined;
};

/** De dois dias ao intervalo fechado que os cobre. */
function intervalo(de: string, ate: string): Periodo {
  // Invertido é engano de quem editou a URL, não pedido — vale o menor.
  const [inicio, fim] = ate >= de ? [de, ate] : [ate, de];
  return { de: inicioDoDia(inicio)!, ate: fimDoDia(fim)! };
}

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

  const de = lerDia(texto(parametros, "de"));
  const ate = lerDia(texto(parametros, "ate"));

  /* Um lado só é intervalo válido: quem escolheu um dia no calendário e
     recarregou antes do segundo clique tem um começo, não um erro. */
  if (de || ate) return intervalo(de ?? ate!, ate ?? de!);

  const mes = lerChaveDeMes(texto(parametros, "mes"));
  if (mes) return intervaloDoMes(mes);

  return padrao;
}

/** Escreve o recorte na URL, no lugar do que estiver lá. */
export function escreverPeriodo(
  parametros: URLSearchParams,
  periodo: DiasDoPeriodo | undefined,
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

  parametros.set("de", periodo.de);
  parametros.set("ate", periodo.ate);
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
  const inicio = lerDia(de);
  const fim = lerDia(ate);

  return inicio && fim ? intervalo(inicio, fim) : undefined;
}

/**
 * Os atalhos do seletor.
 *
 * `hoje` é argumento, e não `new Date()` aqui dentro, por causa da hidratação:
 * o servidor renderiza em UTC e o navegador em `America/Sao_Paulo`. Perto da
 * virada do dia os dois montariam atalhos diferentes para o mesmo HTML, e o
 * React trocaria a árvore inteira sem dizer por quê.
 */
export function atalhosDePeriodo(hoje: string) {
  const dias = (quantos: number) => somarDias(hoje, -quantos);
  const mesPassado = deslocarMes(hoje.slice(0, 7), -1);

  return [
    { rotulo: "Hoje", de: dias(0), ate: dias(0) },
    { rotulo: "Ontem", de: dias(1), ate: dias(1) },
    { rotulo: "Última semana", de: dias(7), ate: dias(0) },
    { rotulo: "Últimos 30 dias", de: dias(30), ate: dias(0) },
    {
      rotulo: "Último mês",
      de: `${mesPassado}-01`,
      ate: ultimoDiaDoMes(mesPassado),
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
  periodo: DiasDoPeriodo | undefined,
  hoje: string,
  vazio: string,
) {
  if (!periodo) return vazio;

  const atalho = atalhosDePeriodo(hoje).find(
    (a) => a.de === periodo.de && a.ate === periodo.ate,
  );
  if (atalho) return atalho.rotulo;

  /* Um mês fechado se diz pelo nome. O painel abre no mês corrente por padrão,
     e "01/09/2026 a 30/09/2026" obrigaria a reconhecer setembro a partir das
     bordas — trabalho que o nome do mês poupa, na tela mais visitada. */
  const mes = periodo.de.slice(0, 7);
  if (periodo.de === `${mes}-01` && periodo.ate === ultimoDiaDoMes(mes)) {
    const nome = formatarCompetencia(mes);
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }

  if (periodo.de === periodo.ate) return formatarData(periodo.de);
  return `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`;
}

/**
 * O recorte na forma que `SeletorPeriodo` entende.
 *
 * Datas viram chave na fronteira porque o seletor é Componente de Cliente:
 * `Date` atravessa a serialização como string de qualquer jeito, e declarar o
 * que de fato chega evita um `toLocaleDateString` no fuso do navegador.
 */
export function paraSeletor(
  periodo: { de?: Date; ate?: Date } | undefined,
): DiasDoPeriodo | undefined {
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

/** O mês em que o recorte termina, como `"2026-09"` — a âncora das leituras
 *  por competência, que é mensal por natureza. Sem recorte, o mês corrente. */
export function competenciaDoFim(periodo: Periodo | undefined) {
  return chaveDoDia(periodo ? periodo.ate : new Date()).slice(0, 7);
}

/* ─── O calendário do navegador ──────────────────────────────────────────── */

/*
 * O `react-day-picker` fala `Date` no fuso do navegador: o dia clicado chega
 * como meia-noite local, e o dia marcado se compara pelos componentes locais.
 * Essas duas funções fazem a tradução entre esse mundo e a chave — e são as
 * únicas que leem o fuso da máquina de propósito, porque é o fuso que o
 * calendário usa. Nunca para comparar com instante de evento.
 */

/** A chave como o calendário a entende: meia-noite local. `undefined` se o
 *  dia não existe. */
export function dataLocal(chave: string | undefined) {
  if (!chave || !CHAVE_DE_DIA.test(chave)) return undefined;
  const [ano, mes, dia] = chave.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  /* `new Date(2026, 12, 40)` não falha: transborda para outro mês. Comparar de
     volta é o que separa data real de data que só parece uma. */
  return chaveLocal(data) === chave ? data : undefined;
}

/** O dia que o calendário devolveu, como chave. */
export function chaveLocal(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Onde o calendário abre.
 *
 * Um mês antes do fim do recorte: com dois meses à vista, o painel da direita
 * cai justamente sobre o fim do período em vigor. Abrir no início deixaria um
 * recorte longo terminando fora da tela, e quem quisesse mudar só a data final
 * teria de navegar antes de enxergar o que está mudando.
 */
export function mesDeAbertura(periodo: DiasDoPeriodo | undefined, hoje: string) {
  const mes = deslocarMes((periodo?.ate ?? hoje).slice(0, 7), -1);
  return dataLocal(`${mes}-01`);
}
