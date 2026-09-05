import { Church, Sparkles, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Painel" };

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function PaginaPainel() {
  const usuario = await requerUsuario();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {saudacao()}, {primeiroNome}
        </h1>
        <p className="text-muted-foreground">
          {usuario.ehAdmin
            ? "Panorama de todas as missões."
            : "Acompanhamento da sua missão."}
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-muted-foreground flex gap-3" aria-hidden>
            <Church className="size-6" />
            <Users className="size-6" />
            <Sparkles className="size-6" />
          </div>
          <div className="max-w-md space-y-1.5">
            <p className="font-medium">Ainda não há dados para exibir</p>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              Os indicadores aparecem aqui assim que as missões, os grupos de
              oração e as ações apostólicas forem cadastrados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
