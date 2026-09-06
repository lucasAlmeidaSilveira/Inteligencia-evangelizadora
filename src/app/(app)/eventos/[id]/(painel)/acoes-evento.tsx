"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { excluirEvento } from "@/features/eventos/actions";

export function AcoesEvento({
  eventoId,
  titulo,
  temDocumentos,
}: {
  eventoId: string;
  titulo: string;
  temDocumentos: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const resultado = await excluirEvento(eventoId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Ação apostólica excluída");
      setAberto(false);
      router.push("/eventos");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive cursor-pointer"
          aria-label="Excluir ação apostólica"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{titulo}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Os lançamentos financeiros e os links serão removidos junto
            {temDocumentos
              ? ", e os documentos anexados serão apagados do armazenamento"
              : ""}
            . Nada disso pode ser recuperado. Para preservar o histórico,
            prefira marcar a ação como cancelada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={excluindo}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmar();
            }}
            disabled={excluindo}
            className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
          >
            {excluindo ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
