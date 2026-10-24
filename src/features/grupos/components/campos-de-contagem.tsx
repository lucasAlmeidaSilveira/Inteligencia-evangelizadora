"use client";

import type { FieldErrors, UseFormReturn } from "react-hook-form";

import { Campo } from "@/components/padroes/campo";
import { Input } from "@/components/ui/input";
import { formatarNumero } from "@/lib/format";

import type { DadosContagem } from "../schemas";

/**
 * Os três campos de contagem, compartilhados pelo cadastro completo do grupo e
 * pelo diálogo rápido do lembrete. Um só lugar para rótulos, ajudas e a soma —
 * dois formulários explicando os termos de jeitos diferentes ensinariam duas
 * coisas.
 *
 * Tipado sobre `DadosContagem` para aceitar tanto o formulário que tem só os
 * três campos quanto o do grupo inteiro, que os inclui.
 */
export function CamposDeContagem<T extends DadosContagem>({
  form,
}: {
  form: UseFormReturn<T, unknown, unknown>;
}) {
  // O cast existe porque o genérico impede o TypeScript de saber que estas
  // chaves existem em `T` — mas `T extends DadosContagem` garante que existem.
  const { register, watch } = form as unknown as UseFormReturn<DadosContagem>;
  const errors = form.formState.errors as FieldErrors<DadosContagem>;

  const [efetivos, flutuantes] = watch(["membrosEfetivos", "membrosFlutuantes"]);
  const total = inteiro(efetivos) + inteiro(flutuantes);

  const campos = [
    {
      nome: "membrosEfetivos" as const,
      rotulo: "Membros efetivos",
      ajuda: "Participam com regularidade.",
    },
    {
      nome: "membrosFlutuantes" as const,
      rotulo: "Membros flutuantes",
      ajuda: "Aparecem de vez em quando.",
    },
    {
      nome: "membrosEvadidos" as const,
      rotulo: "Membros evadidos",
      ajuda: "Deixaram de frequentar.",
    },
  ];

  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1.5 text-sm font-medium">Contagem de membros</legend>

      <div className="grid gap-4 sm:grid-cols-3">
        {campos.map((campo) => (
          <Campo
            key={campo.nome}
            rotulo={campo.rotulo}
            obrigatorio
            ajuda={campo.ajuda}
            erro={errors[campo.nome]?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                className="tabular"
                {...register(campo.nome)}
              />
            )}
          </Campo>
        ))}
      </div>

      {/* A soma aparece enquanto a pessoa digita, para ela ver na hora o que
          vai para os indicadores — e entender que evadidos ficam de fora. */}
      <p className="text-muted-foreground text-xs">
        Total que conta nos indicadores (efetivos + flutuantes):{" "}
        <span className="text-foreground tabular font-medium">
          {formatarNumero(total)}
        </span>
        . Evadidos ficam fora da contagem.
      </p>
    </fieldset>
  );
}

function inteiro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
}
