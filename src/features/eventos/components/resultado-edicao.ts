import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

/** O `Resultado` das Server Actions, redeclarado porque `server/dados` é
 *  `server-only` e este arquivo roda no navegador. */
type ResultadoAcao =
  | { ok: true }
  | { ok: false; erro: string; campos?: Record<string, string> };

/**
 * Fecha o card quando gravou e devolve o erro ao campo certo quando não.
 *
 * Mora aqui porque os quatro cards editáveis fazem exatamente isto, e o
 * pedaço que mais importa — repetir no campo o erro que o servidor devolveu —
 * é o que se esquece ao copiar: sem ele o coordenador vê o aviso subir e
 * some sem nunca descobrir qual dos números estava errado.
 */
export function tratarResultado<C extends FieldValues>(
  resultado: ResultadoAcao,
  {
    setError,
    fechar,
    atualizar,
    mensagem,
  }: {
    setError: UseFormSetError<C>;
    fechar: () => void;
    atualizar: () => void;
    mensagem: string;
  },
) {
  if (!resultado.ok) {
    for (const [campo, texto] of Object.entries(resultado.campos ?? {})) {
      setError(campo as Path<C>, { message: texto });
    }
    toast.error(resultado.erro);
    return;
  }

  toast.success(mensagem);
  fechar();
  // O número alterado aparece no cabeçalho, na lista e no painel ao mesmo
  // tempo; a action já revalidou o servidor, isto repinta o que está na tela.
  atualizar();
}
