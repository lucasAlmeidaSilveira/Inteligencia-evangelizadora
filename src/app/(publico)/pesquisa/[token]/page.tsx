import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Lock } from "lucide-react";

import { FormularioResposta } from "@/features/pesquisas/components/formulario-resposta";
import { pesquisaPeloToken } from "@/features/pesquisas/queries";
import { tokenDePesquisaValido } from "@/lib/pesquisa";
import { CaminhoPublicoOcupado, limitarPublico } from "@/server/pesquisa";

/*
 * Sem isto o Next guardaria a primeira renderização no Full Route Cache: a
 * página não lê cookie nem cabeçalho, e a consulta ao banco não passa por
 * `fetch`, então nada a marcaria como dinâmica. A pesquisa "aberta" seguiria
 * aberta depois de encerrada, e um 404 de token trocado ficaria colado.
 *
 * Esta rota é a exceção à convenção "toda rota tem loading.tsx", de
 * propósito: o esqueleto cria uma fronteira de Suspense, o Next passa a
 * enviar o cabeçalho 200 antes de a página decidir, e o `notFound()` de um
 * token errado chegaria como 200 com um 404 desenhado no cliente. Para uma
 * URL pública, o status importa — monitoramento e robôs leem o status, não a
 * tela. A página é pequena e a moldura do layout já aparece na hora.
 */
export const dynamic = "force-dynamic";

/* As metatags repetem os cabeçalhos de `next.config.ts`: o token está na URL,
   e esta página não pode ser indexada nem mandar a URL como Referer. */
export const metadata: Metadata = {
  title: "Pesquisa de satisfação",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PaginaPesquisa({
  params,
}: PageProps<"/pesquisa/[token]">) {
  const { token } = await params;

  // Formato errado nem chega ao banco.
  if (!tokenDePesquisaValido(token)) notFound();
  if (!limitarPublico(token, "pagina")) return <Ocupada />;

  let pesquisa;
  try {
    pesquisa = await pesquisaPeloToken(token);
  } catch (erro) {
    if (erro instanceof CaminhoPublicoOcupado) return <Ocupada />;
    throw erro;
  }

  if (!pesquisa) notFound();
  if (!pesquisa.aceitaRespostas) return <Encerrada titulo={pesquisa.titulo} />;

  return <FormularioResposta token={token} titulo={pesquisa.titulo} />;
}

function Encerrada({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-4 text-center">
      <span className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
        <Lock className="text-muted-foreground size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-balance">
        Esta pesquisa foi encerrada
      </h1>
      <p className="text-muted-foreground text-sm text-pretty">
        A avaliação de <strong className="text-foreground">{titulo}</strong>{" "}
        não recebe mais respostas. Obrigado pelo interesse.
      </p>
    </div>
  );
}

function Ocupada() {
  return (
    <div className="space-y-4 text-center">
      <span className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
        <Clock className="text-muted-foreground size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">
        Muita gente respondendo agora
      </h1>
      <p className="text-muted-foreground text-sm text-pretty">
        Aguarde um minuto e recarregue a página.
      </p>
    </div>
  );
}
