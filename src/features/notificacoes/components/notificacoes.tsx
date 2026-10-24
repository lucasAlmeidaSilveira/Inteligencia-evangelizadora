import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

import { listarNotificacoes } from "../queries";
import { SinoNotificacoes } from "./sino-notificacoes";

/** Server Component que lê e entrega ao sino. Vai dentro de um `Suspense` no
 *  layout: a consulta não pode segurar o cabeçalho da página inteira. */
export async function Notificacoes() {
  const { itens, naoLidas } = await listarNotificacoes();
  return <SinoNotificacoes itens={itens} naoLidas={naoLidas} />;
}

/** Mesmo tamanho do sino de verdade, para o cabeçalho não saltar ao carregar. */
export function SinoCarregando() {
  return (
    <Button variant="ghost" size="icon" disabled aria-label="Carregando notificações">
      <Bell className="text-muted-foreground size-4" aria-hidden />
    </Button>
  );
}
