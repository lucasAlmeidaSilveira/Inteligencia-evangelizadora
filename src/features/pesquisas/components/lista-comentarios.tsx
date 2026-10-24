"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Trash2 } from "lucide-react";
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
import { formatarRelativo } from "@/lib/format";

import { excluirResposta } from "../actions";
import type { ComentarioDaPesquisa } from "../queries";

/**
 * Os comentários mais recentes, com a única moderação que existe: apagar a
 * resposta inteira. O texto é renderizado como texto — React escapa — e com
 * `whitespace-pre-line`, como a descrição da ação.
 */
export function ListaComentarios({
  comentarios,
  vazio = "Nenhum comentário ainda.",
}: {
  comentarios: ComentarioDaPesquisa[];
  /** O que dizer sem itens — na aba, com filtro, "nenhum" depende do filtro. */
  vazio?: string;
}) {
  if (comentarios.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <MessageSquareText className="size-4 shrink-0" aria-hidden />
        {vazio}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {comentarios.map((c) => (
        <li key={c.id} className="flex gap-3 text-sm">
          <span
            className="bg-muted tabular flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            aria-label={`Nota ${c.nota}`}
          >
            {c.nota}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="leading-relaxed whitespace-pre-line">{c.comentario}</p>
            <p className="text-muted-foreground text-xs">
              {formatarRelativo(c.respondidaEm)}
            </p>
          </div>
          <ExcluirComentario respostaId={c.id} />
        </li>
      ))}
    </ul>
  );
}

function ExcluirComentario({ respostaId }: { respostaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const resultado = await excluirResposta(respostaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Resposta excluída");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
          aria-label="Excluir esta resposta"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta resposta?</AlertDialogTitle>
          <AlertDialogDescription>
            Apaga a nota e o comentário desta resposta, e a média é refeita
            sem ela. Não pode ser desfeito.
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
