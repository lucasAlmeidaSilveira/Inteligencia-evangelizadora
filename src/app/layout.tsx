import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

/**
 * Interface e dados.
 *
 * IBM Plex Sans no lugar do Inter, que é o padrão de todo mundo e por isso não
 * diz nada. O Plex tem terminais levemente flanqueados e um `a` e um `g` com
 * personalidade própria, figuras tabulares de verdade — o que importa numa tela
 * cheia de métricas — e diacríticos bem resolvidos para o português.
 */
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Marca e títulos: nome do sistema, chamadas, cabeçalhos de página.
 *
 * Space Grotesk tem bojos de lado reto e terminais cortados na horizontal — a
 * mesma geometria retangular do monograma, o que faz símbolo e nome parecerem
 * desenhados juntos. E contrasta com o Plex por classe (grotesca geométrica
 * contra grotesca humanista), não por detalhe, que é o que faz um par de tipos
 * funcionar em vez de parecer um erro.
 */
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inteligência Evangelizadora",
    template: "%s · Inteligência Evangelizadora",
  },
  description:
    "Acompanhamento das missões da Comunidade Católica Shalom: membros, grupos de oração e ações apostólicas.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafe" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1520" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${plex.variable} ${grotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
