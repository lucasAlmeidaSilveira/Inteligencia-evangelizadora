import "server-only";

import { randomBytes } from "node:crypto";

import { comPesquisa } from "@/server/db/escopo";
import type { Transacao } from "@/server/db/index";

/** 32 bytes aleatórios → 43 caracteres base64url. Só o servidor gera. */
export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

/*
 * ─── Filtros baratos na frente do banco ────────────────────────────────────
 *
 * A garantia contra inundação está dentro de `ie.responder_pesquisa()` (120
 * respostas por minuto por pesquisa, 10 mil no total). O que está aqui existe
 * por outro motivo: cada ida ao banco custa uma conexão de um pool de cinco,
 * dividido com os coordenadores. Um robô batendo no link não pode deixar a
 * missão esperando conexão para abrir a própria tela.
 *
 * Os números são calibrados para o uso real — um QR projetado num salão, com
 * dezenas de pessoas apontando o celular no mesmo minuto — e não para o
 * mínimo que pareceria seguro: abrir a página é leitura de 3 s, cabe folga;
 * enviar é escrita, cabe menos.
 *
 * Memória por instância, então em serverless cada instância conta sozinha.
 * É filtro, não garantia — e é por isso que o limite de verdade mora na
 * função SQL.
 */

const JANELA_MS = 10_000;
const LIMITES = {
  /** Abrir a página: um salão inteiro escaneando o QR de uma vez. */
  pagina: 60,
  /** Enviar resposta: o banco ainda limita a 120 por minuto. */
  resposta: 20,
} as const;
const MAXIMO_GLOBAL = 300;
/** Teto do mapa: um atacante variando o token não cresce a memória sem fim. */
const MAXIMO_DE_CHAVES = 2_000;

type Balde = { contagem: number; inicio: number };
const baldes = new Map<string, Balde>();
let global: Balde = { contagem: 0, inicio: 0 };

function contar(balde: Balde, agora: number, maximo: number) {
  if (agora - balde.inicio >= JANELA_MS) {
    balde.inicio = agora;
    balde.contagem = 0;
  }
  balde.contagem += 1;
  return balde.contagem <= maximo;
}

function limparVencidos(agora: number) {
  for (const [chave, balde] of baldes) {
    if (agora - balde.inicio >= JANELA_MS) baldes.delete(chave);
  }
}

/** `true` quando a requisição pode seguir ao banco. */
export function limitarPublico(token: string, uso: keyof typeof LIMITES) {
  const agora = Date.now();

  if (!contar(global, agora, MAXIMO_GLOBAL)) return false;

  if (baldes.size >= MAXIMO_DE_CHAVES) {
    limparVencidos(agora);
    if (baldes.size >= MAXIMO_DE_CHAVES) return false;
  }

  const chave = `${uso}:${token}`;
  let balde = baldes.get(chave);
  if (!balde) {
    balde = { contagem: 0, inicio: agora };
    baldes.set(chave, balde);
  }
  return contar(balde, agora, LIMITES[uso]);
}

/*
 * Tokens que o banco já disse não existir. Repetir um deles — ou um robô
 * varrendo links inventados — não custa conexão nem conta no balde global.
 * Bem-formado mas desconhecido é o único caso que chega ao banco para dar
 * em nada; depois da primeira vez, não chega mais por um minuto.
 */
const DESCONHECIDO_MS = 60_000;
const MAXIMO_DESCONHECIDOS = 5_000;
const desconhecidos = new Map<string, number>();

export function tokenDesconhecido(token: string) {
  const visto = desconhecidos.get(token);
  if (visto === undefined) return false;
  if (Date.now() - visto >= DESCONHECIDO_MS) {
    desconhecidos.delete(token);
    return false;
  }
  return true;
}

export function marcarTokenDesconhecido(token: string) {
  if (desconhecidos.size >= MAXIMO_DESCONHECIDOS) {
    const agora = Date.now();
    for (const [chave, visto] of desconhecidos) {
      if (agora - visto >= DESCONHECIDO_MS) desconhecidos.delete(chave);
    }
    if (desconhecidos.size >= MAXIMO_DESCONHECIDOS) return;
  }
  desconhecidos.set(token, Date.now());
}

/** Só para teste: zera contadores e caches entre cenários. */
export function zerarLimitePublico() {
  baldes.clear();
  desconhecidos.clear();
  global = { contagem: 0, inicio: 0 };
}

/*
 * No máximo duas transações públicas ao mesmo tempo por instância, e no
 * máximo dez esperando — a partir daí recusa na hora, em vez de enfileirar
 * até o pool. Quem recusa aqui nunca chegou a pegar conexão.
 */
const CONCORRENCIA = 2;
const FILA_MAXIMA = 10;
let emUso = 0;
const fila: (() => void)[] = [];

export class CaminhoPublicoOcupado extends Error {
  constructor() {
    super("Muita gente respondendo agora.");
    this.name = "CaminhoPublicoOcupado";
  }
}

async function adquirir() {
  if (emUso < CONCORRENCIA) {
    emUso += 1;
    return;
  }
  if (fila.length >= FILA_MAXIMA) throw new CaminhoPublicoOcupado();
  // Quem espera recebe a vaga já contada por `devolver()`: não incrementa de
  // novo ao acordar, senão uma terceira transação passaria no intervalo.
  await new Promise<void>((liberar) => fila.push(liberar));
}

function devolver() {
  const proximo = fila.shift();
  if (proximo) {
    // A vaga passa de mão sem voltar a zero no meio.
    proximo();
    return;
  }
  emUso -= 1;
}

/**
 * A transação da pesquisa pública, atrás do semáforo. É por aqui — e só por
 * aqui — que a página e a action públicas chegam ao banco.
 */
export async function comPesquisaLimitada<T>(
  token: string,
  executar: (tx: Transacao) => Promise<T>,
): Promise<T> {
  await adquirir();
  try {
    return await comPesquisa(token, executar);
  } finally {
    devolver();
  }
}
