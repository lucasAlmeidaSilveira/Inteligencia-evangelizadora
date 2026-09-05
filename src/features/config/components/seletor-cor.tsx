"use client";

import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { CORES_SUGERIDAS } from "../schemas";

/**
 * As cores sugeridas foram escolhidas por serem distinguíveis entre si —
 * inclusive para quem não diferencia matizes — e legíveis nos dois temas.
 * O campo livre continua aberto para quem quiser outra.
 */
export function SeletorCor({
  valor,
  aoMudar,
  id,
}: {
  valor: string;
  aoMudar: (cor: string) => void;
  id?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cores sugeridas">
        {CORES_SUGERIDAS.map((cor) => {
          const escolhida = valor.toLowerCase() === cor.hex;
          return (
            <button
              key={cor.hex}
              type="button"
              title={cor.nome}
              aria-label={cor.nome}
              aria-pressed={escolhida}
              onClick={() => aoMudar(cor.hex)}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-md transition-transform",
                escolhida ? "ring-ring ring-2 ring-offset-2" : "hover:scale-110",
              )}
              style={{ background: cor.hex }}
            >
              {escolhida ? (
                <Check className="size-4 text-white drop-shadow" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-md border"
          style={{ background: /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : undefined }}
        />
        <Input
          id={id}
          value={valor}
          onChange={(e) => aoMudar(e.target.value.toLowerCase())}
          placeholder="#7f22fe"
          maxLength={7}
          className="font-mono"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
