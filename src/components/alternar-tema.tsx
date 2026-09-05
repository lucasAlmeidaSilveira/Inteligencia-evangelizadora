"use client";

import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPCOES = [
  { valor: "light", rotulo: "Claro", Icone: Sun },
  { valor: "dark", rotulo: "Escuro", Icone: Moon },
  { valor: "system", rotulo: "Sistema", Icone: Monitor },
] as const;

export function AlternarTema() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          aria-label="Alterar tema"
        >
          {/* Os dois ícones existem sempre; o CSS decide qual aparece. Assim o
              HTML do servidor é idêntico ao do cliente, sem precisar esperar a
              hidratação para saber o tema. */}
          <Sun
            className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
            aria-hidden
          />
          <Moon
            className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>

      {/* O conteúdo só monta ao abrir, já no cliente: ler `theme` aqui é seguro. */}
      <DropdownMenuContent align="end" className="w-40">
        {OPCOES.map(({ valor, rotulo, Icone }) => (
          <DropdownMenuItem
            key={valor}
            onClick={() => setTheme(valor)}
            className="cursor-pointer"
          >
            <Icone className="size-4" aria-hidden />
            <span className="flex-1">{rotulo}</span>
            {theme === valor ? (
              <Check className="size-4 opacity-60" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
