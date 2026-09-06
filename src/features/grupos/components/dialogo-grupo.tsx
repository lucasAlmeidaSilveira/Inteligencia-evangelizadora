"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import { ItemPresente, Presenca } from "@/components/padroes/presenca";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { CentroParaSelecao } from "@/features/centros/queries";
import { SEM_CENTRO } from "@/features/centros/schemas";

import { atualizarGrupo, criarGrupo } from "../actions";
import { DIAS_SEMANA, grupoSchema } from "../schemas";

type Entrada = z.input<typeof grupoSchema>;
type Saida = z.output<typeof grupoSchema>;

const NOVO: Entrada = {
  nome: "",
  centroId: "",
  quantidadePessoas: "",
  diaSemana: "",
  horario: "",
  local: "",
  observacoes: "",
  ativo: true,
  pastores: [{ nome: "", telefone: "" }],
};

/**
 * Montado apenas enquanto aberto, e com `key` por grupo na lista.
 * É assim que o React manda reiniciar estado — remontando — em vez de chamar
 * `reset()` dentro de um efeito, que renderiza duas vezes e deixa o
 * formulário momentaneamente com os dados do grupo anterior.
 */
export function DialogoGrupo({
  missaoId,
  centros,
  grupoId,
  valores,
  aberto,
  aoFechar,
}: {
  missaoId: string;
  centros: CentroParaSelecao[];
  /** Ausente = novo grupo. */
  grupoId?: string;
  valores?: Entrada;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(grupoSchema),
    defaultValues: valores ?? NOVO,
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const pastores = useFieldArray({ control, name: "pastores" });

  /**
   * Sem isto, clicar em "Salvar" com um campo inválido não produz reação
   * alguma: o erro pode estar fora da área visível do diálogo rolável, e a
   * conclusão natural do usuário é que o sistema perdeu o que ele digitou.
   */
  function aoFalharValidacao() {
    toast.error("Confira os campos destacados antes de salvar.");
  }

  async function enviar(dados: Saida) {
    const resultado = grupoId
      ? await atualizarGrupo(grupoId, dados)
      : await criarGrupo(missaoId, dados);

    if (!resultado.ok) {
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as never, { message: mensagem });
      }
      setErroGeral(resultado.erro);
      return;
    }

    toast.success(grupoId ? "Grupo atualizado" : "Grupo criado");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(enviar, aoFalharValidacao)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {grupoId ? "Editar grupo de oração" : "Novo grupo de oração"}
            </DialogTitle>
            <DialogDescription>
              O total de pessoas informado aqui alimenta os indicadores da
              missão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <p className="text-muted-foreground text-sm">
              Apenas os campos marcados com{" "}
              <span className="text-destructive" aria-hidden>
                *
              </span>
              <span className="sr-only">asterisco</span> são obrigatórios.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Nome do grupo"
                obrigatorio
                erro={errors.nome?.message}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("nome")}
                    placeholder="Grupo Sagrado Coração"
                  />
                )}
              </Campo>

              <Campo
                rotulo="Centro de evangelização"
                ajuda={
                  centros.length === 0
                    ? "Nenhum centro cadastrado nesta missão ainda."
                    : undefined
                }
                erro={errors.centroId?.message}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Controller
                    control={control}
                    name="centroId"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : SEM_CENTRO}
                        onValueChange={(v) =>
                          field.onChange(v === SEM_CENTRO ? "" : v)
                        }
                        disabled={centros.length === 0}
                      >
                        <SelectTrigger {...props} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_CENTRO}>
                            Diretamente na missão
                          </SelectItem>
                          {centros.map((centro) => (
                            <SelectItem key={centro.id} value={centro.id}>
                              {centro.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Pessoas no grupo"
                ajuda="Em branco conta como zero."
                erro={errors.quantidadePessoas?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    className="tabular"
                    {...register("quantidadePessoas")}
                  />
                )}
              </Campo>

              <Campo rotulo="Horário" erro={errors.horario?.message}>
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    className="tabular"
                    {...register("horario")}
                  />
                )}
              </Campo>

              <Campo rotulo="Dia da semana" erro={errors.diaSemana?.message}>
                {(props) => (
                  <Controller
                    control={control}
                    name="diaSemana"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger {...props} className="w-full">
                          <SelectValue placeholder="Não definido" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map((dia) => (
                            <SelectItem key={dia.valor} value={dia.valor}>
                              {dia.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Campo>

              <Campo rotulo="Local" erro={errors.local?.message}>
                {(props) => (
                  <Input
                    {...props}
                    {...register("local")}
                    placeholder="Casa da família Silva"
                  />
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
            </div>

            {/* ─── Pastores ────────────────────────────────────────────── */}
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1.5 text-sm font-medium">Pastores</legend>

              <p className="text-muted-foreground -mt-1 text-xs">
                De 1 a 3 pastores respondem pelo grupo. O limite é garantido
                pelo banco de dados.
              </p>

              {/* O formulário cresce e encolhe dentro de um diálogo centrado
                  por `-translate-y-1/2`: sem transição, a caixa inteira salta e
                  o campo em que a pessoa estava digitando muda de lugar sem
                  aviso. Só opacidade e deslocamento — a altura não é animada,
                  para não brigar com a recentragem do diálogo.

                  Aqui a `Presenca` funciona no caso mais simples: adicionar e
                  remover pastor é estado do cliente, sem ida ao servidor. */}
              <Presenca>
                {pastores.fields.map((campo, indice) => (
                  <ItemPresente
                    key={campo.id}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    {/* Campos controlados por `Controller`, não por `register`.
                        Numa lista que cresce e encolhe, o input não controlado
                        guarda o valor no próprio nó do DOM — e o que o
                        formulário envia passa a depender de como o React
                        reaproveitou os nós ao inserir uma linha. Controlado, o
                        que aparece na tela é exatamente o que está no estado e o
                        que será salvo.

                        `autoComplete="off"` fecha o outro caminho: o navegador
                        reconhece dois campos de nome seguidos e oferece
                        preencher o segundo com o que foi digitado no primeiro. */}
                    <Campo
                      rotulo={`Pastor ${indice + 1}`}
                      obrigatorio
                      erro={errors.pastores?.[indice]?.nome?.message}
                    >
                      {(props) => (
                        <Controller
                          control={control}
                          name={`pastores.${indice}.nome`}
                          render={({ field }) => (
                            <Input
                              {...props}
                              {...field}
                              value={field.value ?? ""}
                              autoComplete="off"
                              placeholder="Nome completo"
                            />
                          )}
                        />
                      )}
                    </Campo>

                    <Campo
                      rotulo="Telefone"
                      erro={errors.pastores?.[indice]?.telefone?.message}
                    >
                      {(props) => (
                        <Controller
                          control={control}
                          name={`pastores.${indice}.telefone`}
                          render={({ field }) => (
                            <Input
                              {...props}
                              {...field}
                              value={field.value ?? ""}
                              type="tel"
                              inputMode="tel"
                              autoComplete="off"
                              placeholder="(11) 90000-0000"
                            />
                          )}
                        />
                      )}
                    </Campo>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        aria-label={`Remover pastor ${indice + 1}`}
                        disabled={pastores.fields.length === 1}
                        onClick={() => pastores.remove(indice)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </ItemPresente>
                ))}
              </Presenca>

              {errors.pastores?.message ? (
                <p className="text-destructive text-xs" role="alert">
                  {errors.pastores.message}
                </p>
              ) : null}

              {pastores.fields.length < 3 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => pastores.append({ nome: "", telefone: "" })}
                >
                  <Plus aria-hidden />
                  Adicionar pastor
                </Button>
              ) : null}
            </fieldset>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="grupo-ativo">Grupo ativo</Label>
                <p className="text-muted-foreground text-xs">
                  Grupos inativos não entram na contagem de indicadores da
                  missão.
                </p>
              </div>
              <Controller
                control={control}
                name="ativo"
                render={({ field }) => (
                  <Switch
                    id="grupo-ativo"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="cursor-pointer"
                  />
                )}
              />
            </div>

            {erroGeral ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {erroGeral}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={aoFechar}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : grupoId ? (
                "Salvar alterações"
              ) : (
                "Criar grupo"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
