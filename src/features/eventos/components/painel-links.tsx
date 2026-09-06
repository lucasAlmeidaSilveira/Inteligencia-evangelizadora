"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { ItemPresente, Presenca } from "@/components/padroes/presenca";
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

import { adicionarLink, excluirLink } from "../actions";
import type { LinkUtil } from "../queries";

function DialogoLink({
  eventoId,
  aoFechar,
}: {
  eventoId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);
    setEnviando(true);

    const resultado = await adicionarLink({ eventoId, titulo, url, descricao });
    setEnviando(false);

    if (!resultado.ok) {
      setErros(resultado.campos ?? {});
      setGeral(resultado.erro);
      return;
    }

    toast.success("Link adicionado");
    aoFechar();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>Novo link útil</DialogTitle>
            <DialogDescription>
              Formulário de inscrição, álbum de fotos, transmissão, material de
              divulgação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Título" obrigatorio erro={erros.titulo}>
              {(props) => (
                <Input
                  {...props}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Formulário de inscrição"
                  autoFocus
                />
              )}
            </Campo>

            <Campo
              rotulo="Endereço"
              obrigatorio
              ajuda="Pode colar sem o https:// — completamos para você."
              erro={erros.url}
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="forms.gle/exemplo"
                />
              )}
            </Campo>

            <Campo rotulo="Descrição" erro={erros.descricao}>
              {(props) => (
                <Input
                  {...props}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              )}
            </Campo>

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
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PainelLinks({
  eventoId,
  links,
}: {
  eventoId: string;
  links: LinkUtil[];
}) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const [, iniciar] = useTransition();

  /* O item sai da lista antes da ida ao servidor — é essa saída que a
     `Presenca` anima, e é o que faz a lista responder no mesmo quadro do
     clique. Se a ação falhar, o `useOptimistic` devolve o item sozinho, e ele
     volta entrando, ao lado do toast de erro.

     Antes, um clique em excluir desabilitava o botão de *todas* as linhas e
     nada apontava para a que estava saindo: quem clicou não sabia se tinha
     acertado a linha. */
  const [visiveis, esconder] = useOptimistic(links, (atual, id: string) =>
    atual.filter((l) => l.id !== id),
  );

  function remover(link: LinkUtil) {
    iniciar(async () => {
      esconder(link.id);
      const resultado = await excluirLink(link.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Link removido");
      router.refresh();
    });
  }

  const botaoNovo = (
    <Button className="cursor-pointer" onClick={() => setNovo(true)}>
      <Plus aria-hidden />
      Novo link
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {links.length > 0 ? botaoNovo : null}
      </div>

      {links.length === 0 ? (
        <EstadoVazio
          Icone={Link2}
          titulo="Nenhum link cadastrado"
          descricao="Guarde aqui os endereços que a equipe precisa ter à mão: inscrição, transmissão, fotos, materiais."
        >
          {botaoNovo}
        </EstadoVazio>
      ) : (
        /* O estado vazio decide por `links`, não por `visiveis`: ao remover o
           último item, `visiveis` fica vazio antes da resposta do servidor, e
           trocar já para o estado vazio desmontaria a `Presenca` no meio da
           animação — a saída do item seria cortada. */
        <div className="space-y-2">
          <Presenca>
            {visiveis.map((link) => (
              <ItemPresente key={link.id}>
                <Card className="gap-0 py-3">
                  <CardContent className="flex items-center gap-3 px-4">
                    <Link2
                      className="text-muted-foreground size-5 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {link.titulo}
                        <ExternalLink className="size-3" aria-hidden />
                        <span className="sr-only">(abre em nova aba)</span>
                      </a>
                      <p className="text-muted-foreground truncate text-xs">
                        {link.descricao ?? link.url}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                      aria-label={`Remover ${link.titulo}`}
                      onClick={() => remover(link)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </CardContent>
                </Card>
              </ItemPresente>
            ))}
          </Presenca>
        </div>
      )}

      {novo ? (
        <DialogoLink eventoId={eventoId} aoFechar={() => setNovo(false)} />
      ) : null}
    </div>
  );
}
