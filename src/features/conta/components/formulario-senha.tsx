"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  updatePassword,
} from "firebase/auth";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";

const MINIMO = 8;

function mensagemDeErro(excecao: unknown) {
  const codigo =
    typeof excecao === "object" && excecao && "code" in excecao
      ? String((excecao as { code: unknown }).code)
      : "";

  switch (codigo) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return { campo: "atual", texto: "Senha atual incorreta." };
    case "auth/weak-password":
      return { campo: "nova", texto: "Senha muito fraca. Escolha outra." };
    case "auth/too-many-requests":
      return { campo: null, texto: "Muitas tentativas. Aguarde alguns minutos." };
    case "auth/network-request-failed":
      return { campo: null, texto: "Sem conexão. Verifique sua internet." };
    default:
      return { campo: null, texto: "Não foi possível trocar a senha." };
  }
}

export function FormularioSenha({ email }: { email: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);

    const problemas: Record<string, string> = {};
    if (!atual) problemas.atual = "Informe a senha atual.";
    if (nova.length < MINIMO)
      problemas.nova = `Use ao menos ${MINIMO} caracteres.`;
    if (nova && nova === atual)
      problemas.nova = "A nova senha precisa ser diferente da atual.";
    if (nova !== confirmacao)
      problemas.confirmacao = "A confirmação não confere.";

    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }

    setEnviando(true);
    try {
      /*
       * O Firebase exige autenticação recente para trocar a senha. Reautenticar
       * com a senha atual atende a isso e, de quebra, confirma que quem está
       * na frente da tela é mesmo o dono da conta — e não alguém que encontrou
       * a sessão aberta.
       */
      const usuario = auth.currentUser;
      if (usuario) {
        await reauthenticateWithCredential(
          usuario,
          EmailAuthProvider.credential(email, atual),
        );
        await updatePassword(usuario, nova);
      } else {
        // Sessão do navegador expirada, mas o cookie do servidor ainda vale.
        const credencial = await signInWithEmailAndPassword(auth, email, atual);
        await updatePassword(credencial.user, nova);
      }

      toast.success("Senha alterada", {
        description: "Use a nova senha no próximo acesso.",
      });
      setAtual("");
      setNova("");
      setConfirmacao("");
    } catch (excecao) {
      const { campo, texto } = mensagemDeErro(excecao);
      if (campo) setErros({ [campo]: texto });
      else setGeral(texto);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <Campo rotulo="Senha atual" obrigatorio erro={erros.atual}>
        {(props) => (
          <Input
            {...props}
            type={mostrar ? "text" : "password"}
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
        )}
      </Campo>

      <Campo
        rotulo="Nova senha"
        obrigatorio
        ajuda={`Ao menos ${MINIMO} caracteres.`}
        erro={erros.nova}
      >
        {(props) => (
          <div className="relative">
            <Input
              {...props}
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? "Ocultar senhas" : "Mostrar senhas"}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md transition-colors"
            >
              {mostrar ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        )}
      </Campo>

      <Campo rotulo="Repita a nova senha" obrigatorio erro={erros.confirmacao}>
        {(props) => (
          <Input
            {...props}
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        )}
      </Campo>

      {geral ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {geral}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" className="cursor-pointer" disabled={enviando}>
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Alterando…
            </>
          ) : (
            "Alterar senha"
          )}
        </Button>
      </div>
    </form>
  );
}
