import { timingSafeEqual } from "node:crypto";

import { executarLembretes } from "@/features/lembretes/job";
import { emailConfigurado, enviarEmail } from "@/server/email";
import { envAgendador } from "@/server/env";
import { comSistema } from "@/server/sistema";

/**
 * Ponto de entrada do agendador para o lembrete bimestral de contagem.
 *
 * A Vercel chama esta rota todo dia às 11h UTC (8h em São Paulo), conforme
 * `vercel.json`, e a rotina decide sozinha quais grupos passaram de dois meses
 * sem contagem — por isso o cron é diário, e não bimestral: um agendador que
 * rodasse de dois em dois meses perderia o bimestre inteiro a cada falha.
 *
 * Não há sessão aqui. O que autoriza é `CRON_SECRET`, comparado em tempo
 * constante; e o que a rotina enxerga é o escopo do sistema (`comSistema`),
 * que é a única situação em que ele pode ser usado.
 *
 * `?simular=1` planeja e relata sem gravar nem enviar nada — é como se confere
 * quem receberia aviso hoje antes de ligar o cron, ou depois de uma dúvida.
 */
export async function GET(request: Request) {
  let env: ReturnType<typeof envAgendador>;
  try {
    env = envAgendador();
  } catch (erro) {
    return Response.json(
      {
        erro: "Rotina desativada: CRON_SECRET não configurado.",
        detalhe: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!autorizado(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json(
      { erro: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const simular = url.searchParams.get("simular") === "1";

  try {
    const relatorio = await comSistema((tx) =>
      executarLembretes(tx, {
        baseUrl: env.APP_URL ?? url.origin,
        enviarEmail: emailConfigurado() ? enviarEmail : null,
        simular,
      }),
    );

    if (relatorio.erros.length > 0) {
      console.error("Lembretes de contagem com falhas:", relatorio.erros);
    }

    return Response.json(relatorio, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (erro) {
    console.error("Falha na rotina de lembretes:", erro);
    return Response.json(
      { erro: "A rotina falhou. Veja o log do servidor." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/** Comparação em tempo constante: o tamanho diferente já responde `false`
 *  sem vazar em quanto tempo a string divergiu. */
function autorizado(cabecalho: string | null, segredo: string) {
  if (!cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return (
    esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
  );
}
