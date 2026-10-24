import {
  ArrowRight,
  ClipboardList,
  FileText,
  Link2,
  type LucideIcon,
  MessageSquareText,
  Pencil,
  Receipt,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { dataDaChave, diaNoFuso, horaNoFuso, somarDias } from "@/lib/fuso";
import type { TipoHistorico } from "@/server/db/schema";

import { descreverEntrada, type EntradaHistorico } from "../historico";

/*
 * A linha do tempo da ação, agrupada por dia, do mais recente ao mais antigo.
 *
 * Server Component sem estado: não há o que clicar aqui além de ler. O dia de
 * cada entrada se decide no fuso de São Paulo (`diaNoFuso`), nunca no da
 * máquina — o servidor roda em UTC, e uma edição às 22h cairia no dia
 * seguinte (invariante 10).
 */

const ICONES: Record<TipoHistorico, LucideIcon> = {
  acao_criada: Sparkles,
  acao_alterada: Pencil,
  lancamento_adicionado: Receipt,
  lancamento_excluido: Receipt,
  documento_adicionado: FileText,
  documento_excluido: FileText,
  link_adicionado: Link2,
  link_excluido: Link2,
  pesquisa_aberta: ClipboardList,
  pesquisa_encerrada: ClipboardList,
  pesquisa_reaberta: ClipboardList,
  pesquisa_link_renovado: ClipboardList,
  respostas_excluidas: MessageSquareText,
};

/**
 * A criação, quando o histórico não a tem.
 *
 * Ações registradas antes de o histórico existir não têm linha de criação —
 * mas têm `criado_em`. Montar a entrada a partir dele deixa a linha do tempo
 * sempre terminar onde a ação começou, e é o lugar certo para avisar que o que
 * mudou antes disso não foi gravado. Honesto: a aba nunca sugere que uma ação
 * antiga passou intocada só porque a lista está curta.
 */
type Item = EntradaHistorico & { sintetica?: boolean };

const diaLongo = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Hoje", "Ontem" ou "quinta-feira, 12 de março de 2026". */
function rotuloDoDia(chave: string, hoje: string) {
  if (chave === hoje) return "Hoje";
  if (chave === somarDias(hoje, -1)) return "Ontem";
  const texto = diaLongo.format(dataDaChave(chave));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function PainelHistorico({
  entradas,
  criadoEm,
}: {
  entradas: EntradaHistorico[];
  /** ISO. Fecha a linha do tempo quando a criação não foi registrada. */
  criadoEm: string;
}) {
  const itens: Item[] = entradas.some((e) => e.tipo === "acao_criada")
    ? entradas
    : [
        ...entradas,
        {
          id: "criacao",
          tipo: "acao_criada",
          usuarioNome: null,
          detalhes: {},
          registradoEm: criadoEm,
          sintetica: true,
        },
      ];

  // Já vêm do mais recente ao mais antigo; o Map preserva essa ordem nos dias.
  const porDia = new Map<string, Item[]>();
  for (const item of itens) {
    const dia = diaNoFuso(item.registradoEm);
    porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
  }

  const hoje = diaNoFuso(new Date());

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm text-pretty">
        Tudo que mudou nesta ação, com quem fez e quando: os dados da própria
        ação, os lançamentos, os documentos, os links e a pesquisa de
        satisfação.
      </p>

      {[...porDia.entries()].map(([dia, doDia]) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="space-y-2">
          <h2
            id={`dia-${dia}`}
            className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase"
          >
            {rotuloDoDia(dia, hoje)}
          </h2>
          <Card className="py-0">
            <CardContent className="p-0">
              <ol className="divide-y">
                {doDia.map((item) => (
                  <Entrada key={item.id} item={item} />
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}

function Entrada({ item }: { item: Item }) {
  const Icone = ICONES[item.tipo];
  const legivel = descreverEntrada(item);

  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        aria-hidden
        className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        <Icone className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm">
            {item.sintetica ? (
              "Ação criada"
            ) : (
              <>
                <span className="font-medium">{legivel.autor}</span>{" "}
                {legivel.acao}
              </>
            )}
          </p>
          {/* `<time>` com o instante inteiro: a hora na tela é a de São Paulo,
              e quem precisar do dado exato o tem no atributo. */}
          <time
            dateTime={item.registradoEm}
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {horaNoFuso(item.registradoEm)}
          </time>
        </div>

        {legivel.detalhe ? (
          <p className="text-muted-foreground text-sm break-words">
            {legivel.detalhe}
          </p>
        ) : null}

        {legivel.alteracoes.length > 0 ? (
          <dl className="mt-2 space-y-1.5 text-sm">
            {legivel.alteracoes.map((a) => (
              <div
                key={a.campo}
                className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[11rem_minmax(0,1fr)]"
              >
                <dt className="text-muted-foreground">{a.rotulo}</dt>
                {a.longa ? (
                  /* Texto longo empilha, com "Antes" e "Depois" escritos: a
                     seta e o peso da fonte não bastam para separar dois
                     parágrafos. */
                  <dd className="space-y-1.5">
                    <p className="text-muted-foreground whitespace-pre-line">
                      <span className="mr-1.5 text-[10px] font-medium tracking-wide uppercase">
                        Antes
                      </span>
                      {a.de}
                    </p>
                    <p className="whitespace-pre-line">
                      <span className="text-muted-foreground mr-1.5 text-[10px] font-medium tracking-wide uppercase">
                        Depois
                      </span>
                      {a.para}
                    </p>
                  </dd>
                ) : (
                  /* Antes em cinza, depois em peso maior, seta entre eles — e
                     "de"/"para" só para o leitor de tela, que não vê a seta. */
                  <dd className="flex flex-wrap items-center gap-x-1.5">
                    <span className="sr-only">de</span>
                    <span className="text-muted-foreground break-words">
                      {a.de}
                    </span>
                    <ArrowRight
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden
                    />
                    <span className="sr-only">para</span>
                    <span className="font-medium break-words">{a.para}</span>
                  </dd>
                )}
              </div>
            ))}
          </dl>
        ) : null}

        {item.sintetica ? (
          <p className="text-muted-foreground mt-1 text-xs text-pretty">
            Esta ação é anterior ao histórico: o que mudou antes de ele existir
            não foi registrado. Daqui em diante, toda alteração aparece aqui.
          </p>
        ) : null}
      </div>
    </li>
  );
}
