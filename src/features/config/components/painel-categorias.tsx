"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
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
import { formatarNumero } from "@/lib/format";

import { excluirCategoria, salvarCategoria } from "../actions";
import type { CategoriaConfig } from "../queries";
import { TIPOS_CATEGORIA } from "../schemas";

const NOVA = { nome: "", tipo: "ambos" as const, ordem: 0, ativo: true };

const ROTULO_TIPO: Record<string, string> = {
  receita: "Só receitas",
  despesa: "Só despesas",
  ambos: "Receitas e despesas",
};

function Formulario({
  categoria,
  aoFechar,
}: {
  categoria: CategoriaConfig | null;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(
    categoria
      ? {
          nome: categoria.nome,
          tipo: categoria.tipo,
          ordem: categoria.ordem,
          ativo: categoria.ativo,
        }
      : NOVA,
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);
    setEnviando(true);

    const resultado = await salvarCategoria(categoria?.id ?? null, dados);
    setEnviando(false);

    if (!resultado.ok) {
      setErros(resultado.campos ?? {});
      setGeral(resultado.erro);
      return;
    }

    toast.success(categoria ? "Categoria atualizada" : "Categoria criada");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {categoria ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
            <DialogDescription>
              Categorias organizam os lançamentos e permitem ver onde o dinheiro
              entrou e saiu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              {(props) => (
                <Input
                  {...props}
                  value={dados.nome}
                  onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                  placeholder="Alimentação"
                  autoFocus
                />
              )}
            </Campo>

            <Campo
              rotulo="Aparece em"
              obrigatorio
              ajuda="Restringe onde a categoria pode ser escolhida."
              erro={erros.tipo}
            >
              {(props) => (
                <Select
                  value={dados.tipo}
                  onValueChange={(tipo) =>
                    setDados({ ...dados, tipo: tipo as typeof dados.tipo })
                  }
                >
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CATEGORIA.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Campo>

            <Campo
              rotulo="Ordem"
              ajuda="Menor aparece primeiro."
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
                <Label htmlFor="cat-ativa">Disponível</Label>
                <p className="text-muted-foreground text-xs">
                  Categorias indisponíveis somem do formulário de lançamento.
                </p>
              </div>
              <Switch
                id="cat-ativa"
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

export function PainelCategorias({
  categorias,
}: {
  categorias: CategoriaConfig[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<CategoriaConfig | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<CategoriaConfig | null>(null);
  const [excluindo, iniciar] = useTransition();

  function confirmar() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;
    iniciar(async () => {
      const resultado = await excluirCategoria(alvo.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Categoria excluída");
      setParaExcluir(null);
      router.refresh();
    });
  }

  const botaoNova = (
    <Button className="cursor-pointer" onClick={() => setCriando(true)}>
      <Plus aria-hidden />
      Nova categoria
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Usadas nos lançamentos financeiros das ações apostólicas. São
          opcionais: um lançamento pode ficar sem categoria.
        </p>
        {categorias.length > 0 ? botaoNova : null}
      </div>

      {categorias.length === 0 ? (
        <EstadoVazio
          Icone={Tags}
          titulo="Nenhuma categoria cadastrada"
          descricao="Sem categorias, os lançamentos continuam funcionando — só não é possível agrupá-los por finalidade."
        >
          {botaoNova}
        </EstadoVazio>
      ) : (
        <div className="space-y-2">
          {categorias.map((categoria) => (
            <Card key={categoria.id} className="gap-0 py-3">
              <CardContent className="flex items-center gap-3 px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{categoria.nome}</p>
                    <Badge variant="outline">
                      {ROTULO_TIPO[categoria.tipo]}
                    </Badge>
                    {!categoria.ativo ? (
                      <Badge variant="secondary">Indisponível</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {categoria.emUso > 0
                      ? `${formatarNumero(categoria.emUso)} ${categoria.emUso === 1 ? "lançamento usa" : "lançamentos usam"} esta categoria`
                      : "Nenhum lançamento usa esta categoria"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer"
                    aria-label={`Editar ${categoria.nome}`}
                    onClick={() => setEditando(categoria)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                    aria-label={`Excluir ${categoria.nome}`}
                    onClick={() => setParaExcluir(categoria)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {criando ? (
        <Formulario categoria={null} aoFechar={() => setCriando(false)} />
      ) : null}
      {editando ? (
        <Formulario
          key={editando.id}
          categoria={editando}
          aoFechar={() => setEditando(null)}
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
              {paraExcluir && paraExcluir.emUso > 0
                ? `Os ${formatarNumero(paraExcluir.emUso)} lançamentos que a usam continuam existindo, apenas ficam sem categoria. Para preservar o agrupamento, prefira marcá-la como indisponível.`
                : "Nenhum lançamento usa esta categoria, então nada se perde."}
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
