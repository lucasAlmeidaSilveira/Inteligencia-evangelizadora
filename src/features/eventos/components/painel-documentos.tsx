"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { EstadoVazio } from "@/components/padroes/estado-vazio";
import { ItemPresente, Presenca } from "@/components/padroes/presenca";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDataHora, formatarTamanhoArquivo } from "@/lib/format";

import {
  excluirDocumento,
  prepararEnvio,
  registrarDocumento,
  urlDoDocumento,
} from "../actions";
import type { Documento } from "../queries";

const EXTENSOES_ACEITAS =
  ".pdf,.xls,.xlsx,.doc,.docx,.csv,.png,.jpg,.jpeg,.webp";

export function PainelDocumentos({
  eventoId,
  documentos,
}: {
  eventoId: string;
  documentos: Documento[];
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  /* O documento sai da lista antes da resposta do servidor — é essa saída que
     a `Presenca` anima. Se a exclusão falhar, o `useOptimistic` devolve o
     arquivo sozinho, junto com o toast de erro. */
  const [visiveis, esconder] = useOptimistic(documentos, (atual, id: string) =>
    atual.filter((d) => d.id !== id),
  );

  /**
   * O arquivo vai do navegador direto para o R2, usando uma URL assinada que
   * o servidor só emite depois de conferir o acesso à missão. Assim os bytes
   * não passam pela função serverless, que tem limite de corpo bem menor.
   */
  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const preparo = await prepararEnvio(eventoId, {
        nome: arquivo.name,
        tipoMime: arquivo.type,
        tamanhoBytes: arquivo.size,
      });

      if (!preparo.ok) {
        toast.error(preparo.erro);
        return;
      }

      const { url, chave } = preparo.dados;

      const envio = await fetch(url, {
        method: "PUT",
        body: arquivo,
        headers: { "Content-Type": arquivo.type },
      });

      if (!envio.ok) {
        // Causa mais comum: CORS do bucket sem a origem desta aplicação.
        toast.error("O envio ao armazenamento falhou.", {
          description: "Verifique a política de CORS do bucket no Cloudflare.",
        });
        return;
      }

      const registro = await registrarDocumento({
        eventoId,
        nome: arquivo.name,
        chave,
        tipoMime: arquivo.type,
        tamanhoBytes: arquivo.size,
      });

      if (!registro.ok) {
        toast.error(registro.erro);
        return;
      }

      toast.success("Documento anexado");
      router.refresh();
    } catch {
      toast.error("Não foi possível enviar o arquivo.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  function baixar(documento: Documento) {
    iniciar(async () => {
      const resultado = await urlDoDocumento(documento.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      window.location.href = resultado.dados.url;
    });
  }

  function remover(documento: Documento) {
    iniciar(async () => {
      esconder(documento.id);
      const resultado = await excluirDocumento(documento.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Documento removido");
      router.refresh();
    });
  }

  const botaoEnviar = (
    <>
      <input
        ref={entrada}
        type="file"
        accept={EXTENSOES_ACEITAS}
        className="sr-only"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
      <Button
        className="cursor-pointer"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
      >
        {enviando ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          <>
            <Upload aria-hidden />
            Anexar documento
          </>
        )}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          PDF, Excel, Word, CSV e imagens, até 10 MB cada. Os arquivos ficam em
          armazenamento privado — o download exige sessão e acesso à missão.
        </p>
        {documentos.length > 0 ? botaoEnviar : null}
      </div>

      {documentos.length === 0 ? (
        <EstadoVazio
          Icone={FileText}
          titulo="Nenhum documento anexado"
          descricao="Anexe planilhas de prestação de contas, cartazes, listas de presença ou qualquer registro da ação."
        >
          {botaoEnviar}
        </EstadoVazio>
      ) : (
        /* O estado vazio decide por `documentos`, não por `visiveis`: ao
           remover o último arquivo, trocar já para o estado vazio desmontaria
           a `Presenca` e cortaria a animação de saída pela metade. */
        <div className="space-y-2">
          <Presenca>
            {visiveis.map((documento) => (
              <ItemPresente key={documento.id}>
                <Card className="gap-0 py-3">
                  <CardContent className="flex items-center gap-3 px-4">
                    <FileText
                      className="text-muted-foreground size-5 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {documento.nome}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatarTamanhoArquivo(documento.tamanhoBytes)} ·{" "}
                        {formatarDataHora(documento.criadoEm)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        aria-label={`Baixar ${documento.nome}`}
                        /* O download continua bloqueando enquanto assina a URL:
                           aqui a espera é real e não há o que remover da tela. */
                        disabled={ocupado}
                        onClick={() => baixar(documento)}
                      >
                        <Download className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        aria-label={`Remover ${documento.nome}`}
                        onClick={() => remover(documento)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </ItemPresente>
            ))}
          </Presenca>
        </div>
      )}
    </div>
  );
}
