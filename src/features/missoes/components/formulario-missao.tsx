"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { DialogoLink } from "@/features/config/components/painel-usuarios";

import { atualizarMissao, criarMissao } from "../actions";
import { criacaoMissaoSchema } from "../schemas";

/* O formulário sempre usa o schema de criação: os campos do responsável são
   opcionais, e na edição eles simplesmente não são renderizados. Cada action
   revalida com o schema que lhe cabe. */
type Entrada = z.input<typeof criacaoMissaoSchema>;
type Saida = z.output<typeof criacaoMissaoSchema>;

export const VALORES_INICIAIS: Entrada = {
  nome: "",
  cidade: "São Paulo",
  regiao: "",
  endereco: "",
  dataFundacao: "",
  contatoTelefone: "",
  membrosTotal: "",
  observacoes: "",
  ativo: true,
  responsavelNome: "",
  responsavelEmail: "",
};

export function FormularioMissao({
  missaoId,
  valores = VALORES_INICIAIS,
  podeArquivar = false,
}: {
  /** Ausente = criação. */
  missaoId?: string;
  valores?: Entrada;
  /** Arquivar é ato de admin; o campo some para os demais. */
  podeArquivar?: boolean;
}) {
  const router = useRouter();
  const [convite, setConvite] = useState<{ link: string; email: string } | null>(
    null,
  );

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(criacaoMissaoSchema),
    defaultValues: valores,
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function enviar(dados: Saida) {
    const resultado = missaoId
      ? await atualizarMissao(missaoId, dados)
      : await criarMissao(dados);

    if (!resultado.ok) {
      // Erros vindos do servidor voltam para o campo que os causou, em vez de
      // virarem um aviso genérico no topo.
      for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
        setError(campo as keyof Entrada, { message: mensagem });
      }
      toast.error(resultado.erro);
      return;
    }

    toast.success(missaoId ? "Missão atualizada" : "Missão criada");

    if (!missaoId) {
      const dados = (resultado as {
        dados: { id: string; link: string | null; email: string | null };
      }).dados;

      // Com responsável convidado, o link é a última coisa a fazer antes de
      // sair da tela — navegar direto o perderia.
      if (dados.link && dados.email) {
        setConvite({ link: dados.link, email: dados.email });
        router.refresh();
        return;
      }

      router.push(`/missoes/${dados.id}`);
      router.refresh();
      return;
    }

    router.push(`/missoes/${missaoId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-6" noValidate>
      <p className="text-muted-foreground text-sm text-pretty">
        Apenas os campos marcados com{" "}
        <span className="text-destructive" aria-hidden>
          *
        </span>
        <span className="sr-only">asterisco</span> são obrigatórios. Os demais
        podem ficar em branco e ser preenchidos depois.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
          <CardDescription>Como a missão é reconhecida.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Nome da missão"
            obrigatorio
            erro={errors.nome?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                {...register("nome")}
                placeholder="Missão Nossa Senhora Aparecida"
                autoFocus
              />
            )}
          </Campo>

          <Campo rotulo="Cidade" obrigatorio erro={errors.cidade?.message}>
            {(props) => <Input {...props} {...register("cidade")} />}
          </Campo>

          <Campo
            rotulo="Região ou bairro"
            ajuda="Ajuda a agrupar missões próximas nos relatórios."
            erro={errors.regiao?.message}
          >
            {(props) => (
              <Input {...props} {...register("regiao")} placeholder="Zona Leste" />
            )}
          </Campo>

          <Campo
            rotulo="Endereço"
            erro={errors.endereco?.message}
            className="sm:col-span-2"
          >
            {(props) => <Input {...props} {...register("endereco")} />}
          </Campo>

          <Campo
            rotulo="Data de fundação"
            erro={errors.dataFundacao?.message}
          >
            {(props) => (
              <Input {...props} type="date" {...register("dataFundacao")} />
            )}
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
          <CardDescription>
            Telefone público da missão. Quem responde por ela é definido pela
            conta de responsável, em Equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
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
        </CardContent>
      </Card>

      {!missaoId ? (
        <Card>
          <CardHeader>
            <CardTitle>Responsável pela missão</CardTitle>
            <CardDescription>
              Quem vai responder por ela e convidar os auxiliares. A conta é
              criada sem senha: ao salvar, você recebe um link para enviar.
              Pode ficar em branco e ser definido depois, em Equipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Campo
              rotulo="Nome completo"
              erro={errors.responsavelNome?.message}
            >
              {(props) => (
                <Input {...props} {...register("responsavelNome")} />
              )}
            </Campo>

            <Campo rotulo="E-mail" erro={errors.responsavelEmail?.message}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  inputMode="email"
                  {...register("responsavelEmail")}
                />
              )}
            </Campo>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>
            O número de grupos e de pessoas em grupos vem automaticamente do
            cadastro de grupos de oração.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Total de membros"
            ajuda="Em branco conta como zero. O histórico mensal é registrado à parte."
            erro={errors.membrosTotal?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="tabular"
                {...register("membrosTotal")}
              />
            )}
          </Campo>

          <Campo
            rotulo="Observações"
            erro={errors.observacoes?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea {...props} rows={4} {...register("observacoes")} />
            )}
          </Campo>

          {podeArquivar ? (
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4 sm:col-span-2">
              <div className="space-y-1">
                <Label htmlFor="ativo">Missão ativa</Label>
                <p className="text-muted-foreground text-xs">
                  Missões inativas somem das listagens e dos indicadores, mas o
                  histórico é preservado.
                </p>
              </div>
              {/* Controller em vez de watch(): watch() devolve uma função
                  que o React Compiler não consegue memoizar, e isso faz ele
                  desistir de otimizar o formulário inteiro. */}
              <Controller
                control={control}
                name="ativo"
                render={({ field }) => (
                  <Switch
                    id="ativo"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="cursor-pointer"
                  />
                )}
              />
            </div>
          ) : null}
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
          ) : missaoId ? (
            "Salvar alterações"
          ) : (
            "Criar missão"
          )}
        </Button>
      </div>

      {convite ? (
        <DialogoLink
          link={convite.link}
          email={convite.email}
          aoFechar={() => router.push("/missoes")}
        />
      ) : null}
    </form>
  );
}
