import Link from "next/link";
import { Church, MapPin, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatarMoeda, formatarNumero, formatarPeriodo } from "@/lib/format";

import type { EventoListado } from "../queries";
import { SeloStatus } from "./selo-status";

export function LinhaEvento({
  evento,
  mostrarMissao = true,
}: {
  evento: EventoListado;
  mostrarMissao?: boolean;
}) {
  const { saldo } = evento.financeiro;
  const temMovimento =
    evento.financeiro.receitas > 0 || evento.financeiro.despesas > 0;

  return (
    <Card className="hover:border-primary/40 focus-within:border-primary/40 relative gap-0 py-4 transition-colors">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start gap-3">
          {/* A cor identifica o tipo, mas nunca sozinha: o nome vem ao lado. */}
          <span
            aria-hidden
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ background: evento.tipoCor }}
          />

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h2 className="leading-tight font-medium">
                <Link
                  href={`/eventos/${evento.id}`}
                  className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                >
                  {evento.titulo}
                </Link>
              </h2>
              <SeloStatus status={evento.status} className="shrink-0" />
            </div>

            <p className="text-muted-foreground text-sm">
              {evento.tipoNome} · {formatarPeriodo(evento.dataInicio, evento.dataFim)}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 pl-5.5 text-xs">
          {mostrarMissao ? (
            <span className="flex items-center gap-1.5">
              <Church className="size-3.5" aria-hidden />
              {evento.missaoNome}
            </span>
          ) : null}

          {evento.local ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {evento.local}
            </span>
          ) : null}

          {evento.participantesTotal > 0 ? (
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {formatarNumero(evento.participantesTotal)} participantes
              {evento.servosEngajados > 0
                ? ` · ${formatarNumero(evento.servosEngajados)} servos`
                : ""}
            </span>
          ) : null}

          {temMovimento ? (
            <span
              className={
                saldo < 0 ? "text-destructive font-medium" : "font-medium"
              }
            >
              Saldo {formatarMoeda(saldo)}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
