import Link from "next/link";
import { Church, Clock, HandHeart, MapPin, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatarNumero } from "@/lib/format";

import type { GrupoVisivel } from "../queries";
import { nomeDoDia } from "../schemas";

/**
 * Grupo na listagem que atravessa missões.
 *
 * Leva à aba de grupos da missão dele, já recortada pelo centro do grupo: é lá
 * que se cadastra, edita e exclui, e chegar com o recorte pronto poupa procurar
 * o grupo no meio de todos os outros da missão.
 */
export function LinhaGrupo({
  grupo,
  mostrarMissao = true,
}: {
  grupo: GrupoVisivel;
  mostrarMissao?: boolean;
}) {
  const dia = nomeDoDia(grupo.diaSemana);
  // O Postgres devolve `time` como "19:30:00"; na tela bastam horas e minutos.
  const encontro = [dia, grupo.horario?.slice(0, 5)].filter(Boolean).join(" às ");

  return (
    <Card className="hover:ring-primary/40 focus-within:ring-primary/40 relative gap-0 py-4 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 active:translate-y-0">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="leading-tight font-medium">
                <Link
                  href={`/missoes/${grupo.missaoId}/grupos?centro=${grupo.centroId}`}
                  className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                >
                  {grupo.nome}
                </Link>
              </h2>
              {!grupo.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
            </div>
            <p className="text-muted-foreground text-sm">
              {formatarNumero(grupo.quantidadePessoas)} pessoas
            </p>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {mostrarMissao ? (
            <span className="flex items-center gap-1.5">
              <Church className="size-3.5 shrink-0" aria-hidden />
              {grupo.missaoNome}
            </span>
          ) : null}

          <span className="flex items-center gap-1.5">
            <Waypoints className="size-3.5 shrink-0" aria-hidden />
            {grupo.centroNome}
          </span>

          {encontro ? (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {encontro}
            </span>
          ) : null}

          {grupo.local ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {grupo.local}
            </span>
          ) : null}

          {grupo.pastores.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <HandHeart className="size-3.5 shrink-0" aria-hidden />
              {grupo.pastores.map((p) => p.nome).join(", ")}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
