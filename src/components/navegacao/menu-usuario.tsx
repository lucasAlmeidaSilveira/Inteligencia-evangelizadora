"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LoaderCircle, LogOut } from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 2 || parte === parte.toUpperCase())
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function MenuUsuario({
  nome,
  email,
  papel,
}: {
  nome: string;
  email: string;
  papel: string;
}) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    // Ordem importa: apagar o cookie primeiro deixaria a sessão do Firebase
    // ativa no navegador, permitindo recriar a sessão sem digitar a senha.
    await signOut(auth).catch(() => undefined);
    await fetch("/api/auth/sessao", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 cursor-pointer gap-2 px-2"
          aria-label="Menu da conta"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {iniciais(nome)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {nome.split(" ")[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <p className="truncate text-sm font-medium">{nome}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
          <p className="text-muted-foreground text-xs capitalize">{papel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={sair}
          disabled={saindo}
          className="cursor-pointer"
        >
          {saindo ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-4" aria-hidden />
          )}
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
