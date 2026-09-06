"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
import { CartaoAcionavel } from "@/components/padroes/cartao-acionavel";
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
import { CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { formatarNumero } from "@/lib/format";

import { excluirTipoEvento, salvarTipoEvento } from "../actions";
import type { TipoConfig } from "../queries";
import { SeletorCor } from "./seletor-cor";

const NOVO = { nome: "", cor: "#7f22fe", descricao: "", ordem: 0, ativo: true };

function Formulario({
  tipo,
  aoFechar,
}: {
  tipo: TipoConfig | null;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(
    tipo
      ? {
          nome: tipo.nome,
          cor: tipo.cor,
          descricao: tipo.descricao ?? "",
          ordem: tipo.ordem,
          ativo: tipo.ativo,
        }
      : NOVO,
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);
    setEnviando(true);

    const resultado = await salvarTipoEvento(tipo?.id ?? null, dados);
    setEnviando(false);

    if (!resultado.ok) {
      setErros(resultado.campos ?? {});
      setGeral(resultado.erro);
      return;
    }

    toast.success(tipo ? "Tipo atualizado" : "Tipo criado");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>{tipo ? "Editar tipo" : "Novo tipo de ação"}</DialogTitle>
            <DialogDescription>
              A cor identifica o tipo no calendário e nas listagens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              {(props) => (
                <Input
                  {...props}
                  value={dados.nome}
                  onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                  placeholder="Retiro"
                  autoFocus
                />
              )}
            </Campo>

            <Campo rotulo="Cor" obrigatorio erro={erros.cor}>
              {(props) => (
                <SeletorCor
                  id={props.id}
                  valor={dados.cor}
                  aoMudar={(cor) => setDados({ ...dados, cor })}
                />
              )}
            </Campo>

            <Campo rotulo="Descrição" erro={erros.descricao}>
              {(props) => (
                <Input
                  {...props}
                  value={dados.descricao}
                  onChange={(e) =>
                    setDados({ ...dados, descricao: e.target.value })
                  }
                />
              )}
            </Campo>

            <Campo
              rotulo="Ordem"
              ajuda="Menor aparece primeiro nas listas."
              erro={erros.ordem}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  className="tabular w-28"
                  value={dados.ordem}
                  onChange={(e) =>
                    setDados({ ...dados, ordem: Number(e.target.value) })
                  }
                />
              )}
            </Campo>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="tipo-ativo">Disponível</Label>
                <p className="text-muted-foreground text-xs">
                  Tipos indisponíveis somem dos formulários, mas continuam
                  identificando as ações já cadastradas.
                </p>
              </div>
              <Switch
                id="tipo-ativo"
                checked={dados.ativo}
                onCheckedChange={(ativo) => setDados({ ...dados, ativo })}
                className="cursor-pointer"
              />
            </div>

            {geral ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {geral}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={aoFechar}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={enviando}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PainelTipos({ tipos }: { tipos: TipoConfig[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<TipoConfig | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<TipoConfig | null>(null);
  const [excluindo, iniciar] = useTransition();

  /* O tipo sai da lista antes da resposta do servidor — é essa saída que a
     `Presenca` anima. Se a exclusão falhar, o `useOptimistic` o devolve
     sozinho, junto com o toast de erro. */
  const [visiveis, esconder] = useOptimistic(tipos, (atual, id: string) =>
    atual.filter((t) => t.id !== id),
  );

  function confirmar() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;
    iniciar(async () => {
      esconder(alvo.id);
      const resultado = await excluirTipoEvento(alvo.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Tipo excluído");
      setParaExcluir(null);
      router.refresh();
    });
  }

  const botaoNovo = (
    <Button className="cursor-pointer" onClick={() => setCriando(true)}>
      <Plus aria-hidden />
      Novo tipo
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Cada ação apostólica pertence a um tipo. A cor escolhida aqui é a que
          aparece no calendário.
        </p>
        {tipos.length > 0 ? botaoNovo : null}
      </div>

      {tipos.length === 0 ? (
        <EstadoVazio
          Icone={Palette}
          titulo="Nenhum tipo cadastrado"
          descricao="Sem ao menos um tipo não é possível registrar ações apostólicas."
        >
          {botaoNovo}
        </EstadoVazio>
      ) : (
        <div className="space-y-2">
          <Presenca>
            {visiveis.map((tipo) => (
              <ItemPresente key={tipo.id}>
                <CartaoAcionavel
                  aoAcionar={() => setEditando(tipo)}
                  className="gap-0 py-3"
                >
                  <CardContent className="flex items-center gap-3 px-4">
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full"
                      style={{ background: tipo.cor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{tipo.nome}</p>
                        {!tipo.ativo ? (
                          <Badge variant="secondary">Indisponível</Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {tipo.descricao ? `${tipo.descricao} · ` : ""}
                        {tipo.emUso > 0
                          ? `${formatarNumero(tipo.emUso)} ${tipo.emUso === 1 ? "ação usa" : "ações usam"} este tipo`
                          : "Nenhuma ação usa este tipo"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        aria-label={`Editar ${tipo.nome}`}
                        onClick={() => setEditando(tipo)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-30"
                        aria-label={`Excluir ${tipo.nome}`}
                        // O banco recusaria de qualquer forma; desabilitar explica antes.
                        disabled={tipo.emUso > 0}
                        title={
                          tipo.emUso > 0
                            ? "Há ações usando este tipo. Marque como indisponível."
                            : undefined
                        }
                        onClick={() => setParaExcluir(tipo)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </CartaoAcionavel>
              </ItemPresente>
            ))}
          </Presenca>
        </div>
      )}

      {criando ? (
        <Formulario tipo={null} aoFechar={() => setCriando(false)} />
      ) : null}
      {editando ? (
        <Formulario
          key={editando.id}
          tipo={editando}
          aoFechar={() => setEditando(null)}
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
              Nenhuma ação usa este tipo, então nada se perde. Para tirá-lo dos
              formulários preservando o histórico, prefira marcá-lo como
              indisponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={excluindo}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmar();
              }}
              disabled={excluindo}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
