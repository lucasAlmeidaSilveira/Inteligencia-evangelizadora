"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";

import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { ItemPresente, Presenca } from "@/components/padroes/presenca";
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

import type { CentroParaSelecao } from "@/features/centros/queries";

import { excluirGrupo } from "../actions";
import { FiltrosGrupos } from "./filtros-grupos";
import type { GrupoListado } from "../queries";
import { nomeDoDia } from "../schemas";
import { DialogoGrupo } from "./dialogo-grupo";

/** Converte o registro do banco de volta para o formato do formulário. */
function paraFormulario(grupo: GrupoListado) {
  return {
    nome: grupo.nome,
    centroId: grupo.centroId ?? "",
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
  centros,
  grupos,
  filtrado = false,
}: {
  missaoId: string;
  /** Todos os centros da missão, inclusive os arquivados — o filtro precisa
   *  deles. O diálogo recebe só os ativos. */
  centros: CentroParaSelecao[];
  grupos: GrupoListado[];
  /** Há recorte por centro na URL: muda o que dizer quando a lista vem vazia. */
  filtrado?: boolean;
}) {
  const router = useRouter();
  const [excluindo, iniciarExclusao] = useTransition();

  // Centro arquivado não recebe vínculo novo, mas continua filtrável.
  const centrosAtivos = centros.filter((c) => c.ativo);

  /** Os ativos, mais o centro do próprio grupo quando ele já está arquivado. */
  function centrosParaEditar(grupo: GrupoListado) {
    const proprio = centros.find(
      (c) => c.id === grupo.centroId && !c.ativo,
    );
    return proprio
      ? [...centrosAtivos, { ...proprio, nome: `${proprio.nome} (inativo)` }]
      : centrosAtivos;
  }

  const [emEdicao, setEmEdicao] = useState<GrupoListado | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<GrupoListado | null>(null);

  /* O grupo sai do cartão antes da resposta do servidor — é essa saída que a
     `Presenca` anima, e é o que liga a confirmação ao efeito. Se a exclusão
     falhar, o `useOptimistic` devolve o grupo sozinho, com o toast de erro. */
  const [visiveis, esconder] = useOptimistic(grupos, (atual, id: string) =>
    atual.filter((g) => g.id !== id),
  );

  function confirmarExclusao() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;

    iniciarExclusao(async () => {
      esconder(alvo.id);
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

  // Contados sobre `visiveis`: o resumo acima da lista precisa cair junto com
  // o cartão, senão o número segue afirmando o que a tela já desmentiu.
  const ativos = visiveis.filter((g) => g.ativo);
  const pessoas = ativos.reduce((soma, g) => soma + g.quantidadePessoas, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {grupos.length === 0
            ? filtrado
              ? "Nenhum grupo neste recorte."
              : "Nenhum grupo cadastrado."
            : `${formatarNumero(ativos.length)} grupo(s) ativo(s) reunindo ${formatarNumero(pessoas)} pessoas.`}
        </p>
        <Button className="cursor-pointer" onClick={() => setCriando(true)}>
          <Plus aria-hidden />
          Novo grupo
        </Button>
      </div>

      {/* Só aparece quando há o que escolher: com a missão sem centro algum, o
          select traria "todos" e "diretamente na missão" — duas maneiras de
          dizer a mesma coisa. */}
      {centros.length > 0 ? <FiltrosGrupos centros={centros} /> : null}

      {grupos.length === 0 ? (
        filtrado ? (
          <EstadoVazio
            Icone={UsersRound}
            titulo="Nenhum grupo neste centro"
            descricao="Nenhum grupo de oração corresponde ao centro escolhido. Limpe o filtro para ver todos os grupos da missão, ou cadastre um grupo já vinculado a ele."
          >
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => router.push(`/missoes/${missaoId}/grupos`)}
            >
              Limpar filtro
            </Button>
          </EstadoVazio>
        ) : (
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
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Presenca>
            {visiveis.map((grupo) => {
              const dia = nomeDoDia(grupo.diaSemana);
              const encontro = [dia, grupo.horario?.slice(0, 5)]
                .filter(Boolean)
                .join(" às ");

              return (
                /* `h-full` no cartão: quem é item da grade agora é o wrapper da
                   Presenca, e sem isto o cartão para de esticar até a altura da
                   fileira — grupos com e sem local deixariam de se alinhar. */
                <ItemPresente key={grupo.id}>
                  <Card className="h-full">
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
                          {grupo.centroNome ? (
                            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                              <Waypoints
                                className="size-3.5 shrink-0"
                                aria-hidden
                              />
                              {grupo.centroNome}
                            </p>
                          ) : null}
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
                            <li
                              key={pastor.id}
                              className="flex flex-wrap gap-x-2"
                            >
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
                </ItemPresente>
              );
            })}
          </Presenca>
        </div>
      )}

      {criando ? (
        <DialogoGrupo
          missaoId={missaoId}
          centros={centrosAtivos}
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
          // O centro do grupo pode estar arquivado, e arquivado não entra na
          // lista de escolha. Sem devolvê-lo aqui, o select abriria em
          // "Diretamente na missão" e salvar desvincularia o grupo sem
          // ninguém pedir.
          centros={centrosParaEditar(emEdicao)}
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
