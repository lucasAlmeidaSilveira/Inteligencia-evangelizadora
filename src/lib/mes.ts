import { formatarCompetencia } from "./format";

/**
 * Mês como recorte de leitura, numa definição só.
 *
 * Vive em `lib/` porque atravessa a fronteira: o painel monta o link no
 * servidor, a barra de filtros monta as opções no navegador e a consulta
 * converte a chave em intervalo. Três lugares com a própria conta de "primeiro
 * e último instante do mês" acabariam discordando na virada — o cartão diria
 * 7 ações e a tela de destino mostraria 6, sem erro em lugar nenhum.
 *
 * É a mesma conta que o cartão "Ações neste mês" já fazia em
 * `features/painel/queries.ts`, agora importada de cá pelos dois lados.
 */

/** Como o mês viaja na URL: `?mes=2026-09`. */
const CHAVE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function inicioDoMes(referencia = new Date()) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

/* Dia 0 do mês seguinte é o último dia deste — evita a tabela de 28/30/31 e
   fevereiro bissexto. Os milissegundos vão até 999 porque o limite é `<=`:
   parar em 23:59:59 deixaria de fora a ação marcada no último segundo. */
export function fimDoMes(referencia = new Date()) {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

/** Mês de uma data, na forma que vai para a URL. */
export function chaveDoMes(referencia = new Date()) {
  const mes = String(referencia.getMonth() + 1).padStart(2, "0");
  return `${referencia.getFullYear()}-${mes}`;
}

/**
 * Lê `?mes=` da URL, que qualquer um edita.
 *
 * O que não é mês possível vira `undefined`, e a tela mostra todo o período —
 * como faria sem filtro. Sem isto, um "2026-13" viraria `Invalid Date` e a
 * consulta compararia coluna `timestamp` com NaN.
 */
export function lerChaveDeMes(valor: unknown) {
  return typeof valor === "string" && CHAVE.test(valor) ? valor : undefined;
}

function primeiroDia(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, 1);
}

/** Intervalo fechado do mês, pronto para os filtros `de` e `ate`. */
export function intervaloDoMes(chave: string) {
  const referencia = primeiroDia(chave);
  return { de: inicioDoMes(referencia), ate: fimDoMes(referencia) };
}

/** "Setembro de 2026" — maiúscula porque é rótulo de opção, não meio de frase. */
export function rotuloDoMes(chave: string) {
  const nome = formatarCompetencia(primeiroDia(chave));
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/**
 * Os meses oferecidos no filtro, do mais recente para o mais antigo.
 *
 * A janela entra no futuro porque ação apostólica se planeja antes de
 * acontecer: sem os meses à frente não haveria como recortar o que está
 * agendado. Para trás vai um ano, que é o quanto a prestação de contas de uma
 * missão costuma olhar.
 */
export function mesesDoFiltro(adiante = 2, atras = 12, referencia = new Date()) {
  const meses: string[] = [];
  for (let i = adiante; i >= -atras; i--) {
    meses.push(
      chaveDoMes(
        new Date(referencia.getFullYear(), referencia.getMonth() + i, 1),
      ),
    );
  }
  return meses;
}
