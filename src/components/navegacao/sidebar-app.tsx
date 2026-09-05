"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartColumnIncreasing,
  Church,
  LayoutDashboard,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const ACOMPANHAMENTO = [
  { titulo: "Painel", href: "/", Icone: LayoutDashboard },
  { titulo: "Missões", href: "/missoes", Icone: Church },
  { titulo: "Ações apostólicas", href: "/eventos", Icone: Sparkles },
  { titulo: "Calendário", href: "/calendario", Icone: CalendarDays },
  { titulo: "Relatórios", href: "/relatorios", Icone: ChartColumnIncreasing },
];

export function SidebarApp({
  ehAdmin,
  podeConvidar,
}: {
  ehAdmin: boolean;
  /** Admin master ou responsável de missão: os dois gerem acessos. */
  podeConvidar: boolean;
}) {
  const caminho = usePathname();

  // "/" só está ativo em si mesmo; os demais também nas subpáginas.
  const estaAtivo = (href: string) =>
    href === "/" ? caminho === "/" : caminho.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 overflow-hidden rounded-md"
        >
          <span className="bg-primary text-primary-foreground font-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-sm">
            IE
          </span>
          <span className="font-brand truncate text-base leading-none tracking-tight group-data-[collapsible=icon]:hidden">
            Inteligência
            <br />
            <span className="text-muted-foreground text-sm">Evangelizadora</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Acompanhamento</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACOMPANHAMENTO.map(({ titulo, href, Icone }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={estaAtivo(href)}
                    tooltip={titulo}
                  >
                    <Link href={href}>
                      <Icone aria-hidden />
                      <span>{titulo}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {podeConvidar ? (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={estaAtivo("/equipe")}
                    tooltip="Equipe"
                  >
                    <Link href="/equipe">
                      <UsersRound aria-hidden />
                      <span>Equipe</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Tipos de ação e categorias valem para todas as missões:
                    quem as define é o administrador master. */}
                {ehAdmin ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={estaAtivo("/config")}
                      tooltip="Configurações"
                    >
                      <Link href="/config">
                        <Settings aria-hidden />
                        <span>Configurações</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
