"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Mensagens do Firebase são em inglês e técnicas demais para o usuário final.
 *  "auth/invalid-credential" não diz nada a um coordenador de missão. */
function mensagemDeErro(codigo: unknown) {
  const code = typeof codigo === "object" && codigo && "code" in codigo
    ? String((codigo as { code: unknown }).code)
    : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarde alguns minutos.";
    case "auth/user-disabled":
      return "Esta conta foi desativada. Fale com o administrador.";
    case "auth/network-request-failed":
      return "Sem conexão. Verifique sua internet e tente de novo.";
    case "auth/unauthorized-domain":
      // Acontece em toda implantação nova: o Firebase só aceita autenticação
      // vinda de domínios que estejam na lista dele.
      return "Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Login por e-mail e senha está desativado no Firebase. Ative em Authentication → Sign-in method.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "A chave pública do Firebase está incorreta ou ausente nas variáveis de ambiente.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    default:
      return null;
  }
}

export function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const credencial = await signInWithEmailAndPassword(auth, email, senha);
      const idToken = await credencial.user.getIdToken();

      const resposta = await fetch("/api/auth/sessao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!resposta.ok) {
        // A conta existe no Firebase mas não foi liberada no sistema — ou o
        // servidor falhou. Um 500 devolve HTML, não JSON: tentar `.json()`
        // direto lançaria e o motivo real ficaria escondido atrás da mensagem
        // genérica do catch.
        const corpo = await resposta.text();
        let mensagem: string | null = null;
        try {
          mensagem = (JSON.parse(corpo) as { erro?: string }).erro ?? null;
        } catch {
          mensagem = null;
        }

        await auth.signOut();

        setErro(
          mensagem ??
            (resposta.status >= 500
              ? "O servidor não conseguiu concluir o acesso. Abra /api/saude para ver o que está faltando na configuração."
              : "Não foi possível entrar."),
        );
        return;
      }

      const destino = parametros.get("redirecionar") ?? "/";
      iniciar(() => {
        router.replace(destino);
        router.refresh();
      });
    } catch (excecao) {
      setErro(
        mensagemDeErro(excecao) ??
          "Não foi possível entrar. Tente novamente em instantes.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function recuperarSenha() {
    if (!email) {
      setErro("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Link enviado", {
        description: `Confira a caixa de entrada de ${email}.`,
      });
    } catch {
      // Não revelamos se o e-mail existe: isso permitiria descobrir quem tem
      // conta no sistema apenas testando endereços.
      toast.success("Link enviado", {
        description: `Se houver conta para ${email}, o link chegará em instantes.`,
      });
    }
  }

  const ocupado = enviando || pendente;

  return (
    <form onSubmit={entrar} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@missao.org.br"
          aria-invalid={Boolean(erro)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="senha">Senha</Label>
          <button
            type="button"
            onClick={recuperarSenha}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-sm text-sm underline-offset-4 transition-colors hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <Input
            id="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="pr-11"
            aria-invalid={Boolean(erro)}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md transition-colors"
          >
            {mostrarSenha ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* `role="alert"` faz o leitor de tela anunciar o erro assim que aparece */}
      {erro ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {erro}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
