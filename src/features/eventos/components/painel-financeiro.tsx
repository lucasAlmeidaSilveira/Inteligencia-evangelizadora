"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarData, formatarMoeda, paraDateInput } from "@/lib/format";

import { adicionarLancamento, excluirLancamento } from "../actions";
import type { Categoria, Lancamento } from "../queries";
import { somarLancamentos } from "../financeiro";

const SEM_CATEGORIA = "__sem__";

function DialogoLancamento({
  eventoId,
  tipo,
  categorias,
  aoFechar,
}: {
  eventoId: string;
  tipo: "receita" | "despesa";
  categorias: Categoria[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(paraDateInput());
  const [categoriaId, setCategoriaId] = useState(SEM_CATEGORIA);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const disponiveis = categorias.filter(
    (c) => c.tipo === tipo || c.tipo === "ambos",
  );

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);
    setEnviando(true);

    const resultado = await adicionarLancamento({
      eventoId,
      tipo,
      categoriaId: categoriaId === SEM_CATEGORIA ? "" : categoriaId,
      descricao,
      valor,
      data,
    });

    setEnviando(false);

    if (!resultado.ok) {
      setErros(resultado.campos ?? {});
      setGeral(resultado.erro);
      return;
    }

    toast.success(tipo === "receita" ? "Receita lançada" : "Despesa lançada");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {tipo === "receita" ? "Nova receita" : "Nova despesa"}
            </DialogTitle>
            <DialogDescription>
              O saldo da ação é sempre a soma das receitas menos a das despesas
              — não existe campo de saldo para preencher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Descrição" obrigatorio erro={erros.descricao}>
              {(props) => (
                <Input
                  {...props}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === "receita"
                      ? "Doação da comunidade"
                      : "Almoço dos servos"
                  }
                  autoFocus
                />
              )}
            </Campo>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Valor"
                obrigatorio
                ajuda="Em reais. Aceita 1.234,56 ou 1234.56."
                erro={erros.valor}
              >
                {(props) => (
                  <Input
                    {...props}
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className="tabular"
                  />
                )}
              </Campo>

              <Campo rotulo="Data" obrigatorio erro={erros.data}>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="tabular"
                  />
                )}
              </Campo>
            </div>

            {disponiveis.length > 0 ? (
              <Campo rotulo="Categoria" erro={erros.categoriaId}>
                {(props) => (
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_CATEGORIA}>
                        Sem categoria
                      </SelectItem>
                      {disponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>
            ) : null}

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
                  Lançando…
                </>
              ) : (
                "Lançar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PainelFinanceiro({
  eventoId,
  lancamentos,
  categorias,
}: {
  eventoId: string;
  lancamentos: Lancamento[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [novo, setNovo] = useState<"receita" | "despesa" | null>(null);
  const [removendo, iniciar] = useTransition();

  const totais = somarLancamentos(lancamentos);

  function remover(id: string) {
    iniciar(async () => {
      const resultado = await excluirLancamento(id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Lançamento removido");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Receitas </span>
            <span className="tabular font-medium">
              {formatarMoeda(totais.receitas)}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Despesas </span>
            <span className="tabular font-medium">
              {formatarMoeda(totais.despesas)}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Saldo </span>
            <span
              className={
                totais.saldo < 0
                  ? "text-destructive tabular font-semibold"
                  : "text-success tabular font-semibold"
              }
            >
              {formatarMoeda(totais.saldo)}
            </span>
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setNovo("receita")}
          >
            <TrendingUp aria-hidden />
            Receita
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setNovo("despesa")}
          >
            <TrendingDown aria-hidden />
            Despesa
          </Button>
        </div>
      </div>

      {lancamentos.length === 0 ? (
        <EstadoVazio
          Icone={Plus}
          titulo="Nenhum lançamento"
          descricao="Registre receitas e despesas linha a linha. O saldo é calculado sozinho e sempre confere com os lançamentos."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatarData(l.data)}
                    </TableCell>
                    <TableCell className="font-medium">{l.descricao}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.categoriaNome ?? "—"}
                    </TableCell>
                    <TableCell
                      data-numeric
                      className={
                        l.tipo === "receita"
                          ? "text-success text-right font-medium"
                          : "text-destructive text-right font-medium"
                      }
                    >
                      {l.tipo === "receita" ? "+" : "−"}
                      {formatarMoeda(l.valor)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        aria-label={`Remover lançamento ${l.descricao}`}
                        disabled={removendo}
                        onClick={() => remover(l.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {novo ? (
        <DialogoLancamento
          eventoId={eventoId}
          tipo={novo}
          categorias={categorias}
          aoFechar={() => setNovo(null)}
        />
      ) : null}
    </div>
  );
}
