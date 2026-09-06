import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
  Users,
  UsersRound,
  Waypoints,
} from "lucide-react";

import { CartaoMetrica } from "@/components/padroes/cartao-metrica";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { obterMissao } from "@/features/missoes/queries";
import { formatarData, formatarNumero, formatarRelativo } from "@/lib/format";

function Linha({
  Icone,
  rotulo,
  valor,
}: {
  Icone: typeof User;
  rotulo: string;
  valor: string | null;
}) {
  if (!valor) return null;
  return (
    <div className="flex gap-3">
      <Icone
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
        aria-hidden
      />
      <div className="min-w-0 space-y-0.5">
        <p className="text-muted-foreground text-xs">{rotulo}</p>
        <p className="text-sm break-words">{valor}</p>
      </div>
    </div>
  );
}

export default async function PaginaVisaoGeral({
  params,
}: PageProps<"/missoes/[id]">) {
  const { id } = await params;
  const missao = await obterMissao(id);
  if (!missao) notFound();

  const temDados =
    missao.responsavel ||
    missao.contatoTelefone ||
    missao.endereco ||
    missao.dataFundacao ||
    // A próxima ação mora neste card desde que "Centros" tomou o lugar dela
    // entre as métricas. Sem esta condição, numa missão sem nenhum dado de
    // cadastro o card não renderiza e a próxima ação some da tela.
    missao.proximoEvento;

  return (
    <div className="space-y-6">
      {!missao.responsavel ? (
        <div className="border-warning/40 bg-warning/8 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Missão sem responsável</p>
            <p className="text-muted-foreground text-sm text-pretty">
              Ninguém responde por esta missão nem pode convidar auxiliares para
              ela. Convide o responsável em Equipe.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/equipe">Ir para Equipe</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          Icone={Users}
          rotulo="Membros"
          valor={formatarNumero(missao.membrosExibidos)}
          detalhe={
            missao.membrosEstimados
              ? "Estimado pela soma dos grupos de oração"
              : undefined
          }
        />
        {/* Centros toma o lugar de "Próxima ação", que desceu para o card de
            dados: é uma data, não uma contagem, e ali fica entre iguais. Um
            quinto cartão abriria uma fileira com um item só. */}
        <CartaoMetrica
          Icone={Waypoints}
          rotulo="Centros de evangelização"
          valor={formatarNumero(missao.centrosAtivos)}
        />
        <CartaoMetrica
          Icone={UsersRound}
          rotulo="Grupos de oração"
          valor={formatarNumero(missao.gruposAtivos)}
          detalhe={
            missao.pessoasEmGrupos > 0
              ? `${formatarNumero(missao.pessoasEmGrupos)} pessoas reunidas`
              : undefined
          }
        />
        <CartaoMetrica
          Icone={Sparkles}
          rotulo="Ações apostólicas"
          valor={formatarNumero(missao.eventosTotal)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {temDados ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Dados da missão</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Linha
                Icone={User}
                rotulo="Responsável"
                valor={missao.responsavel?.nome ?? null}
              />
              <Linha
                Icone={Phone}
                rotulo="Telefone"
                valor={missao.contatoTelefone}
              />
              <Linha
                Icone={Mail}
                rotulo="E-mail do responsável"
                valor={missao.responsavel?.email ?? null}
              />
              <Linha
                Icone={CalendarDays}
                rotulo="Fundação"
                valor={
                  missao.dataFundacao ? formatarData(missao.dataFundacao) : null
                }
              />
              <Linha
                Icone={MapPin}
                rotulo="Endereço"
                valor={missao.endereco}
              />
              <Linha
                Icone={Sparkles}
                rotulo="Próxima ação"
                valor={
                  missao.proximoEvento
                    ? `${formatarData(missao.proximoEvento)} — ${formatarRelativo(missao.proximoEvento)}`
                    : null
                }
              />
            </CardContent>
          </Card>
        ) : null}

        {missao.observacoes ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {missao.observacoes}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
