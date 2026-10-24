"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Eraser,
  LoaderCircle,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  abrirPesquisa,
  encerrarPesquisa,
  gerarNovoLink,
  reabrirPesquisa,
  reiniciarPesquisa,
} from "../actions";

type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Os botões do card de pesquisa. O card em si é Server Component — o QR e o
 * link vêm prontos de lá — e só o que precisa de clique vive aqui.
 */
function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function executar(acao: () => Promise<Resultado>, mensagem: string) {
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(mensagem);
      router.refresh();
    });
  }

  return { pendente, executar };
}

export function BotaoAbrirPesquisa({ eventoId }: { eventoId: string }) {
  const { pendente, executar } = useAcao();

  return (
    <Button
      className="cursor-pointer"
      disabled={pendente}
      onClick={() =>
        executar(() => abrirPesquisa(eventoId), "Pesquisa aberta")
      }
    >
      {pendente ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Abrindo…
        </>
      ) : (
        "Abrir pesquisa"
      )}
    </Button>
  );
}

/**
 * Zera a pesquisa: apaga todas as respostas e troca o link. É a saída para
 * uma pesquisa envenenada por inundação — por isso vive atrás de um diálogo
 * que diz quantas respostas somem.
 */
export function BotaoReiniciarPesquisa({
  eventoId,
  respostas,
}: {
  eventoId: string;
  respostas: number;
}) {
  const { pendente, executar } = useAcao();
  const [aberto, setAberto] = useState(false);

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive cursor-pointer"
        >
          <Eraser aria-hidden />
          Zerar respostas
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zerar a pesquisa?</AlertDialogTitle>
          <AlertDialogDescription>
            Apaga {respostas === 1 ? "a única resposta" : `as ${respostas} respostas`}{" "}
            recebidas, gera um link novo e reabre a pesquisa por 14 dias. Use
            quando o link foi inundado por respostas que não são de
            participantes. Não pode ser desfeito.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={pendente}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pendente}
            className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
            onClick={(e) => {
              e.preventDefault();
              executar(async () => {
                const r = await reiniciarPesquisa(eventoId);
                if (r.ok) setAberto(false);
                return r;
              }, "Pesquisa zerada e link novo gerado");
            }}
          >
            {pendente ? "Zerando…" : "Zerar e gerar novo link"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BotaoReabrirPesquisa({ eventoId }: { eventoId: string }) {
  const { pendente, executar } = useAcao();

  return (
    <Button
      variant="outline"
      className="cursor-pointer"
      disabled={pendente}
      onClick={() =>
        executar(
          () => reabrirPesquisa(eventoId),
          "Pesquisa reaberta por mais 14 dias",
        )
      }
    >
      {pendente ? "Reabrindo…" : "Reabrir pesquisa"}
    </Button>
  );
}

/** Copiar, QR, trocar o link e encerrar — só enquanto a pesquisa aceita. */
export function AcoesPesquisaAberta({
  eventoId,
  link,
  qr,
}: {
  eventoId: string;
  /** `null` quando o endereço público não está configurado. */
  link: string | null;
  /** Data URL do QR, gerado no servidor. */
  qr: string | null;
}) {
  const { pendente, executar } = useAcao();
  const [copiado, setCopiado] = useState(false);
  const [trocando, setTrocando] = useState(false);

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={copiar}
        disabled={!link}
      >
        {copiado ? (
          <>
            <Check aria-hidden />
            Copiado
          </>
        ) : (
          <>
            <Copy aria-hidden />
            Copiar link
          </>
        )}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={!qr}
          >
            <QrCode aria-hidden />
            Mostrar QR code
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR code da pesquisa</DialogTitle>
            <DialogDescription>
              Projete na tela ou imprima. Quem aponta a câmera abre o
              formulário direto, sem login.
            </DialogDescription>
          </DialogHeader>
          {qr ? (
            <div className="flex justify-center py-2">
              {/* Imagem com fundo branco próprio: QR sobre vidro ou tema
                  escuro não é lido pela câmera. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor; next/image não otimiza data: */}
              <img
                src={qr}
                alt="QR code com o link da pesquisa de satisfação"
                width={288}
                height={288}
                className="size-72 rounded-lg bg-white p-3"
              />
            </div>
          ) : null}
          {link ? (
            <p className="text-muted-foreground font-mono text-xs break-all">
              {link}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={trocando} onOpenChange={setTrocando}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="cursor-pointer">
            <RefreshCw aria-hidden />
            Gerar novo link
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar um novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link e o QR code atuais deixam de funcionar na hora. As
              respostas já recebidas continuam contando. Use quando o link
              vazou para quem não participou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={pendente}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={pendente}
              onClick={(e) => {
                e.preventDefault();
                executar(async () => {
                  const r = await gerarNovoLink(eventoId);
                  if (r.ok) setTrocando(false);
                  return r;
                }, "Novo link gerado");
              }}
            >
              {pendente ? "Gerando…" : "Gerar novo link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive cursor-pointer"
        disabled={pendente}
        onClick={() =>
          executar(() => encerrarPesquisa(eventoId), "Pesquisa encerrada")
        }
      >
        Encerrar
      </Button>
    </div>
  );
}
