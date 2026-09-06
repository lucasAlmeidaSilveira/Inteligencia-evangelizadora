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
  UserCog,
  UsersRound,
  Waypoints,
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

/*
 * Movimento dos itens de menu.
 *
 * O `SidebarMenuButton` do shadcn transiciona só `width`, `height` e
 * `padding` — o bastante para o recolhimento da barra, mas o hover troca fundo
 * e cor num corte seco. Numa barra que a pessoa percorre o dia inteiro, é esse
 * corte que faz o menu parecer que não respondeu ao ponteiro.
 *
 * As três propriedades originais estão repetidas de propósito: isto substitui
 * a `transition-*` do componente, não se soma a ela — o `tailwind-merge`
 * mantém apenas a última. Omiti-las quebraria a animação de recolher a barra.
 *
 * O que cresce é o ícone, não a linha inteira. Deslocar a linha funcionaria
 * com a barra aberta e desalinharia o ícone do eixo vertical com ela
 * recolhida, onde só o ícone aparece; a escala vale igual nos dois estados e
 * não empurra nada de lugar. A barra lateral é a única superfície presente em
 * todas as telas — o que se mexe aqui se mexe o tempo todo, então mexe pouco.
 *
 * `active:translate-y-px` é o mesmo afundar do `Button` e dos cartões: um
 * vocabulário de pressão só para o sistema inteiro.
 */
const ITEM_MENU =
  "transition-[width,height,padding,background-color,color,transform] duration-150 ease-out active:translate-y-px [&_svg]:transition-transform [&_svg]:duration-150 [&_svg]:ease-out hover:[&_svg]:scale-110";

/* Na ordem em que o domínio se aninha: a missão contém centros, o centro contém
   grupos, e as ações acontecem neles. Quem percorre a barra de cima para baixo
   percorre a estrutura da missão. */
const ACOMPANHAMENTO = [
  { titulo: "Painel", href: "/", Icone: LayoutDashboard },
  { titulo: "Missões", href: "/missoes", Icone: Church },
  { titulo: "Centros de evangelização", href: "/centros", Icone: Waypoints },
  { titulo: "Grupos de oração", href: "/grupos", Icone: UsersRound },
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
                    className={ITEM_MENU}
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
                    className={ITEM_MENU}
                  >
                    {/* `UserCog` e não `UsersRound`: este agora é o ícone dos
                        grupos de oração, e com a barra recolhida só o ícone
                        aparece — dois iguais seriam dois destinos
                        indistinguíveis. E gerir acesso é mesmo o que se faz
                        aqui. */}
                    <Link href="/equipe">
                      <UserCog aria-hidden />
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
                      className={ITEM_MENU}
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
