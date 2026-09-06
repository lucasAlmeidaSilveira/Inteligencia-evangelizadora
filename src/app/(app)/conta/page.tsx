import { Church, Mail, ShieldCheck, User } from "lucide-react";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROTULO_PAPEL } from "@/features/config/schemas";
import { FormularioSenha } from "@/features/conta/components/formulario-senha";
import { listarMissoes } from "@/features/missoes/queries";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Minha conta" };

function Linha({
  Icone,
  rotulo,
  valor,
}: {
  Icone: typeof User;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex gap-3">
      <Icone className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="text-muted-foreground text-xs">{rotulo}</p>
        <p className="text-sm break-words">{valor}</p>
      </div>
    </div>
  );
}

export default async function PaginaConta() {
  const usuario = await requerUsuario();
  const missoes = usuario.ehAdmin ? [] : await listarMissoes();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoPagina
        titulo="Minha conta"
        descricao="Seus dados de acesso ao sistema."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados</CardTitle>
          <CardDescription>
            Nome, e-mail e permissões são definidos pelo administrador geral.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Linha Icone={User} rotulo="Nome" valor={usuario.nome} />
          <Linha Icone={Mail} rotulo="E-mail" valor={usuario.email} />
          <Linha
            Icone={ShieldCheck}
            rotulo="Permissão"
            // A mesma fonte do badge em Equipe: o auxiliar não é responsável, e
            // dizer que é confunde justamente quem tem menos permissão.
            valor={ROTULO_PAPEL[usuario.papel]}
          />
          {!usuario.ehAdmin ? (
            <Linha
              Icone={Church}
              rotulo={missoes.length === 1 ? "Missão" : "Missões"}
              valor={
                missoes.length > 0
                  ? missoes.map((m) => m.nome).join(", ")
                  : "Nenhuma vinculada"
              }
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trocar senha</CardTitle>
          <CardDescription>
            Pedimos a senha atual para confirmar que é você — e não alguém que
            encontrou esta tela aberta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioSenha email={usuario.email} />
        </CardContent>
      </Card>
    </div>
  );
}
