"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { EstadoVazio } from "@/components/padroes/estado-vazio";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarNumero } from "@/lib/format";

import { excluirGrupo } from "../actions";
import type { GrupoListado } from "../queries";
import { nomeDoDia } from "../schemas";
import { DialogoGrupo } from "./dialogo-grupo";

/** Converte o registro do banco de volta para o formato do formulário. */
function paraFormulario(grupo: GrupoListado) {
  return {
    nome: grupo.nome,
    quantidadePessoas: grupo.quantidadePessoas,
    diaSemana: grupo.diaSemana === null ? "" : String(grupo.diaSemana),
    // O Postgres devolve `time` como "19:30:00"; o input espera "19:30".
    horario: grupo.horario ? grupo.horario.slice(0, 5) : "",
    local: grupo.local ?? "",
    observacoes: grupo.observacoes ?? "",
    ativo: grupo.ativo,
    pastores: grupo.pastores.map((p) => ({
      nome: p.nome,
      telefone: p.telefone ?? "",
    })),
  };
}

export function ListaGrupos({
  missaoId,
  grupos,
}: {
  missaoId: string;
  grupos: GrupoListado[];
}) {
  const router = useRouter();
  const [excluindo, iniciarExclusao] = useTransition();

  const [emEdicao, setEmEdicao] = useState<GrupoListado | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<GrupoListado | null>(null);

  function confirmarExclusao() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;

    iniciarExclusao(async () => {
      const resultado = await excluirGrupo(alvo.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Grupo excluído");
      setParaExcluir(null);
      router.refresh();
    });
  }

  const ativos = grupos.filter((g) => g.ativo);
  const pessoas = ativos.reduce((soma, g) => soma + g.quantidadePessoas, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {grupos.length === 0
            ? "Nenhum grupo cadastrado."
            : `${formatarNumero(ativos.length)} grupo(s) ativo(s) reunindo ${formatarNumero(pessoas)} pessoas.`}
        </p>
        <Button className="cursor-pointer" onClick={() => setCriando(true)}>
          <Plus aria-hidden />
          Novo grupo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <EstadoVazio
          Icone={UsersRound}
          titulo="Nenhum grupo de oração"
          descricao="Cadastre os grupos da missão com seus pastores. O total de pessoas reunidas passa a aparecer nos indicadores."
        >
          <Button className="cursor-pointer" onClick={() => setCriando(true)}>
            <Plus aria-hidden />
            Cadastrar grupo
          </Button>
        </EstadoVazio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grupos.map((grupo) => {
            const dia = nomeDoDia(grupo.diaSemana);
            const encontro = [dia, grupo.horario?.slice(0, 5)]
              .filter(Boolean)
              .join(" às ");

            return (
              <Card key={grupo.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{grupo.nome}</h3>
                        {!grupo.ativo ? (
                          <Badge variant="secondary">Inativo</Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {formatarNumero(grupo.quantidadePessoas)} pessoas
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mt-1 -mr-1 cursor-pointer"
                          aria-label={`Ações do grupo ${grupo.nome}`}
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setEmEdicao(grupo)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => setParaExcluir(grupo)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {encontro || grupo.local ? (
                    <div className="text-muted-foreground space-y-1.5 text-sm">
                      {encontro ? (
                        <p className="flex items-center gap-1.5">
                          <Clock className="size-3.5 shrink-0" aria-hidden />
                          {encontro}
                        </p>
                      ) : null}
                      {grupo.local ? (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          {grupo.local}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="border-t pt-3">
                    <p className="text-muted-foreground mb-1.5 text-xs">
                      {grupo.pastores.length === 1 ? "Pastor" : "Pastores"}
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {grupo.pastores.map((pastor) => (
                        <li key={pastor.id} className="flex flex-wrap gap-x-2">
                          <span>{pastor.nome}</span>
                          {pastor.telefone ? (
                            <span className="text-muted-foreground">
                              {pastor.telefone}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {criando ? (
        <DialogoGrupo
          missaoId={missaoId}
          aberto
          aoFechar={() => setCriando(false)}
        />
      ) : null}

      {emEdicao ? (
        <DialogoGrupo
          // Trocar de grupo troca a key, o que remonta o formulário já com os
          // valores certos — sem efeito de reset.
          key={emEdicao.id}
          missaoId={missaoId}
          grupoId={emEdicao.id}
          valores={paraFormulario(emEdicao)}
          aberto
          aoFechar={() => setEmEdicao(null)}
        />
      ) : null}

      <AlertDialog
        open={Boolean(paraExcluir)}
        onOpenChange={(v) => !v && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir “{paraExcluir?.nome}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O grupo e seus pastores serão removidos definitivamente, e as
              pessoas deixarão de contar nos indicadores da missão. Para apenas
              tirá-lo das contagens, prefira marcá-lo como inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={excluindo}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={excluindo}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
