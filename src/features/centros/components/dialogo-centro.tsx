"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Campo } from "@/components/padroes/campo";
import { SeletorData } from "@/components/padroes/seletor-data";
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

import { atualizarCentro, criarCentro } from "../actions";
import { centroSchema, TIPOS_CENTRO } from "../schemas";

type Entrada = z.input<typeof centroSchema>;
type Saida = z.output<typeof centroSchema>;

const NOVO: Entrada = {
  nome: "",
  tipo: "centro_evangelizacao",
  cidade: "",
  regiao: "",
  endereco: "",
  dataFundacao: "",
  contatoTelefone: "",
  observacoes: "",
  ativo: true,
};

/**
 * Montado apenas enquanto aberto, e com `key` por centro na lista.
 * É assim que o React manda reiniciar estado — remontando — em vez de chamar
 * `reset()` dentro de um efeito, que renderiza duas vezes e deixa o
 * formulário momentaneamente com os dados do centro anterior.
 */
export function DialogoCentro({
  missaoId,
  centroId,
  valores,
  aberto,
  aoFechar,
}: {
  missaoId: string;
  /** Ausente = novo centro. */
  centroId?: string;
  valores?: Entrada;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(centroSchema),
    defaultValues: valores ?? NOVO,
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  /**
   * Sem isto, clicar em "Salvar" com um campo inválido não produz reação
   * alguma: o erro pode estar fora da área visível do diálogo rolável, e a
   * conclusão natural do usuário é que o sistema perdeu o que ele digitou.
   */
  function aoFalharValidacao() {
    toast.error("Confira os campos destacados antes de salvar.");
  }

  async function enviar(dados: Saida) {
    const resultado = centroId
      ? await atualizarCentro(centroId, dados)
      : await criarCentro(missaoId, dados);

    if (!resultado.ok) {
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as never, { message: mensagem });
      }
      setErroGeral(resultado.erro);
      return;
    }

    toast.success(centroId ? "Centro atualizado" : "Centro criado");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(enviar, aoFalharValidacao)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {centroId
                ? "Editar centro de evangelização"
                : "Novo centro de evangelização"}
            </DialogTitle>
            <DialogDescription>
              Os grupos de oração e as ações apostólicas do centro são
              cadastrados depois, escolhendo este centro no formulário deles.
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
              <Campo rotulo="Nome" obrigatorio erro={errors.nome?.message}>
                {(props) => (
                  <Input
                    {...props}
                    {...register("nome")}
                    placeholder="Centro Santo Amaro"
                    autoFocus
                  />
                )}
              </Campo>

              {/* Select sempre por Controller: o Radix não emite evento nativo,
                  então `register` não enxergaria a mudança. */}
              <Campo rotulo="Tipo" obrigatorio erro={errors.tipo?.message}>
                {(props) => (
                  <Controller
                    control={control}
                    name="tipo"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...props} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CENTRO.map((t) => (
                            <SelectItem key={t.valor} value={t.valor}>
                              {t.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Cidade"
                ajuda="Em branco, entende-se a mesma da missão."
                erro={errors.cidade?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("cidade")}
                    placeholder="São Paulo"
                  />
                )}
              </Campo>

              <Campo rotulo="Região" erro={errors.regiao?.message}>
                {(props) => (
                  <Input
                    {...props}
                    {...register("regiao")}
                    placeholder="Zona Sul"
                  />
                )}
              </Campo>

              <Campo
                rotulo="Endereço"
                erro={errors.endereco?.message}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("endereco")}
                    placeholder="Rua das Flores, 100"
                  />
                )}
              </Campo>

              <Campo rotulo="Telefone" erro={errors.contatoTelefone?.message}>
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    {...register("contatoTelefone")}
                    placeholder="(11) 90000-0000"
                  />
                )}
              </Campo>

              <Campo rotulo="Fundação" erro={errors.dataFundacao?.message}>
                {(props) => (
                  <Controller
                    control={control}
                    name="dataFundacao"
                    render={({ field }) => (
                      <SeletorData
                        {...props}
                        valor={field.value ?? ""}
                        onChange={field.onChange}
                        // Opcional: centro antigo pode não ter a data.
                        permiteVazio
                        inicioEm={new Date(1980, 0, 1)}
                        fimEm={new Date()}
                      />
                    )}
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

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="centro-ativo">Centro ativo</Label>
                <p className="text-muted-foreground text-xs">
                  Centros inativos não entram na contagem da missão e deixam de
                  aparecer para novos grupos e ações. Os que já pertencem a ele
                  continuam onde estão.
                </p>
              </div>
              {/* Controller em vez de watch(): watch() devolve uma função que o
                  React Compiler não consegue memoizar, e isso faz ele desistir
                  de otimizar o formulário inteiro. */}
              <Controller
                control={control}
                name="ativo"
                render={({ field }) => (
                  <Switch
                    id="centro-ativo"
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
              ) : centroId ? (
                "Salvar alterações"
              ) : (
                "Criar centro"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
