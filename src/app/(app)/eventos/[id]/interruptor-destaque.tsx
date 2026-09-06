"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { alternarDestaqueRegional } from "@/features/eventos/actions";

/**
 * Marca a ação para ser levada ao regional, sem abrir o formulário.
 *
 * Otimista porque o interruptor precisa responder no toque: esperar a ida ao
 * banco faria o controle parecer travado, e o erro — raro — devolve o estado
 * anterior junto com o aviso.
 */
export function InterruptorDestaque({
  eventoId,
  destaque,
}: {
  eventoId: string;
  destaque: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [otimista, definirOtimista] = useOptimistic(destaque);

  function alternar() {
    iniciar(async () => {
      definirOtimista(!otimista);
      const resultado = await alternarDestaqueRegional(eventoId);

      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(
        resultado.dados.destaque
          ? "Ação destacada para o regional"
          : "Destaque removido",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Star
        aria-hidden
        className={
          otimista
            ? "fill-laranja text-laranja size-4"
            : "text-muted-foreground size-4"
        }
      />
      <Label
        htmlFor="destaque-regional"
        className="cursor-pointer text-sm font-medium"
      >
        Destacar para o regional
      </Label>
      <Switch
        id="destaque-regional"
        checked={otimista}
        disabled={pendente}
        onCheckedChange={alternar}
        className="cursor-pointer"
      />
    </div>
  );
}
