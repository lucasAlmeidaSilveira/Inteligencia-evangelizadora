"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
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

import { excluirCentro } from "../actions";
import type { CentroListado } from "../queries";
import { DialogoCentro } from "./dialogo-centro";
import { SeloTipoCentro } from "./selo-tipo-centro";

/** Converte o registro do banco de volta para o formato do formulário. */
function paraFormulario(centro: CentroListado) {
  return {
    nome: centro.nome,
    tipo: centro.tipo,
    cidade: centro.cidade ?? "",
    regiao: centro.regiao ?? "",
    endereco: centro.endereco ?? "",
    dataFundacao: centro.dataFundacao ?? "",
    contatoTelefone: centro.contatoTelefone ?? "",
    observacoes: centro.observacoes ?? "",
    ativo: centro.ativo,
  };
}

/** "3 grupos de oração e 2 ações apostólicas", sem as partes que são zero. */
function descreverVinculos(centro: { grupos: number; eventos: number }) {
  const partes: string[] = [];
  if (centro.grupos > 0) {
    partes.push(
      `${formatarNumero(centro.grupos)} ${centro.grupos === 1 ? "grupo de oração" : "grupos de oração"}`,
    );
  }
  if (centro.eventos > 0) {
    partes.push(
      `${formatarNumero(centro.eventos)} ${centro.eventos === 1 ? "ação apostólica" : "ações apostólicas"}`,
    );
  }
  return partes.join(" e ");
}

export function ListaCentros({
  missaoId,
  centros,
}: {
  missaoId: string;
  centros: CentroListado[];
}) {
  const router = useRouter();
  const [excluindo, iniciarExclusao] = useTransition();

  const [emEdicao, setEmEdicao] = useState<CentroListado | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<CentroListado | null>(null);

  /* O centro sai do cartão antes da resposta do servidor — é essa saída que a
     `Presenca` anima. Se a exclusão falhar, o `useOptimistic` o devolve
     sozinho, junto com o toast de erro. */
  const [visiveis, esconder] = useOptimistic(centros, (atual, id: string) =>
    atual.filter((c) => c.id !== id),
  );

  function confirmarExclusao() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;

    iniciarExclusao(async () => {
      esconder(alvo.id);
      const resultado = await excluirCentro(alvo.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }

      const movidos = descreverVinculos(resultado.dados);
      toast.success(
        movidos
          ? `Centro excluído — ${movidos} ${resultado.dados.grupos + resultado.dados.eventos === 1 ? "passou" : "passaram"} para o centro principal.`
          : "Centro excluído",
      );
      setParaExcluir(null);
      router.refresh();
    });
  }

  // Contados sobre `visiveis`: o resumo acima da lista precisa cair junto com
  // o cartão, senão o número segue afirmando o que a tela já desmentiu.
  const ativos = visiveis.filter((c) => c.ativo);
  const irradiacoes = ativos.filter((c) => c.tipo === "irradiacao").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm text-pretty">
          {centros.length === 0
            ? "Nenhum centro cadastrado."
            : `${formatarNumero(ativos.length)} ${ativos.length === 1 ? "frente ativa" : "frentes ativas"}${
                irradiacoes > 0
                  ? `, ${formatarNumero(irradiacoes)} ${irradiacoes === 1 ? "delas irradiação" : "delas irradiações"}`
                  : ""
              }.`}
        </p>
        <Button className="cursor-pointer" onClick={() => setCriando(true)}>
          <Plus aria-hidden />
          Novo centro
        </Button>
      </div>

      {centros.length === 0 ? (
        <EstadoVazio
          Icone={Waypoints}
          titulo="Nenhum centro de evangelização"
          descricao="Cadastre os centros e as irradiações da missão. Cada um funciona como uma missão pequena: os grupos de oração e as ações apostólicas passam a poder ser registrados sob ele."
        >
          <Button className="cursor-pointer" onClick={() => setCriando(true)}>
            <Plus aria-hidden />
            Cadastrar centro
          </Button>
        </EstadoVazio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Presenca>
            {visiveis.map((centro) => {
              const local = [centro.regiao, centro.cidade]
                .filter(Boolean)
                .join(" · ");

              return (
                /* `h-full` no cartão: quem é item da grade agora é o wrapper da
                   Presenca, e sem isto o cartão para de esticar até a altura da
                   fileira. */
                <ItemPresente key={centro.id}>
                  <Card className="h-full">
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{centro.nome}</h3>
                            {/* O principal é o destino do que não foi separado
                                em outra frente — dizer isso no cartão explica
                                por que ele não tem "Excluir". */}
                            {centro.principal ? (
                              <Badge variant="outline">Principal</Badge>
                            ) : null}
                            {!centro.ativo ? (
                              <Badge variant="secondary">Inativo</Badge>
                            ) : null}
                          </div>
                          <SeloTipoCentro tipo={centro.tipo} />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-mt-1 -mr-1 cursor-pointer"
                              aria-label={`Ações do centro ${centro.nome}`}
                            >
                              <MoreVertical className="size-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => setEmEdicao(centro)}
                            >
                              <Pencil className="size-4" aria-hidden />
                              Editar
                            </DropdownMenuItem>
                            {/* Esconder não é permissão — `excluirCentro`
                                recusa o principal de novo no servidor. Aqui é
                                só para não oferecer o que não vai funcionar. */}
                            {centro.principal ? null : (
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => setParaExcluir(centro)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {local || centro.contatoTelefone ? (
                        <div className="text-muted-foreground space-y-1.5 text-sm">
                          {local ? (
                            <p className="flex items-center gap-1.5">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              {local}
                            </p>
                          ) : null}
                          {centro.contatoTelefone ? (
                            <p className="flex items-center gap-1.5">
                              <Phone className="size-3.5 shrink-0" aria-hidden />
                              {centro.contatoTelefone}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-sm">
                        <span className="flex items-center gap-1.5">
                          <UsersRound
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          {formatarNumero(centro.grupos)}{" "}
                          {centro.grupos === 1 ? "grupo" : "grupos"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CalendarDays
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          {formatarNumero(centro.eventos)}{" "}
                          {centro.eventos === 1 ? "ação" : "ações"}
                        </span>
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
        <DialogoCentro
          missaoId={missaoId}
          aberto
          aoFechar={() => setCriando(false)}
        />
      ) : null}

      {emEdicao ? (
        <DialogoCentro
          // Trocar de centro troca a key, o que remonta o formulário já com os
          // valores certos — sem efeito de reset.
          key={emEdicao.id}
          missaoId={missaoId}
          centroId={emEdicao.id}
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
            <AlertDialogTitle>Excluir “{paraExcluir?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {paraExcluir && descreverVinculos(paraExcluir)
                ? `${descreverVinculos(paraExcluir)} passam para o centro principal da missão — nada disso é apagado. Para apenas tirá-lo das contagens, prefira marcá-lo como inativo.`
                : "O centro será removido definitivamente e deixará de contar nos indicadores da missão. Para apenas tirá-lo das contagens, prefira marcá-lo como inativo."}
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
