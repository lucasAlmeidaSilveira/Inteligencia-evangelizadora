"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import {
  AcoesDeEdicao,
  CartaoEditavel,
} from "@/components/padroes/cartao-editavel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeloTipoCentro } from "@/features/centros/components/selo-tipo-centro";
import { formatarData, formatarPeriodo, paraDatetimeLocal } from "@/lib/format";
import type { TipoCentro } from "@/server/db/schema";

import { atualizarInformacoes } from "../actions";
import { informacoesSchema, STATUS_EVENTO } from "../schemas";
import { SeletorQuando } from "./seletor-quando";
import { SeloStatus } from "./selo-status";
import { tratarResultado } from "./resultado-edicao";

type Entrada = z.input<typeof informacoesSchema>;
type Saida = z.output<typeof informacoesSchema>;

export type InformacoesDaAcao = {
  centroId: string;
  centroNome: string;
  centroTipo: TipoCentro;
  tipoEventoId: string;
  tipoNome: string;
  tipoCor: string;
  missaoId: string;
  missaoNome: string;
  dataInicio: string;
  dataFim: string;
  local: string | null;
  endereco: string | null;
  responsavelNome: string | null;
  status: Saida["status"];
  criadoEm: string;
  atualizadoEm: string;
};

export function CartaoInformacoes({
  eventoId,
  informacoes,
  tipos,
  /** Só os centros da missão desta ação — a FK composta recusa os de outra. */
  centros,
  className,
}: {
  eventoId: string;
  informacoes: InformacoesDaAcao;
  tipos: { id: string; nome: string; cor: string }[];
  centros: { id: string; nome: string; principal: boolean }[];
  className?: string;
}) {
  return (
    <CartaoEditavel titulo="Informações da ação" className={className}>
      {({ editando, fechar }) =>
        editando ? (
          <Formulario
            eventoId={eventoId}
            informacoes={informacoes}
            tipos={tipos}
            centros={centros}
            fechar={fechar}
            key={informacoes.atualizadoEm}
          />
        ) : (
          <Leitura informacoes={informacoes} />
        )
      }
    </CartaoEditavel>
  );
}

function Leitura({ informacoes }: { informacoes: InformacoesDaAcao }) {
  return (
    <div className="space-y-4 text-sm">
      <Info rotulo="Tipo da ação">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: informacoes.tipoCor }}
          />
          {informacoes.tipoNome}
        </span>
      </Info>

      {/* Trocar a missão recoloca o centro e mexe no escopo inteiro da ação —
          fica no formulário completo, em /editar. Aqui é só o caminho. */}
      <Info rotulo="Missão">
        <Link
          href={`/missoes/${informacoes.missaoId}`}
          className="rounded-sm underline-offset-4 hover:underline"
        >
          {informacoes.missaoNome}
        </Link>
      </Info>

      <Info rotulo="Centro de evangelização">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words">{informacoes.centroNome}</span>
          <SeloTipoCentro tipo={informacoes.centroTipo} />
        </span>
      </Info>

      <Info rotulo="Responsável">
        {informacoes.responsavelNome ?? (
          <span className="text-muted-foreground">Não informado</span>
        )}
      </Info>

      <Info rotulo="Período">
        {formatarPeriodo(informacoes.dataInicio, informacoes.dataFim)}
      </Info>

      {informacoes.local || informacoes.endereco ? (
        <Info rotulo="Local">
          <span className="flex gap-2">
            <MapPin
              className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block break-words">
                {informacoes.local ?? informacoes.endereco}
              </span>
              {informacoes.local && informacoes.endereco ? (
                <span className="text-muted-foreground block break-words">
                  {informacoes.endereco}
                </span>
              ) : null}
            </span>
          </span>
        </Info>
      ) : null}

      <Info rotulo="Situação">
        <SeloStatus status={informacoes.status} />
      </Info>

      <Info rotulo="Registro">
        <span className="text-muted-foreground">
          Criada em {formatarData(informacoes.criadoEm)} · atualizada em{" "}
          {formatarData(informacoes.atualizadoEm)}
        </span>
      </Info>
    </div>
  );
}

function Formulario({
  eventoId,
  informacoes,
  tipos,
  centros,
  fechar,
}: {
  eventoId: string;
  informacoes: InformacoesDaAcao;
  tipos: { id: string; nome: string; cor: string }[];
  centros: { id: string; nome: string; principal: boolean }[];
  fechar: () => void;
}) {
  const router = useRouter();
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(informacoesSchema),
    defaultValues: {
      centroId: informacoes.centroId,
      tipoEventoId: informacoes.tipoEventoId,
      dataInicio: paraDatetimeLocal(informacoes.dataInicio),
      dataFim: paraDatetimeLocal(informacoes.dataFim),
      local: informacoes.local ?? "",
      endereco: informacoes.endereco ?? "",
      responsavelNome: informacoes.responsavelNome ?? "",
      status: informacoes.status,
    },
  });

  /* `useWatch` e não `watch`: o segundo devolve uma função, que o React
     Compiler não consegue memoizar — ele então desiste de otimizar o cartão
     inteiro, e o ESLint acusa. */
  const dataInicio = useWatch({ control, name: "dataInicio" });
  const dataFim = useWatch({ control, name: "dataFim" });

  async function enviar(dados: Saida) {
    tratarResultado(await atualizarInformacoes(eventoId, dados), {
      setError,
      fechar,
      atualizar: () => router.refresh(),
      mensagem: "Informações atualizadas",
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Tipo da ação"
          obrigatorio
          erro={errors.tipoEventoId?.message}
        >
          {(props) => (
            <Controller
              control={control}
              name="tipoEventoId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue placeholder="Escolha o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: t.cor }}
                          />
                          {t.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Campo>

        <Campo
          rotulo="Centro de evangelização"
          obrigatorio
          erro={errors.centroId?.message}
        >
          {(props) => (
            <Controller
              control={control}
              name="centroId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue placeholder="Escolha o centro" />
                  </SelectTrigger>
                  <SelectContent>
                    {centros.map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {centro.nome}
                        {centro.principal ? " · principal" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Campo>

        <Campo
          rotulo="Responsável"
          ajuda="Não precisa ter login no sistema."
          erro={errors.responsavelNome?.message}
          className="sm:col-span-2"
        >
          {(props) => (
            <Input
              {...props}
              placeholder="João Silva"
              autoFocus
              {...register("responsavelNome")}
            />
          )}
        </Campo>

        <SeletorQuando
          className="sm:col-span-2"
          inicio={dataInicio ?? ""}
          fim={dataFim ?? ""}
          onChange={({ inicio, fim }) => {
            /* `shouldValidate` para a regra de período responder ao mesmo
               gesto que a quebrou, em vez de só ao salvar. */
            setValue("dataInicio", inicio, { shouldValidate: true });
            setValue("dataFim", fim, { shouldValidate: true });
          }}
          erroInicio={errors.dataInicio?.message}
          erroFim={errors.dataFim?.message}
        />

        <Campo rotulo="Local" erro={errors.local?.message}>
          {(props) => (
            <Input
              {...props}
              placeholder="Paróquia São José"
              {...register("local")}
            />
          )}
        </Campo>

        <Campo rotulo="Endereço" erro={errors.endereco?.message}>
          {(props) => <Input {...props} {...register("endereco")} />}
        </Campo>

        <Campo
          rotulo="Situação"
          obrigatorio
          erro={errors.status?.message}
          className="sm:col-span-2"
        >
          {(props) => (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_EVENTO.map((s) => (
                      <SelectItem key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Campo>
      </div>

      <AcoesDeEdicao enviando={isSubmitting} aoCancelar={fechar} />
    </form>
  );
}

function Info({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{rotulo}</p>
      <div className="break-words">{children}</div>
    </div>
  );
}
