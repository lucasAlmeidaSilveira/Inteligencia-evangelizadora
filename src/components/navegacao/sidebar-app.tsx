"use client";

import Link from "next/link";

import { Simbolo } from "@/components/marca";
import { SeletorMissao } from "@/components/navegacao/seletor-missao";
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
  missaoEmFoco,
  missoesDoFoco,
}: {
  ehAdmin: boolean;
  /** Admin master ou responsável de missão: os dois gerem acessos. */
  podeConvidar: boolean;
  missaoEmFoco?: string;
  /** Vazio para quem não escolhe missão — o seletor nem aparece. */
  missoesDoFoco: { id: string; nome: string }[];
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
          {/* Sem o bloco azul do SimboloBloco: a própria barra já é o azul da
              marca, e o quadrado desapareceria dentro dela. O E segue a cor do
              texto; o I recebe o laranja clareado, que é o que rende como luz
              sobre o azul profundo. */}
          <Simbolo className="size-8 shrink-0 [--marca-acento:var(--marca-luz)]" />
          <span className="font-brand truncate text-base leading-none tracking-tight group-data-[collapsible=icon]:hidden">
            Inteligência
            <br />
            <span className="text-muted-foreground text-sm">Evangelizadora</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Recolhida, a barra tem 3rem — um select não cabe nem faz sentido
            sem o rótulo ao lado. Some junto com os demais textos. */}
        {missoesDoFoco.length > 0 ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Missão em foco</SidebarGroupLabel>
            <SidebarGroupContent>
              <SeletorMissao
                missaoId={missaoEmFoco}
                opcoes={missoesDoFoco}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

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
