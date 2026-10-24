"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatarRelativo } from "@/lib/format";

import { registrarContagem } from "../actions";
import { contagemSchema } from "../schemas";
import { CamposDeContagem } from "./campos-de-contagem";

type Entrada = z.input<typeof contagemSchema>;
type Saida = z.output<typeof contagemSchema>;

/**
 * O caminho curto do lembrete bimestral: só os três números, sem o cadastro
 * inteiro do grupo em volta.
 *
 * Quem chega pelo link do e-mail quer confirmar ou corrigir a contagem e ir
 * embora. O formulário completo, com pastores, horário e local, é o lugar
 * errado para isso — e salvar sem mudar nada lá não registraria a contagem.
 */
export function DialogoContagem({
  grupoId,
  nome,
  valores,
  ultimaContagemEm,
  aberto,
  aoFechar,
}: {
  grupoId: string;
  nome: string;
  valores: Entrada;
  ultimaContagemEm: string | null;
  aberto: boolean;
  /** `salvou` diz se houve escrita — quem chama decide se recarrega a lista. */
  aoFechar: (salvou: boolean) => void;
}) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(contagemSchema),
    defaultValues: valores,
  });

  const {
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form;

  async function enviar(dados: Saida) {
    const resultado = await registrarContagem(grupoId, dados);

    if (!resultado.ok) {
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as never, { message: mensagem });
      }
      setErroGeral(resultado.erro);
      return;
    }

    toast.success("Contagem registrada");
    aoFechar(true);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar(false)}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={handleSubmit(enviar, () =>
            toast.error("Confira os campos destacados antes de salvar."),
          )}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Atualizar contagem · {nome}</DialogTitle>
            <DialogDescription>
              {ultimaContagemEm
                ? `Última contagem ${formatarRelativo(ultimaContagemEm)}. `
                : "Este grupo ainda não teve contagem registrada. "}
              Confirme os números de hoje — mesmo que não tenham mudado, salvar
              registra que o grupo foi contado neste bimestre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <CamposDeContagem form={form} />

            {erroGeral ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {erroGeral}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => aoFechar(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                "Salvar contagem"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
