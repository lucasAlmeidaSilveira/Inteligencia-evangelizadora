"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Campo } from "@/components/padroes/campo";
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
import { formatarRelativo } from "@/lib/format";

import {
  atualizarUsuario,
  convidarUsuario,
  excluirUsuario,
  gerarLinkDeSenha,
} from "../actions";
import type { MissaoVinculo, UsuarioConfig } from "../queries";
import { papeisDisponiveis, ROTULO_PAPEL } from "../schemas";

type QuemConvida = {
  id: string;
  ehAdmin: boolean;
  missaoId: string | null;
  missaoNome: string | null;
};

/* ─── Link de senha ──────────────────────────────────────────────────────── */

export function DialogoLink({
  link,
  email,
  aoFechar,
}: {
  link: string;
  email: string;
  aoFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link para definir a senha</DialogTitle>
          <DialogDescription>
            Envie este link para <strong>{email}</strong>. A senha é escolhida
            pela própria pessoa — assim ela não passa por mais ninguém.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="bg-muted max-h-32 overflow-y-auto rounded-md border p-3">
            <p className="font-mono text-xs break-all">{link}</p>
          </div>
          <Button onClick={copiar} className="w-full cursor-pointer">
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
          <p className="text-muted-foreground text-xs">
            O link expira. Se vencer antes do uso, gere outro pelo botão da
            chave na lista.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="cursor-pointer" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Formulário ─────────────────────────────────────────────────────────── */

function Formulario({
  usuario,
  missoes,
  quemConvida,
  aoFechar,
  aoGerarLink,
}: {
  usuario: UsuarioConfig | null;
  missoes: MissaoVinculo[];
  quemConvida: QuemConvida;
  aoFechar: () => void;
  aoGerarLink: (link: string, email: string) => void;
}) {
  const router = useRouter();
  const papeis = papeisDisponiveis(quemConvida.ehAdmin);

  const [dados, setDados] = useState({
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    papel: usuario?.papel ?? papeis[0].valor,
    missaoId: usuario?.missaoId ?? quemConvida.missaoId ?? "",
    ativo: usuario?.ativo ?? true,
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErros({});
    setGeral(null);
    setEnviando(true);

    const resultado = usuario
      ? await atualizarUsuario(usuario.id, dados)
      : await convidarUsuario(dados);

    setEnviando(false);

    if (!resultado.ok) {
      setErros(resultado.campos ?? {});
      setGeral(resultado.erro);
      return;
    }

    if (!usuario && "dados" in resultado) {
      const { link, email } = resultado.dados as { link: string; email: string };
      aoFechar();
      aoGerarLink(link, email);
      router.refresh();
      return;
    }

    toast.success("Usuário atualizado");
    aoFechar();
    router.refresh();
  }

  const precisaDeMissao = dados.papel !== "admin";

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {usuario ? "Editar acesso" : "Convidar pessoa"}
            </DialogTitle>
            <DialogDescription>
              {usuario
                ? "Alterações de permissão valem na próxima navegação da pessoa."
                : "A conta é criada sem senha: ao final você recebe um link para enviar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <Campo rotulo="Nome completo" obrigatorio erro={erros.nome}>
              {(props) => (
                <Input
                  {...props}
                  value={dados.nome}
                  onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                  autoFocus
                />
              )}
            </Campo>

            <Campo rotulo="E-mail" obrigatorio erro={erros.email}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  inputMode="email"
                  value={dados.email}
                  onChange={(e) => setDados({ ...dados, email: e.target.value })}
                  disabled={Boolean(usuario)}
                />
              )}
            </Campo>

            {papeis.length > 1 ? (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  Permissão
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                </legend>
                {papeis.map((papel) => (
                  <label
                    key={papel.valor}
                    className="hover:bg-accent/50 has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <input
                      type="radio"
                      name="papel"
                      value={papel.valor}
                      checked={dados.papel === papel.valor}
                      onChange={() =>
                        setDados({
                          ...dados,
                          papel: papel.valor,
                          missaoId:
                            papel.valor === "admin" ? "" : dados.missaoId,
                        })
                      }
                      className="accent-primary mt-1"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        {papel.rotulo}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {papel.descricao}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="bg-muted/40 rounded-lg border p-3">
                <p className="text-sm font-medium">{papeis[0].rotulo}</p>
                <p className="text-muted-foreground text-xs">
                  {papeis[0].descricao}
                </p>
              </div>
            )}

            {precisaDeMissao ? (
              quemConvida.ehAdmin ? (
                <Campo rotulo="Missão" obrigatorio erro={erros.missaoId}>
                  {(props) => (
                    <Select
                      value={dados.missaoId}
                      onValueChange={(missaoId) =>
                        setDados({ ...dados, missaoId })
                      }
                    >
                      <SelectTrigger {...props} className="w-full">
                        <SelectValue placeholder="Escolha a missão" />
                      </SelectTrigger>
                      <SelectContent>
                        {missoes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                            {!m.ativo ? " (inativa)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Campo>
              ) : (
                <div className="bg-muted/40 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Missão</p>
                  <p className="text-sm font-medium">
                    {quemConvida.missaoNome}
                  </p>
                </div>
              )
            ) : null}

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="usuario-ativo">Acesso liberado</Label>
                <p className="text-muted-foreground text-xs">
                  Desativar bloqueia a entrada imediatamente, mesmo com sessão
                  aberta.
                </p>
              </div>
              <Switch
                id="usuario-ativo"
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
              ) : usuario ? (
                "Salvar alterações"
              ) : (
                "Convidar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Painel ─────────────────────────────────────────────────────────────── */

export function PainelUsuarios({
  usuarios,
  missoes,
  quemConvida,
}: {
  usuarios: UsuarioConfig[];
  missoes: MissaoVinculo[];
  quemConvida: QuemConvida;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<UsuarioConfig | null>(null);
  const [convidando, setConvidando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<UsuarioConfig | null>(null);
  const [link, setLink] = useState<{ link: string; email: string } | null>(null);
  const [gerando, iniciar] = useTransition();
  const [excluindo, iniciarExclusao] = useTransition();

  function novoLink(usuario: UsuarioConfig) {
    iniciar(async () => {
      const resultado = await gerarLinkDeSenha(usuario.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      setLink(resultado.dados as { link: string; email: string });
    });
  }

  /* A pessoa sai da lista antes da resposta do servidor — é essa saída que a
     `Presenca` anima, e é o que liga a confirmação ao efeito. Se a exclusão
     falhar, o `useOptimistic` a devolve sozinho, com o toast de erro. */
  const [visiveis, esconder] = useOptimistic(usuarios, (atual, id: string) =>
    atual.filter((u) => u.id !== id),
  );

  function confirmarExclusao() {
    if (!paraExcluir) return;
    const alvo = paraExcluir;

    iniciarExclusao(async () => {
      esconder(alvo.id);
      const resultado = await excluirUsuario(alvo.id);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(`${alvo.nome} foi removido da equipe`);
      setParaExcluir(null);
      router.refresh();
    });
  }

  /** O responsável administra apenas os auxiliares da própria missão. */
  const podeMexer = (usuario: UsuarioConfig) =>
    quemConvida.ehAdmin ||
    (usuario.papel === "auxiliar" && usuario.missaoId === quemConvida.missaoId);

  const botaoConvidar = (
    <Button className="cursor-pointer" onClick={() => setConvidando(true)}>
      <UserPlus aria-hidden />
      {quemConvida.ehAdmin ? "Convidar pessoa" : "Convidar auxiliar"}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          {quemConvida.ehAdmin
            ? "Quem tem acesso ao sistema e o que cada um enxerga. Não existe cadastro público — todo acesso nasce daqui."
            : `Quem tem acesso aos dados da ${quemConvida.missaoNome}. Você convida auxiliares, que registram tudo da missão mas não alteram o cadastro dela nem convidam outras pessoas.`}
        </p>
        {usuarios.length > 0 ? botaoConvidar : null}
      </div>

      {usuarios.length === 0 ? (
        <EstadoVazio
          Icone={Users}
          titulo="Nenhuma pessoa cadastrada"
          descricao="Convide quem vai registrar os grupos de oração e as ações apostólicas."
        >
          {botaoConvidar}
        </EstadoVazio>
      ) : (
        <div className="space-y-2">
          <Presenca>
            {visiveis.map((usuario) => {
              const souEu = usuario.id === quemConvida.id;
              const editavel = podeMexer(usuario);

              return (
                <ItemPresente key={usuario.id}>
                  <Card className="gap-0 py-3">
                    <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{usuario.nome}</p>
                          <Badge
                            variant={
                              usuario.papel === "admin"
                                ? "default"
                                : usuario.papel === "responsavel"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {ROTULO_PAPEL[usuario.papel]}
                          </Badge>
                          {souEu ? (
                            <Badge variant="secondary">Você</Badge>
                          ) : null}
                          {!usuario.ativo ? (
                            <Badge variant="secondary">Sem acesso</Badge>
                          ) : null}
                        </div>

                        <p className="text-muted-foreground truncate text-xs">
                          {usuario.email}
                        </p>

                        <p className="text-muted-foreground text-xs">
                          {usuario.papel === "admin"
                            ? "Todas as missões"
                            : (usuario.missaoNome ?? "Sem missão")}
                          {usuario.ultimoAcessoEm
                            ? ` · último acesso ${formatarRelativo(usuario.ultimoAcessoEm)}`
                            : " · nunca acessou"}
                        </p>
                      </div>

                      {editavel ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Gerar link de senha para ${usuario.nome}`}
                            title="Gerar link para definir senha"
                            disabled={gerando}
                            onClick={() => novoLink(usuario)}
                          >
                            {gerando ? (
                              <LoaderCircle
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <KeyRound className="size-4" aria-hidden />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Editar ${usuario.nome}`}
                            onClick={() => setEditando(usuario)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          {/* Excluir a si mesmo é irreversível pela interface; o
                              servidor recusa de qualquer forma, esconder explica
                              antes de a pessoa tentar. */}
                          {!souEu ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive cursor-pointer"
                              aria-label={`Excluir ${usuario.nome}`}
                              title="Remover da equipe"
                              onClick={() => setParaExcluir(usuario)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </ItemPresente>
              );
            })}
          </Presenca>
        </div>
      )}

      {convidando ? (
        <Formulario
          usuario={null}
          missoes={missoes}
          quemConvida={quemConvida}
          aoFechar={() => setConvidando(false)}
          aoGerarLink={(link, email) => setLink({ link, email })}
        />
      ) : null}

      {editando ? (
        <Formulario
          key={editando.id}
          usuario={editando}
          missoes={missoes}
          quemConvida={quemConvida}
          aoFechar={() => setEditando(null)}
          aoGerarLink={(link, email) => setLink({ link, email })}
        />
      ) : null}

      {link ? (
        <DialogoLink
          link={link.link}
          email={link.email}
          aoFechar={() => setLink(null)}
        />
      ) : null}

      <AlertDialog
        open={Boolean(paraExcluir)}
        onOpenChange={(v) => !v && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {paraExcluir?.nome} da equipe?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O acesso é apagado definitivamente, junto com a conta de login. O
              que a pessoa registrou continua no sistema, mas sem o nome de quem
              registrou. Para só tirar o acesso e preservar essa autoria,
              prefira editar e desligar &ldquo;Acesso liberado&rdquo;.
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
