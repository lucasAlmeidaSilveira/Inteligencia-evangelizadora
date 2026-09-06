"use client";

import { useSearchParams } from "next/navigation";

import { useFiltro } from "@/components/padroes/area-filtrada";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chaveDoMes, mesesDoFiltro, rotuloDoMes } from "@/lib/mes";

import { lerPeriodoDoPainel, TODO_O_PERIODO } from "../periodo";

/**
 * O recorte de período do painel, na URL.
 *
 * É o mesmo `?mes=` de /eventos, de propósito: os cartões levam para lá com o
 * recorte aplicado, e um segundo vocabulário de período faria o painel dizer
 * um número e a tela de destino mostrar outro. A missão continua fora daqui —
 * quem a escolhe é o seletor da barra lateral, e um select de missão ao lado
 * deste daria duas verdades na tela.
 *
 * O recorte fica compartilhável e sobrevive ao recarregar e ao botão voltar,
 * ao contrário do foco de missão, que é do coordenador e mora em cookie.
 */
export function FiltrosPainel() {
  // `aplicar` é o `router.push` dentro de uma transição: é o que esmaece o
  // painel enquanto o novo recorte não chega, em vez de deixar os números
  // antigos na tela como se nada tivesse sido pedido.
  const { aplicar } = useFiltro();
  const parametros = useSearchParams();

  function definir(valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    /* O mês corrente sai da URL em vez de entrar: ele já é o padrão, e `/`
       limpo é o endereço do painel. Quem mandar esse link a outra pessoa em
       outubro quer que ela veja outubro; quem quiser fixar setembro escolhe
       setembro na lista e leva `?mes=2026-09`, que não se move. */
    if (valor === chaveDoMes()) novos.delete("mes");
    else novos.set("mes", valor);
    aplicar(`/${novos.size ? `?${novos}` : ""}`);
  }

  /* Um link guardado pode apontar para fora da janela — o mês de março de dois
     anos atrás, mandado por e-mail. Ele entra na lista para que o gatilho
     mostre o recorte em vigor em vez de ficar em branco. */
  const mesAtual = lerPeriodoDoPainel(parametros.get("mes"));
  const janela = mesesDoFiltro();
  const meses =
    mesAtual && !janela.includes(mesAtual) ? [mesAtual, ...janela] : janela;

  return (
    <Select value={mesAtual ?? TODO_O_PERIODO} onValueChange={definir}>
      <SelectTrigger className="w-full min-w-44 sm:w-auto" aria-label="Filtrar por mês">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {meses.map((mes) => (
          <SelectItem key={mes} value={mes}>
            {rotuloDoMes(mes)}
          </SelectItem>
        ))}
        {/* Por último: é o recorte mais largo, e o padrão da tela é um mês. */}
        <SelectItem value={TODO_O_PERIODO}>Todo o período</SelectItem>
      </SelectContent>
    </Select>
  );
}
