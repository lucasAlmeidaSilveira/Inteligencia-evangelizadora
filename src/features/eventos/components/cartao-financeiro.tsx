"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import {
  AcoesDeEdicao,
  CartaoEditavel,
} from "@/components/padroes/cartao-editavel";
import { MetricaCompacta } from "@/components/padroes/metrica-compacta";
import { Input } from "@/components/ui/input";
import { formatarMoeda } from "@/lib/format";

import { atualizarOrcamento } from "../actions";
import { compararOrcamento, type Financeiro } from "../financeiro";
import { orcamentoSchema } from "../schemas";
import { tratarResultado } from "./resultado-edicao";

type Entrada = z.input<typeof orcamentoSchema>;
type Saida = z.output<typeof orcamentoSchema>;

export function CartaoFinanceiro({
  eventoId,
  orcamentoPrevisto,
  financeiro,
}: {
  eventoId: string;
  orcamentoPrevisto: string | null;
  financeiro: Financeiro;
}) {
  return (
    <CartaoEditavel
      titulo="Financeiro"
      acao={
        <Link
          href={`/eventos/${eventoId}/financeiro`}
          className="text-primary flex items-center gap-1 rounded-sm px-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          Ver lançamentos
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      {({ editando, fechar }) => (
        <div className="space-y-4">
          <Numeros
            orcamentoPrevisto={orcamentoPrevisto}
            financeiro={financeiro}
            editando={editando}
          />

          {editando ? (
            <Formulario
              eventoId={eventoId}
              orcamentoPrevisto={orcamentoPrevisto}
              fechar={fechar}
              key={orcamentoPrevisto ?? ""}
            />
          ) : null}
        </div>
      )}
    </CartaoEditavel>
  );
}

/**
 * Receitas, despesas e saldo continuam à vista durante a edição — e continuam
 * só de leitura, porque saem dos lançamentos, não de um campo. Escondê-los
 * tiraria da tela justamente o número contra o qual se decide o orçamento.
 */
function Numeros({
  orcamentoPrevisto,
  financeiro,
  editando,
}: {
  orcamentoPrevisto: string | null;
  financeiro: Financeiro;
  editando: boolean;
}) {
  const { receitas, despesas, saldo } = financeiro;
  const orcamento = compararOrcamento(orcamentoPrevisto, despesas);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Editando, o previsto vira o campo abaixo: repeti-lo aqui daria dois
            lugares mostrando o mesmo valor, um deles desatualizado. */}
        {editando ? null : (
          <MetricaCompacta
            rotulo="Previsto"
            valor={
              orcamento.previsto === null
                ? "—"
                : formatarMoeda(orcamento.previsto)
            }
            detalhe={orcamento.previsto === null ? "Não orçado" : undefined}
            tom={orcamento.previsto === null ? "atenuado" : "normal"}
          />
        )}
        <MetricaCompacta rotulo="Receitas" valor={formatarMoeda(receitas)} />
        <MetricaCompacta rotulo="Despesas" valor={formatarMoeda(despesas)} />
        {/* Saldo negativo leva cor e palavra: cor sozinha não diferencia para
            quem não distingue matizes. */}
        <MetricaCompacta
          rotulo="Saldo"
          valor={formatarMoeda(saldo)}
          tom={saldo < 0 ? "negativo" : "positivo"}
          detalhe={saldo < 0 ? "No vermelho" : undefined}
        />
      </div>

      {!editando && orcamento.previsto !== null ? (
        <BarraOrcamento
          percentual={orcamento.percentual}
          restante={orcamento.restante}
        />
      ) : null}
    </>
  );
}

function Formulario({
  eventoId,
  orcamentoPrevisto,
  fechar,
}: {
  eventoId: string;
  orcamentoPrevisto: string | null;
  fechar: () => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(orcamentoSchema),
    // Vazio, não "0,00": o campo em branco é o que diz "não orçado".
    defaultValues: { orcamentoPrevisto: orcamentoPrevisto ?? "" },
  });

  async function enviar(dados: Saida) {
    tratarResultado(await atualizarOrcamento(eventoId, dados), {
      setError,
      fechar,
      atualizar: () => router.refresh(),
      mensagem: "Orçamento atualizado",
    });
  }

  return (
    <form
      onSubmit={handleSubmit(enviar)}
      className="space-y-4 border-t pt-4"
      noValidate
    >
      <Campo
        rotulo="Orçamento previsto"
        ajuda="Quanto se planeja gastar. Deixe vazio se não houver orçamento."
        erro={errors.orcamentoPrevisto?.message}
        className="max-w-xs"
      >
        {(props) => (
          <Input
            {...props}
            inputMode="decimal"
            placeholder="0,00"
            className="tabular"
            autoFocus
            {...register("orcamentoPrevisto")}
          />
        )}
      </Campo>

      <AcoesDeEdicao enviando={isSubmitting} aoCancelar={fechar} />
    </form>
  );
}

/**
 * Previsto × executado. A barra não é decoração: mostra de relance se a ação
 * está dentro do que se planejou gastar, que é a pergunta da prestação de
 * contas. Estouro vira `destructive` **e** ganha a palavra "acima" — a cor
 * sozinha não conta a história.
 */
function BarraOrcamento({
  percentual,
  restante,
}: {
  percentual: number | null;
  restante: number | null;
}) {
  if (percentual === null || restante === null) return null;

  const estourou = restante < 0;
  const preenchido = Math.min(percentual, 100);

  return (
    <div className="space-y-1.5 border-t pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {Math.round(percentual)}% do orçamento executado
        </span>
        <span
          className={
            estourou
              ? "text-destructive tabular font-medium"
              : "text-muted-foreground tabular"
          }
        >
          {estourou
            ? `${formatarMoeda(Math.abs(restante))} acima do previsto`
            : `${formatarMoeda(restante)} disponíveis`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${Math.round(percentual)} por cento do orçamento executado`}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={estourou ? "bg-destructive h-full" : "bg-primary h-full"}
          style={{ width: `${preenchido}%` }}
        />
      </div>
    </div>
  );
}
