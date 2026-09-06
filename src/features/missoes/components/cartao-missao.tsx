import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Users,
  UsersRound,
  Waypoints,
} from "lucide-react";

import { formatarNumero } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { MissaoListada } from "../queries";

function Metrica({
  Icone,
  valor,
  rotulo,
}: {
  Icone: typeof Users;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground flex items-center gap-1.5">
        <Icone className="size-3.5" aria-hidden />
        <span className="text-xs">{rotulo}</span>
      </div>
      <p data-slot="metric" className="text-xl font-semibold">
        {valor}
      </p>
    </div>
  );
}

export function CartaoMissao({ missao }: { missao: MissaoListada }) {
  const local = [missao.regiao, missao.cidade].filter(Boolean).join(" · ");

  return (
    <Card className="hover:border-primary/40 focus-within:border-primary/40 relative transition-colors">
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            {/* O link cobre o cartão inteiro, mas o alvo de foco continua
                sendo só o título — o leitor de tela anuncia o nome, não a
                soma de todos os números do cartão. */}
            <h2 className="leading-tight font-medium">
              <Link
                href={`/missoes/${missao.id}`}
                className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none"
              >
                {missao.nome}
              </Link>
            </h2>
            {!missao.ativo ? (
              <Badge variant="secondary" className="shrink-0">
                Inativa
              </Badge>
            ) : null}
          </div>

          {local ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {local}
            </p>
          ) : null}
        </div>

        {/* Duas colunas, não quatro: no cartão mais estreito da lista (três por
            fileira em telas largas) quatro colunas espremem "Membros ~" a
            ponto de truncar o rótulo. */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <Metrica
            Icone={Users}
            rotulo={missao.membrosEstimados ? "Membros ~" : "Membros"}
            valor={formatarNumero(missao.membrosExibidos)}
          />
          <Metrica
            Icone={Waypoints}
            rotulo="Centros"
            valor={formatarNumero(missao.centrosAtivos)}
          />
          <Metrica
            Icone={UsersRound}
            rotulo="Grupos"
            valor={formatarNumero(missao.gruposAtivos)}
          />
          <Metrica
            Icone={CalendarDays}
            rotulo="Ações"
            valor={formatarNumero(missao.eventosTotal)}
          />
        </div>

        {missao.membrosEstimados ? (
          <p className="text-muted-foreground text-xs">
            Total de membros não informado — estimado pela soma dos grupos de
            oração.
          </p>
        ) : missao.pessoasEmGrupos > 0 ? (
          <p className="text-muted-foreground text-xs">
            {formatarNumero(missao.pessoasEmGrupos)} pessoas reunidas em grupos
            de oração
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
