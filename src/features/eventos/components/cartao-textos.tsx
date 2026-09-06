"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import {
  AcoesDeEdicao,
  CartaoEditavel,
} from "@/components/padroes/cartao-editavel";
import { Textarea } from "@/components/ui/textarea";

import { atualizarTextos } from "../actions";
import { textosSchema } from "../schemas";
import { tratarResultado } from "./resultado-edicao";

type Entrada = z.input<typeof textosSchema>;
type Saida = z.output<typeof textosSchema>;

/**
 * Descrição e observações num card só, e sempre visível.
 *
 * Antes eram dois cards que só apareciam preenchidos — o que, com edição na
 * própria tela, deixaria de existir exatamente onde se precisa clicar para
 * escrever pela primeira vez.
 */
export function CartaoTextos({
  eventoId,
  descricao,
  observacoes,
}: {
  eventoId: string;
  descricao: string | null;
  observacoes: string | null;
}) {
  return (
    <CartaoEditavel titulo="Descrição e observações">
      {({ editando, fechar }) =>
        editando ? (
          <Formulario
            eventoId={eventoId}
            descricao={descricao}
            observacoes={observacoes}
            fechar={fechar}
            key={`${descricao ?? ""}|${observacoes ?? ""}`}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Bloco rotulo="Descrição" texto={descricao} />
            <Bloco rotulo="Observações" texto={observacoes} />
          </div>
        )
      }
    </CartaoEditavel>
  );
}

function Bloco({ rotulo, texto }: { rotulo: string; texto: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{rotulo}</p>
      {texto ? (
        <p className="text-sm leading-relaxed whitespace-pre-line">{texto}</p>
      ) : (
        <p className="text-muted-foreground text-sm">Não informada</p>
      )}
    </div>
  );
}

function Formulario({
  eventoId,
  descricao,
  observacoes,
  fechar,
}: {
  eventoId: string;
  descricao: string | null;
  observacoes: string | null;
  fechar: () => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(textosSchema),
    defaultValues: {
      descricao: descricao ?? "",
      observacoes: observacoes ?? "",
    },
  });

  async function enviar(dados: Saida) {
    tratarResultado(await atualizarTextos(eventoId, dados), {
      setError,
      fechar,
      atualizar: () => router.refresh(),
      mensagem: "Textos atualizados",
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Descrição" erro={errors.descricao?.message}>
          {(props) => (
            <Textarea {...props} rows={5} autoFocus {...register("descricao")} />
          )}
        </Campo>

        <Campo rotulo="Observações" erro={errors.observacoes?.message}>
          {(props) => (
            <Textarea {...props} rows={5} {...register("observacoes")} />
          )}
        </Campo>
      </div>

      <AcoesDeEdicao enviando={isSubmitting} aoCancelar={fechar} />
    </form>
  );
}
