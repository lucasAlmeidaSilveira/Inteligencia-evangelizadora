import Link from "next/link";
import { CalendarDays, Church, MapPin, Phone, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatarNumero } from "@/lib/format";

import type { CentroVisivel } from "../queries";
import { SeloTipoCentro } from "./selo-tipo-centro";

/**
 * Centro na listagem que atravessa missões.
 *
 * O destino é a aba de centros da missão dele, e não uma tela de centro: o
 * cadastro de um centro vive lá — criar, editar e excluir num lugar só. Esta
 * tela responde onde os centros estão; aquela responde o que fazer com um.
 */
export function LinhaCentro({
  centro,
  mostrarMissao = true,
}: {
  centro: CentroVisivel;
  mostrarMissao?: boolean;
}) {
  const local = [centro.regiao, centro.cidade].filter(Boolean).join(" · ");

  return (
    /* O mesmo cartão-linha clicável da ação apostólica: anel aceso e 2px de
       elevação dizem que a linha inteira leva a algum lugar. */
    <Card className="hover:ring-primary/40 focus-within:ring-primary/40 relative gap-0 py-4 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 active:translate-y-0">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* O link cobre a linha inteira, mas só o nome recebe foco: o
                  leitor de tela anuncia o centro, não a soma dos números. */}
              <h2 className="leading-tight font-medium">
                <Link
                  href={`/missoes/${centro.missaoId}/centros`}
                  className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                >
                  {centro.nome}
                </Link>
              </h2>
              {centro.principal ? (
                <Badge variant="outline">Principal</Badge>
              ) : null}
              {!centro.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
            </div>
            <SeloTipoCentro tipo={centro.tipo} />
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {mostrarMissao ? (
            <span className="flex items-center gap-1.5">
              <Church className="size-3.5 shrink-0" aria-hidden />
              {centro.missaoNome}
            </span>
          ) : null}

          {local ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {local}
            </span>
          ) : null}

          {centro.contatoTelefone ? (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              {centro.contatoTelefone}
            </span>
          ) : null}

          <span className="flex items-center gap-1.5">
            <UsersRound className="size-3.5 shrink-0" aria-hidden />
            {formatarNumero(centro.grupos)}{" "}
            {centro.grupos === 1 ? "grupo" : "grupos"}
          </span>

          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            {formatarNumero(centro.eventos)}{" "}
            {centro.eventos === 1 ? "ação" : "ações"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
