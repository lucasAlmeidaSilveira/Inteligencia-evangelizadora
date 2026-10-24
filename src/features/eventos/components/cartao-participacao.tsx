"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HandHeart } from "lucide-react";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import {
  AcoesDeEdicao,
  CartaoEditavel,
} from "@/components/padroes/cartao-editavel";
import { MetricaCompacta } from "@/components/padroes/metrica-compacta";
import { Input } from "@/components/ui/input";
import { formatarNumero } from "@/lib/format";

import {
  descreverFonte,
  type Satisfacao,
} from "@/features/pesquisas/satisfacao";

import { atualizarParticipacao } from "../actions";
import { formatarNps } from "../impacto";
import { calcularParticipacao, formatarTaxa } from "../participacao";
import { participacaoSchema } from "../schemas";
import { tratarResultado } from "./resultado-edicao";

type Entrada = z.input<typeof participacaoSchema>;
type Saida = z.output<typeof participacaoSchema>;

export type NumerosDaParticipacao = Saida;

export function CartaoParticipacao({
  eventoId,
  valores,
  satisfacao,
}: {
  eventoId: string;
  valores: NumerosDaParticipacao;
  /** A nota efetiva — da pesquisa quando há respostas, manual se não. */
  satisfacao: Satisfacao;
}) {
  return (
    <CartaoEditavel titulo="Participação">
      {({ editando, fechar }) =>
        editando ? (
          <Formulario
            eventoId={eventoId}
            valores={valores}
            temPesquisa={satisfacao.fonte === "pesquisa"}
            fechar={fechar}
            /* `key` pelos valores: reabrir o card depois de gravar precisa
               recarregar os defaults do react-hook-form, que só lê
               `defaultValues` na montagem. */
            key={JSON.stringify(valores)}
          />
        ) : (
          <Leitura valores={valores} satisfacao={satisfacao} />
        )
      }
    </CartaoEditavel>
  );
}

function Leitura({
  valores,
  satisfacao,
}: {
  valores: NumerosDaParticipacao;
  satisfacao: Satisfacao;
}) {
  const participacao = calcularParticipacao(valores);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <MetricaCompacta
          rotulo="Inscritos"
          valor={formatarNumero(participacao.inscritos)}
        />
        <MetricaCompacta
          rotulo="Presentes"
          valor={formatarNumero(participacao.presentes)}
        />
        <MetricaCompacta
          rotulo="Novos"
          valor={formatarNumero(participacao.novos)}
        />
        <MetricaCompacta
          rotulo="Permaneceram"
          valor={formatarNumero(participacao.permaneceram)}
        />
        {/* A taxa é o número que a missão de fato acompanha: quantos dos que
            vieram seguiram num grupo de oração depois. */}
        <MetricaCompacta
          rotulo="Permanência"
          valor={formatarTaxa(participacao.taxaPermanencia)}
          detalhe={
            participacao.taxaPermanencia === null
              ? "Sem presentes informados"
              : undefined
          }
        />
        {/* Nota de 0 a 10, e de onde veio: as respostas da pesquisa pública
            têm prioridade sobre a nota digitada. Vazia é "sem pesquisa",
            nunca zero: zero seria a pior nota. */}
        <MetricaCompacta
          rotulo="Satisfação (NPS)"
          valor={formatarNps(satisfacao.nota)}
          detalhe={descreverFonte(satisfacao)}
          tom={satisfacao.nota === null ? "atenuado" : "normal"}
        />
      </div>

      <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 border-t pt-3 text-sm">
        <HandHeart className="size-3.5 shrink-0" aria-hidden />
        <span className="tabular font-medium">
          {formatarNumero(valores.servosEngajados)}
        </span>
        {valores.servosEngajados === 1 ? "servo engajado" : "servos engajados"}
        {participacao.taxaComparecimento !== null ? (
          <span className="before:mx-2 before:content-['·']">
            {formatarTaxa(participacao.taxaComparecimento)} de comparecimento
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Formulario({
  eventoId,
  valores,
  temPesquisa,
  fechar,
}: {
  eventoId: string;
  valores: NumerosDaParticipacao;
  temPesquisa: boolean;
  fechar: () => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(participacaoSchema),
    // Vazio, não "0": o input em branco é o que diz "sem pesquisa".
    defaultValues: { ...valores, nps: valores.nps ?? "" },
  });

  async function enviar(dados: Saida) {
    tratarResultado(await atualizarParticipacao(eventoId, dados), {
      setError,
      fechar,
      atualizar: () => router.refresh(),
      mensagem: "Participação atualizada",
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Campo
          rotulo="Inscritos"
          erro={errors.participantesInscritos?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              className="tabular"
              autoFocus
              {...register("participantesInscritos")}
            />
          )}
        </Campo>

        <Campo
          rotulo="Presentes"
          ajuda="É este o número que entra nos relatórios."
          erro={errors.participantesTotal?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              className="tabular"
              {...register("participantesTotal")}
            />
          )}
        </Campo>

        <Campo rotulo="Novos" erro={errors.participantesNovos?.message}>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              className="tabular"
              {...register("participantesNovos")}
            />
          )}
        </Campo>

        <Campo
          rotulo="Permaneceram"
          ajuda="Seguiram num grupo de oração depois."
          erro={errors.participantesPermaneceram?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              className="tabular"
              {...register("participantesPermaneceram")}
            />
          )}
        </Campo>

        <Campo
          rotulo="Servos engajados"
          erro={errors.servosEngajados?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              className="tabular"
              {...register("servosEngajados")}
            />
          )}
        </Campo>

        <Campo
          rotulo="Satisfação (NPS)"
          ajuda={
            temPesquisa
              ? "Nota manual. Enquanto houver respostas na pesquisa, elas têm prioridade."
              : "Nota média de 0 a 10. Vazio se não houve pesquisa."
          }
          erro={errors.nps?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              step={0.1}
              placeholder="0 a 10"
              className="tabular"
              {...register("nps")}
            />
          )}
        </Campo>
      </div>

      <AcoesDeEdicao enviando={isSubmitting} aoCancelar={fechar} />
    </form>
  );
}
