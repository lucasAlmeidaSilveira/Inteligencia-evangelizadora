"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { CentroParaSelecao } from "@/features/centros/queries";

import { atualizarEvento, criarEvento } from "../actions";
import { eventoSchema, STATUS_EVENTO } from "../schemas";

type Entrada = z.input<typeof eventoSchema>;
type Saida = z.output<typeof eventoSchema>;

export function FormularioEvento({
  eventoId,
  valores,
  missoes,
  centros,
  tipos,
}: {
  eventoId?: string;
  valores: Entrada;
  missoes: { id: string; nome: string }[];
  /** De todas as missões visíveis: a lista é filtrada aqui conforme a missão
   *  escolhida, sem uma ida ao servidor a cada troca. */
  centros: CentroParaSelecao[];
  tipos: { id: string; nome: string; cor: string }[];
}) {
  const router = useRouter();

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(eventoSchema),
    defaultValues: valores,
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  /* `useWatch` e não `form.watch`: o segundo devolve uma função, que o React
     Compiler não consegue memoizar — ele então desiste de otimizar o
     formulário inteiro, e o ESLint acusa. Este hook devolve o valor. */
  const missaoEscolhida = useWatch({ control, name: "missaoId" });
  const centrosDaMissao = centros.filter((c) => c.missaoId === missaoEscolhida);

  /** O centro que a missão sempre tem — o padrão ao trocar de missão. */
  function principalDaMissao(missaoId: string) {
    const daMissao = centros.filter((c) => c.missaoId === missaoId);
    return daMissao.find((c) => c.principal)?.id ?? daMissao[0]?.id ?? "";
  }

  async function enviar(dados: Saida) {
    const resultado = eventoId
      ? await atualizarEvento(eventoId, dados)
      : await criarEvento(dados);

    if (!resultado.ok) {
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as keyof Entrada, { message: mensagem });
      }
      toast.error(resultado.erro);
      return;
    }

    toast.success(eventoId ? "Ação atualizada" : "Ação apostólica criada");
    const destino =
      eventoId ?? (resultado as { dados: { id: string } }).dados.id;
    router.push(`/eventos/${destino}`);
    router.refresh();
  }

  function aoFalharValidacao() {
    toast.error("Confira os campos destacados antes de salvar.");
  }

  return (
    <form
      onSubmit={handleSubmit(enviar, aoFalharValidacao)}
      className="space-y-6"
      noValidate
    >
      <p className="text-muted-foreground text-sm text-pretty">
        Apenas os campos marcados com{" "}
        <span className="text-destructive" aria-hidden>
          *
        </span>
        <span className="sr-only">asterisco</span> são obrigatórios. Financeiro,
        documentos e links são adicionados depois, dentro da ação.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Título"
            obrigatorio
            erro={errors.titulo?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                {...register("titulo")}
                placeholder="Retiro de Carnaval 2026"
                autoFocus
              />
            )}
          </Campo>

          <Campo rotulo="Missão" obrigatorio erro={errors.missaoId?.message}>
            {(props) => (
              <Controller
                control={control}
                name="missaoId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // O centro pertence a uma missão só, e o banco recusa a
                      // combinação errada por FK composta. Trocar a missão
                      // recoloca o principal dela, em vez de esvaziar um campo
                      // obrigatório e devolver o erro só no Salvar.
                      setValue("centroId", principalDaMissao(v));
                    }}
                  >
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue placeholder="Escolha a missão" />
                    </SelectTrigger>
                    <SelectContent>
                      {missoes.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
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
            ajuda={
              missaoEscolhida
                ? undefined
                : "Escolha a missão primeiro."
            }
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
                    disabled={centrosDaMissao.length === 0}
                  >
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue placeholder="Escolha o centro" />
                    </SelectTrigger>
                    <SelectContent>
                      {centrosDaMissao.map((centro) => (
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

          <Campo rotulo="Situação" obrigatorio erro={errors.status?.message}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quando e onde</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Início"
            obrigatorio
            erro={errors.dataInicio?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="datetime-local"
                className="tabular"
                {...register("dataInicio")}
              />
            )}
          </Campo>

          <Campo rotulo="Término" obrigatorio erro={errors.dataFim?.message}>
            {(props) => (
              <Input
                {...props}
                type="datetime-local"
                className="tabular"
                {...register("dataFim")}
              />
            )}
          </Campo>

          <Campo rotulo="Local" erro={errors.local?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("local")}
                placeholder="Paróquia São José"
              />
            )}
          </Campo>

          <Campo rotulo="Endereço" erro={errors.endereco?.message}>
            {(props) => <Input {...props} {...register("endereco")} />}
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alcance</CardTitle>
          <CardDescription>
            Preencha depois de realizada, se ainda não souber os números.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Participantes"
            ajuda="Quantas pessoas foram alcançadas."
            erro={errors.participantesTotal?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="tabular"
                {...register("participantesTotal")}
              />
            )}
          </Campo>

          <Campo
            rotulo="Servos engajados"
            ajuda="Quantos serviram na realização."
            erro={errors.servosEngajados?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="tabular"
                {...register("servosEngajados")}
              />
            )}
          </Campo>

          <Campo
            rotulo="Descrição"
            erro={errors.descricao?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea {...props} rows={4} {...register("descricao")} />
            )}
          </Campo>

          <Campo
            rotulo="Observações"
            erro={errors.observacoes?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea {...props} rows={3} {...register("observacoes")} />
            )}
          </Campo>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          className="cursor-pointer"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" className="cursor-pointer" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : eventoId ? (
            "Salvar alterações"
          ) : (
            "Criar ação apostólica"
          )}
        </Button>
      </div>
    </form>
  );
}
