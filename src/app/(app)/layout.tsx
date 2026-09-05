import { AlternarTema } from "@/components/alternar-tema";
import { MenuUsuario } from "@/components/navegacao/menu-usuario";
import { SidebarApp } from "@/components/navegacao/sidebar-app";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requerUsuario } from "@/server/auth/sessao";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  // Verificação real da sessão. O middleware só olha se o cookie existe.
  const usuario = await requerUsuario();

  return (
    <SidebarProvider>
      {/* Primeiro alvo do Tab: quem navega por teclado não precisa percorrer
          todo o menu lateral em cada página para chegar ao conteúdo. */}
      <a
        href="#conteudo"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Ir para o conteúdo
      </a>

      <SidebarApp ehAdmin={usuario.ehAdmin} />

      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
          <SidebarTrigger className="cursor-pointer" />
          <Separator orientation="vertical" className="mr-1 !h-5" />
          <div className="flex-1" />
          <AlternarTema />
          <MenuUsuario
            nome={usuario.nome}
            email={usuario.email}
            papel={usuario.ehAdmin ? "Administrador" : "Responsável de missão"}
          />
        </header>

        <main id="conteudo" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
