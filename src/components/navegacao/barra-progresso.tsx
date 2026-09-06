"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/*
 * Barra fina de progresso no topo, para navegações entre rotas.
 *
 * O App Router não emite eventos de navegação: o sinal de início vem do clique
 * num link interno e o de fim, da mudança de rota.
 *
 * O andamento vive fora do React, num store próprio lido por
 * `useSyncExternalStore`. Guardá-lo em `useState` obrigaria a chamar o setter
 * de dentro de efeitos a cada troca de rota — que é exatamente o antipadrão
 * que a regra `set-state-in-effect` denuncia, e que provoca renderizações em
 * cascata.
 *
 * A barra não mede progresso real — ninguém sabe quanto falta. Ela avança
 * rápido no começo e vai desacelerando: comunica "estou trabalhando" sem
 * prometer um prazo que não pode cumprir.
 */

type Fase = "parado" | "carregando" | "finalizando";
type Estado = { fase: Fase; largura: number };

const PARADO: Estado = { fase: "parado", largura: 0 };

let estado: Estado = PARADO;
const ouvintes = new Set<() => void>();

let avanco: ReturnType<typeof setInterval> | null = null;
let desistencia: ReturnType<typeof setTimeout> | null = null;
let desaparecer: ReturnType<typeof setTimeout> | null = null;

function publicar(novo: Estado) {
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function limparTemporizadores() {
  if (avanco) clearInterval(avanco);
  if (desistencia) clearTimeout(desistencia);
  if (desaparecer) clearTimeout(desaparecer);
  avanco = desistencia = desaparecer = null;
}

function iniciar() {
  limparTemporizadores();
  publicar({ fase: "carregando", largura: 8 });

  // Avanço desacelerando: nunca chega sozinha ao fim.
  avanco = setInterval(() => {
    if (estado.fase !== "carregando") return;
    const largura = estado.largura + (92 - estado.largura) * 0.08;
    publicar({ fase: "carregando", largura });
  }, 120);

  // Se a navegação travar, a barra não fica presa na tela para sempre.
  desistencia = setTimeout(() => {
    limparTemporizadores();
    publicar(PARADO);
  }, 20_000);
}

function concluir() {
  if (estado.fase !== "carregando") return;
  limparTemporizadores();
  publicar({ fase: "finalizando", largura: 100 });
  desaparecer = setTimeout(() => publicar(PARADO), 280);
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const ler = () => estado;
const lerNoServidor = () => PARADO;

/** Ignora cliques que não geram navegação nesta aba. */
function ehNavegacaoInterna(evento: MouseEvent) {
  if (
    evento.defaultPrevented ||
    evento.button !== 0 ||
    evento.metaKey ||
    evento.ctrlKey ||
    evento.shiftKey ||
    evento.altKey
  ) {
    return false;
  }

  const ancora = (evento.target as HTMLElement | null)?.closest("a");
  const href = ancora?.getAttribute("href");

  if (
    !ancora ||
    !href ||
    ancora.target === "_blank" ||
    ancora.hasAttribute("download") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }

  const destino = new URL(href, window.location.href);
  return (
    destino.origin === window.location.origin &&
    destino.href !== window.location.href
  );
}

export function BarraProgresso() {
  const { fase, largura } = useSyncExternalStore(assinar, ler, lerNoServidor);

  const caminho = usePathname();
  const parametros = useSearchParams();

  // Chegou numa rota nova: fecha o ciclo. `concluir` mexe no store externo,
  // não em estado de componente.
  useEffect(() => {
    concluir();
  }, [caminho, parametros]);

  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      if (ehNavegacaoInterna(evento)) iniciar();
    }

    document.addEventListener("click", aoClicar, { capture: true });
    window.addEventListener("popstate", iniciar);

    return () => {
      document.removeEventListener("click", aoClicar, { capture: true });
      window.removeEventListener("popstate", iniciar);
    };
  }, []);

  if (fase === "parado") return null;

  return (
    <div
      // Decorativa: quem usa leitor de tela é avisado pela mudança de página,
      // não por uma barra que não diz nada.
      aria-hidden
      /* Nome próprio na transição de rota: sem ele a barra é capturada no
         instantâneo da página e desliza junto, além de ficar escondida atrás
         do instantâneo enquanto a transição roda. Ela e a transição dizem a
         mesma coisa em canais diferentes — a barra cobre a espera, a transição
         cobre a troca — e só não competem se a barra ficar parada. */
      style={{ viewTransitionName: "barra-progresso" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5"
    >
      <div
        className="bg-primary h-full shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${largura}%`,
          opacity: fase === "finalizando" ? 0 : 1,
        }}
      />
    </div>
  );
}
