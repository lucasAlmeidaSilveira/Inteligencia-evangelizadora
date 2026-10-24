import type { TipoHistorico } from "@/server/db/schema";
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/format";

import { rotuloDoStatus } from "./components/selo-status";
import { formatarNps } from "./impacto";

/*
 * Como ler uma linha de `evento_historico`.
 *
 * O banco grava o acontecimento cru — tipo, quem, quando e um `detalhes` em
 * jsonb cuja forma depende do tipo (ver as triggers em drizzle/politicas.sql).
 * Aqui ele vira frase: "Ana alterou Título e Local", com cada campo em
 * português e cada valor formatado como a tela já formata (dinheiro, data,
 * status). Sem `server-only` de propósito: é texto, e pode ir para onde a tela
 * precisar.
 */

type Valor = string | number | boolean | null;

/** Um campo de `eventos` que mudou: valor anterior e novo, como o banco os
 *  serializou em jsonb. Nomes físicos (`data_inicio`), não os do Drizzle. */
export type Alteracao = { campo: string; de: Valor; para: Valor };

/** Solto de propósito: a forma varia por tipo, e `descreverEntrada` confere o
 *  que usa em vez de confiar numa chave que a trigger pode não ter gravado. */
export type DetalhesHistorico = { [chave: string]: Valor | Alteracao[] };

export type EntradaHistorico = {
  id: string;
  tipo: TipoHistorico;
  /** Nulo quando não havia pessoa no escopo — semeadura, correção via SQL. */
  usuarioNome: string | null;
  detalhes: DetalhesHistorico;
  /** ISO. */
  registradoEm: string;
};

/* ─── Campos da ação ─────────────────────────────────────────────────────── */

const ROTULOS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  observacoes: "Observações",
  data_inicio: "Início",
  data_fim: "Término",
  local: "Local",
  // Chega à tela já unido a `local`, sob o mesmo rótulo — ver `unirLocal`.
  local_centro_id: "Local",
  endereco: "Endereço",
  responsavel_nome: "Responsável",
  status: "Status",
  destaque_regional: "Destaque regional",
  tipo_evento_id: "Tipo da ação",
  centro_id: "Centro",
  missao_id: "Missão",
  participantes_inscritos: "Inscritos",
  participantes_total: "Presentes",
  participantes_novos: "Novos participantes",
  participantes_permaneceram: "Permaneceram em grupo",
  servos_engajados: "Servos engajados",
  nps: "Satisfação (NPS)",
  orcamento_previsto: "Orçamento previsto",
};

/** Coluna nova em `eventos` entra no histórico sozinha (a trigger não tem
 *  lista); até ganhar rótulo aqui, aparece legível em vez de em snake_case. */
export function rotuloDoCampo(campo: string) {
  return ROTULOS[campo] ?? campo.replaceAll("_", " ");
}

/** Textos longos (descrição, observações) não cabem em "de X para Y" numa
 *  linha: a tela os empilha. */
const CAMPOS_LONGOS = new Set(["descricao", "observacoes"]);

const STATUS = new Set(["planejado", "em_andamento", "realizado", "cancelado"]);

/** "em branco" e não "—": num histórico, o travessão pareceria valor perdido. */
export function formatarValorDoCampo(campo: string, valor: Valor) {
  if (valor === null || valor === "") return "em branco";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";

  if (campo === "data_inicio" || campo === "data_fim") {
    return formatarDataHora(String(valor));
  }
  if (campo === "orcamento_previsto") return formatarMoeda(String(valor));
  if (campo === "nps") return formatarNps(valor);
  if (campo === "status" && typeof valor === "string" && STATUS.has(valor)) {
    return rotuloDoStatus(valor as Parameters<typeof rotuloDoStatus>[0]);
  }
  if (typeof valor === "number") return formatarNumero(valor);
  return String(valor);
}

export type AlteracaoLegivel = {
  campo: string;
  rotulo: string;
  de: string;
  para: string;
  longa: boolean;
};

/**
 * `local_centro_id` e `local` são o mesmo dado em duas colunas: o centro
 * escolhido ou o texto livre, nunca os dois (CHECK `local_centro_ou_texto`).
 * Trocar um pelo outro grava duas alterações — "Local: Paróquia São José →
 * em branco" e "local_centro_id: em branco → Missão Guarulhos" —, e quem lê
 * quer uma só: "Local: Paróquia São José → Missão Guarulhos". Como no máximo
 * um dos dois tem valor de cada lado, o primeiro não vazio é o local daquele
 * momento.
 */
function unirLocal(lista: Alteracao[]): Alteracao[] {
  const centro = lista.find((a) => a.campo === "local_centro_id");
  if (!centro) return lista;
  const texto = lista.find((a) => a.campo === "local");

  const de = centro.de ?? texto?.de ?? null;
  const para = centro.para ?? texto?.para ?? null;

  /* Mesmo nome dos dois lados: mudou só a fonte — o centro excluído, cujo nome
     passou para o texto livre, ou o texto que virou o centro de mesmo nome.
     Sem dizer a fonte, a linha seria "Sede → Sede", e quem lê não saberia o
     que mudou. */
  const comFonte = (valor: Valor, doCentro: boolean) =>
    `${valor} (${doCentro ? "centro da missão" : "escrito à mão"})`;
  const unida: Alteracao =
    de === para
      ? {
          campo: "local",
          de: comFonte(de, centro.de !== null),
          para: comFonte(para, centro.para !== null),
        }
      : { campo: "local", de, para };

  // No lugar do primeiro do par, para manter a ordem em que a trigger grava.
  const posicao = lista.findIndex((a) => a === centro || a === texto);
  const resto = lista.filter((a) => a !== centro && a !== texto);
  return [...resto.slice(0, posicao), unida, ...resto.slice(posicao)];
}

function alteracoesDe(detalhes: DetalhesHistorico): AlteracaoLegivel[] {
  const lista = detalhes.alteracoes;
  if (!Array.isArray(lista)) return [];
  return unirLocal(lista).map((a) => ({
    campo: a.campo,
    rotulo: rotuloDoCampo(a.campo),
    de: formatarValorDoCampo(a.campo, a.de),
    para: formatarValorDoCampo(a.campo, a.para),
    longa: CAMPOS_LONGOS.has(a.campo),
  }));
}

/* ─── A frase ────────────────────────────────────────────────────────────── */

export type EntradaLegivel = {
  /** Quem fez. "Sistema" quando não havia pessoa no escopo. */
  autor: string;
  /** O verbo e o objeto, para vir logo depois do nome: "alterou Título e Local". */
  acao: string;
  /** Uma linha a mais, quando a frase não basta: o lançamento, o arquivo, o prazo. */
  detalhe: string | null;
  /** Só em `acao_alterada`: cada campo com antes e depois. */
  alteracoes: AlteracaoLegivel[];
};

/** "Título", "Título e Local", "Título, Local e Início". */
function enumerar(itens: string[]) {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

function texto(detalhes: DetalhesHistorico, chave: string) {
  const v = detalhes[chave];
  return typeof v === "string" ? v : null;
}

function lancamento(detalhes: DetalhesHistorico) {
  const partes = [
    texto(detalhes, "descricao"),
    texto(detalhes, "valor") ? formatarMoeda(texto(detalhes, "valor")) : null,
    texto(detalhes, "data") ? formatarData(texto(detalhes, "data")!) : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

function prazo(detalhes: DetalhesHistorico) {
  const fim = texto(detalhes, "encerra_em");
  return fim ? `Aceita respostas até ${formatarData(fim)}.` : null;
}

export function descreverEntrada(entrada: EntradaHistorico): EntradaLegivel {
  const { tipo, detalhes } = entrada;
  const autor = entrada.usuarioNome ?? "Sistema";
  const base = { autor, detalhe: null, alteracoes: [] as AlteracaoLegivel[] };

  switch (tipo) {
    case "acao_criada":
      return { ...base, acao: "criou a ação" };

    case "acao_alterada": {
      const alteracoes = alteracoesDe(detalhes);
      return {
        ...base,
        acao: alteracoes.length
          ? `alterou ${enumerar(alteracoes.map((a) => a.rotulo))}`
          : "alterou a ação",
        alteracoes,
      };
    }

    case "lancamento_adicionado":
    case "lancamento_excluido": {
      const natureza = texto(detalhes, "tipo") === "receita" ? "uma receita" : "uma despesa";
      return {
        ...base,
        acao: `${tipo === "lancamento_adicionado" ? "lançou" : "excluiu"} ${natureza}`,
        detalhe: lancamento(detalhes),
      };
    }

    case "documento_adicionado":
      return { ...base, acao: "anexou um documento", detalhe: texto(detalhes, "nome") };
    case "documento_excluido":
      return { ...base, acao: "excluiu um documento", detalhe: texto(detalhes, "nome") };

    case "link_adicionado":
    case "link_excluido": {
      const titulo = texto(detalhes, "titulo");
      const url = texto(detalhes, "url");
      return {
        ...base,
        acao: `${tipo === "link_adicionado" ? "adicionou" : "excluiu"} um link`,
        detalhe: titulo && url ? `${titulo} — ${url}` : (titulo ?? url),
      };
    }

    case "pesquisa_aberta":
      return { ...base, acao: "abriu a pesquisa de satisfação", detalhe: prazo(detalhes) };
    case "pesquisa_encerrada":
      return { ...base, acao: "encerrou a pesquisa de satisfação" };
    case "pesquisa_reaberta":
      return { ...base, acao: "reabriu a pesquisa de satisfação", detalhe: prazo(detalhes) };
    case "pesquisa_link_renovado":
      return {
        ...base,
        acao: "gerou um novo link para a pesquisa",
        detalhe: "O link anterior deixou de funcionar; as respostas foram mantidas.",
      };

    case "respostas_excluidas": {
      const n = typeof detalhes.quantidade === "number" ? detalhes.quantidade : 0;
      return {
        ...base,
        acao:
          n === 1
            ? "excluiu uma resposta da pesquisa"
            : `excluiu ${formatarNumero(n)} respostas da pesquisa`,
      };
    }
  }
}
