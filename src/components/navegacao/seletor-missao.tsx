"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { definirFoco } from "@/features/missoes/actions";

const TODAS = "__todas__";

/**
 * Escolhe a missão em foco para toda a área de acompanhamento.
 *
 * O valor real vem do servidor a cada renderização — o cookie é httpOnly e o
 * cliente nunca o lê. Enquanto a ação vai e volta, `useOptimistic` mostra a
 * missão recém-escolhida: sem isso o seletor voltaria à opção anterior por um
 * instante, e quem clicou concluiria que não pegou.
 */
export function SeletorMissao({
  missaoId,
  opcoes,
}: {
  missaoId?: string;
  opcoes: { id: string; nome: string }[];
}) {
  const [pendente, iniciar] = useTransition();
  const [escolhido, escolherOtimista] = useOptimistic(missaoId ?? TODAS);

  function escolher(valor: string) {
    iniciar(async () => {
      escolherOtimista(valor);
      const resultado = await definirFoco(valor === TODAS ? null : valor);
      if (!resultado.ok) toast.error(resultado.erro);
    });
  }

  return (
    <Select value={escolhido} onValueChange={escolher} disabled={pendente}>
      <SelectTrigger
        size="sm"
        className="w-full"
        aria-label="Missão em foco"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas as missões</SelectItem>
        {opcoes.map((missao) => (
          <SelectItem key={missao.id} value={missao.id}>
            {missao.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
