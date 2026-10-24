import { caminhoDaContagem, caminhoDosPendentes } from "./regras";

/**
 * Textos do lembrete — puros, sem banco. Ficam separados da rotina para o
 * teste conferir o que a pessoa vai ler, e para a mesma redação servir ao
 * e-mail e à notificação interna.
 */

export type GrupoNoLembrete = {
  grupoId: string;
  grupoNome: string;
  missaoId: string;
  missaoNome: string;
  /** ISO, ou nulo para grupo que nunca foi contado. */
  ultimaContagemEm: string | null;
};

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

export function tituloDaNotificacao(grupos: GrupoNoLembrete[]) {
  const n = grupos.length;
  return n === 1
    ? `Contagem bimestral: ${grupos[0].grupoNome}`
    : `Contagem bimestral: ${n} grupos aguardam atualização`;
}

export function mensagemDaNotificacao(grupos: GrupoNoLembrete[]) {
  const n = grupos.length;
  const nomes = grupos.map((g) => g.grupoNome);
  const lista =
    nomes.length <= 3
      ? nomes.join(", ")
      : `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;

  return `Já se passaram dois meses desde a última contagem de membros ${plural(
    n,
    "do grupo",
    "dos grupos",
  )} ${lista}. Informe efetivos, flutuantes e evadidos para manter os indicadores da missão em dia.`;
}

/** Um grupo só leva direto ao diálogo dele; vários, à lista já recortada. */
export function urlDaNotificacao(grupos: GrupoNoLembrete[]) {
  const { missaoId } = grupos[0];
  return grupos.length === 1
    ? caminhoDaContagem(missaoId, grupos[0].grupoId)
    : caminhoDosPendentes(missaoId);
}

export function assuntoDoEmail(grupos: GrupoNoLembrete[]) {
  const n = grupos.length;
  return n === 1
    ? `Hora de atualizar a contagem do grupo ${grupos[0].grupoNome}`
    : `Hora de atualizar a contagem de ${n} grupos de oração`;
}

function escapar(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dataCurta(iso: string | null) {
  if (!iso) return "nunca registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

/**
 * O e-mail: um link por grupo, cada um abrindo o diálogo de contagem daquele
 * grupo. Os links são absolutos porque e-mail não tem origem — `baseUrl` é o
 * endereço público da aplicação.
 *
 * HTML simples e inline de propósito: cliente de e-mail não carrega CSS
 * externo, e a mensagem precisa ser legível também em texto puro.
 */
export function emailDoLembrete({
  nome,
  grupos,
  baseUrl,
}: {
  nome: string;
  grupos: GrupoNoLembrete[];
  baseUrl: string;
}) {
  const base = baseUrl.replace(/\/$/, "");
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome;
  const missaoNome = grupos[0].missaoNome;
  const n = grupos.length;

  const linhasTexto = grupos
    .map(
      (g) =>
        `- ${g.grupoNome} (última contagem: ${dataCurta(g.ultimaContagemEm)})\n  ${base}${caminhoDaContagem(g.missaoId, g.grupoId)}`,
    )
    .join("\n");

  const texto = [
    `Olá, ${primeiroNome}.`,
    "",
    `Já se passaram dois meses desde a última contagem de membros ${plural(n, "do grupo abaixo", "dos grupos abaixo")}, da missão ${missaoNome}. Abra cada link, confirme ou corrija efetivos, flutuantes e evadidos, e salve.`,
    "",
    linhasTexto,
    "",
    n > 1 ? `Todos os pendentes de uma vez: ${base}${caminhoDosPendentes(grupos[0].missaoId)}` : "",
    "",
    "Mesmo que os números não tenham mudado, salvar registra que a contagem foi feita neste bimestre — e o lembrete não volta antes do próximo.",
    "",
    "Inteligência Evangelizadora · Comunidade Católica Shalom",
  ]
    .filter((linha) => linha !== undefined)
    .join("\n");

  const itens = grupos
    .map(
      (g) => `
        <li style="margin:0 0 12px 0">
          <a href="${base}${caminhoDaContagem(g.missaoId, g.grupoId)}"
             style="color:#1d4ed8;font-weight:600;text-decoration:underline">${escapar(g.grupoNome)}</a>
          <span style="color:#52525b"> · última contagem: ${dataCurta(g.ultimaContagemEm)}</span>
        </li>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e4e4e7">
      <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#71717a">Inteligência Evangelizadora</p>
      <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3">Contagem bimestral dos grupos de oração</h1>
      <p style="margin:0 0 16px 0;line-height:1.5">Olá, ${escapar(primeiroNome)}.</p>
      <p style="margin:0 0 16px 0;line-height:1.5">
        Já se passaram dois meses desde a última contagem de membros ${plural(n, "do grupo abaixo", "dos grupos abaixo")},
        da missão <strong>${escapar(missaoNome)}</strong>. Abra cada link, confirme ou corrija
        <strong>efetivos</strong>, <strong>flutuantes</strong> e <strong>evadidos</strong>, e salve.
      </p>
      <ul style="margin:0 0 16px 0;padding-left:20px;line-height:1.5">${itens}
      </ul>
      ${
        n > 1
          ? `<p style="margin:0 0 16px 0;line-height:1.5"><a href="${base}${caminhoDosPendentes(grupos[0].missaoId)}" style="color:#1d4ed8">Ver todos os grupos pendentes desta missão</a></p>`
          : ""
      }
      <p style="margin:0;line-height:1.5;color:#52525b;font-size:14px">
        Mesmo que os números não tenham mudado, salvar registra que a contagem foi feita neste
        bimestre — e o lembrete não volta antes do próximo.
      </p>
    </div>
  </body>
</html>`;

  return { assunto: assuntoDoEmail(grupos), html, texto };
}
