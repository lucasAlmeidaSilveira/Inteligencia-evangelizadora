import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

/** Interface e dados. Inter tem figuras tabulares reais, o que importa numa
 *  tela cheia de métricas. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Reservada à marca — login e cabeçalho. Serifa humanista dá calor
 *  institucional sem cansar em uso diário, o que uma monoespaçada faria. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inteligência Evangelizadora",
    template: "%s · Inteligência Evangelizadora",
  },
  description:
    "Acompanhamento de missões, grupos de oração e ações apostólicas.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcff" },
    { media: "(prefers-color-scheme: dark)", color: "#17151c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
