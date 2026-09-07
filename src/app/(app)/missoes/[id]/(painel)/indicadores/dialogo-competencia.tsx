"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
import { SeletorMes } from "@/components/padroes/seletor-mes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { registrarCompetencia } from "@/features/missoes/actions";

/** Mês corrente no formato aceito por `<input type="month">`. */
function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function DialogoCompetencia({ missaoId }: { missaoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [competencia, setCompetencia] = useState(mesAtual);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    const resultado = await registrarCompetencia({
      missaoId,
      competencia,
      observacao,
    });

    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }

    toast.success("Competência registrada", {
      description: "Os números atuais da missão foram congelados nesse mês.",
    });
    setAberto(false);
    setObservacao("");
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <CalendarPlus aria-hidden />
          Registrar competência
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={enviar}>
          <DialogHeader>
            <DialogTitle>Registrar competência</DialogTitle>
            <DialogDescription>
              Guarda os números atuais da missão — membros, grupos e pessoas em
              grupos — como a fotografia do mês escolhido. É o que alimenta o
              gráfico de evolução.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Mês de referência" obrigatorio>
              {(props) => (
                <SeletorMes
                  {...props}
                  valor={competencia}
                  onChange={setCompetencia}
                  maximo={mesAtual()}
                />
              )}
            </Campo>

            <Campo
              rotulo="Observação"
              ajuda="Opcional. Algo que ajude a interpretar os números deste mês."
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Mês do retiro; muitos visitantes novos."
                />
              )}
            </Campo>

            {erro ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {erro}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                disabled={enviando}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" className="cursor-pointer" disabled={enviando}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Registrando…
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
