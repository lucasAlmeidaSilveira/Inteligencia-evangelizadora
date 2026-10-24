import "server-only";

import { envEmail } from "@/server/env";

export type Mensagem = {
  para: string;
  assunto: string;
  html: string;
  texto: string;
};

export type EnviarEmail = (mensagem: Mensagem) => Promise<void>;

/**
 * Envio de e-mail pela API HTTP do Resend.
 *
 * Sem SDK: é um POST com JSON, e o `fetch` do Node resolve. Uma dependência a
 * mais só para isso é mais superfície para quebrar — a lição do `jose` está no
 * README. Trocar de provedor é reescrever esta função, e nada mais: quem envia
 * recebe uma `EnviarEmail` e não sabe quem está por trás.
 *
 * O remetente precisa ser de um domínio verificado no Resend; é por isso que
 * `EMAIL_REMETENTE` é configuração, não constante.
 */
export const enviarEmail: EnviarEmail = async (mensagem) => {
  const env = envEmail();

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE,
      to: [mensagem.para],
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(
      `Resend respondeu ${resposta.status} ao enviar para ${mensagem.para}: ${corpo}`,
    );
  }
};

/**
 * E-mail é opcional: sem as variáveis, a rotina de lembretes segue só com a
 * notificação interna e diz isso no relatório, em vez de falhar inteira por
 * falta de uma credencial que a missão talvez nunca configure.
 */
export function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}
