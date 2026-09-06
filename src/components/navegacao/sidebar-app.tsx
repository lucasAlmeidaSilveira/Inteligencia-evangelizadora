"use client";

import Link from "next/link";

import { SimboloBloco } from "@/components/marca";
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
      {/* Recolhida, a barra tem 3rem: o px-4 não deixaria os 2rem do bloco
          caberem. O px-2 é a mesma margem dos itens de menu, então o
          monograma cai no eixo vertical dos ícones de baixo. */}
      <SidebarHeader className="h-16 justify-center px-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          aria-label="Inteligência Evangelizadora — ir para o painel"
          className="flex items-center gap-2.5 overflow-hidden rounded-md group-data-[collapsible=icon]:justify-center"
        >
          <SimboloBloco />
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
