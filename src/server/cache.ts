import "server-only";

import { unstable_cache } from "next/cache";

import { escopoDe, requerUsuario, type UsuarioSessao } from "@/server/auth/sessao";
import { comEscopo } from "@/server/db/escopo";
import type { Transacao } from "@/server/db/index";

/**
 * Leitura que sobrevive entre requisições.
 *
 * Irmã de `comUsuario()` (`src/server/dados.ts`): mesma garantia de escopo, mas
 * o resultado fica guardado e a próxima requisição não vai ao banco. Continua
 * passando por `comEscopo`, então a invariante 2 segue valendo — nenhuma
 * consulta de domínio toca o `pool` direto.
 *
 * O `React.cache` resolve o mesmo dado pedido duas vezes **no mesmo render**;
 * este resolve o mesmo dado pedido em renders diferentes. São camadas
 * distintas e vale ter as duas: o `React.cache` é memória local e custa zero,
 * enquanto este consulta o Data Cache, que na Vercel é uma ida à rede.
 */

/* ─── Por que o retorno precisa ser serializável ─────────────────────────── */

/**
 * O `unstable_cache` grava com `JSON.stringify` e lê com `JSON.parse`. Isso
 * cria uma diferença que não aparece em teste nenhum: no **miss** ele devolve
 * o valor que a consulta produziu (`Date` de verdade); no **hit**, o valor que
 * voltou do JSON — e ali `Date` já é string.
 *
 * Ou seja: a primeira visita funciona e a segunda quebra em
 * `formatarRelativo(evento.dataInicio)`, com o tipo declarado dizendo `Date` o
 * tempo todo. Exigir `Serializavel` transforma isso em erro de compilação:
 * consulta que devolve `Date` não compila como cacheada, e quem quiser cachear
 * uma precisa converter para ISO explicitamente e reidratar na volta.
 */
export type Serializavel =
  | string
  | number
  | boolean
  | null
  | Serializavel[]
  | { [chave: string]: Serializavel };

/**
 * Argumentos são mais soltos que o retorno de propósito: eles não fazem a ida
 * e volta por JSON. Na falta da entrada, o `unstable_cache` chama a consulta
 * com os argumentos originais, em memória — o `JSON.stringify` deles serve só
 * para compor a chave.
 *
 * Por isso `undefined` e `Date` são aceitos aqui e não no retorno: ambos
 * produzem chave estável (`undefined` some junto com a propriedade, `Date`
 * vira ISO) sem nunca chegar deformado a quem chamou.
 */
export type ArgumentoDeCache =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ArgumentoDeCache[]
  | { [chave: string]: ArgumentoDeCache };

/* ─── Por que a chave é `admin | papel:missaoId` ─────────────────────────── */

/**
 * Recorte que o RLS aplica na leitura, reduzido ao que de fato muda o
 * resultado.
 *
 * Vem de `ie.tem_acesso_missao()` em `drizzle/politicas.sql`:
 * `eh_admin() or alvo = missao_do_usuario()`. Logo duas pessoas com o mesmo
 * papel na mesma missão enxergam exatamente as mesmas linhas, e podem dividir
 * a entrada. Chavear por `usuarioId` seria correto mas inútil — daria uma
 * entrada por pessoa e quase nenhum acerto.
 *
 * O `papel` entra mesmo sendo hoje redundante para leitura (responsável e
 * auxiliar leem igual): é o que impede que uma política futura que diferencie
 * os dois passe a servir dado de um para o outro em silêncio.
 *
 * **Não serve para `listarUsuarios`.** A política `usuarios_leitura` inclui
 * `firebase_uid = ie.firebase_uid()`, então quem não tem missão enxerga apenas
 * a própria linha — resultado que varia por pessoa dentro do mesmo recorte.
 * Essa consulta fica fora do cache.
 */
function recorteDe(usuario: UsuarioSessao) {
  return usuario.ehAdmin ? "admin" : `${usuario.papel}:${usuario.missaoId}`;
}

type Opcoes<A extends ArgumentoDeCache[]> = {
  /**
   * Etiquetas que invalidam esta entrada. Vêm de `ETIQUETAS`.
   *
   * Recebe os argumentos como lista, para desestruturar só o que interessa
   * (`([missaoId]) => ...`). Não é `(...args)` porque quase nenhuma etiqueta
   * usa todos os parâmetros da consulta, e como tupla de rest o TypeScript
   * exigiria a aridade exata.
   *
   * `NoInfer` impede que a lista de argumentos seja inferida daqui: sem ele o
   * TypeScript ficaria com a menor das duas assinaturas, e uma consulta de
   * dois parâmetros passaria a ser chamada com zero.
   */
  etiquetas: (args: NoInfer<A>) => string[];
  /**
   * Rede de segurança em segundos, não o mecanismo principal: quem mantém o
   * dado fresco são as etiquetas, invalidadas na escrita. Isto cobre o que
   * muda sem passar por Server Action — semeadura, correção via SQL, restauro.
   */
  revalidar: number;
};

/**
 * @param nome Identifica a consulta na chave. Precisa ser único e estável:
 *   dois `leituraCacheada` com o mesmo nome dividiriam entradas e um serviria
 *   o resultado do outro.
 */
export function leituraCacheada<
  A extends ArgumentoDeCache[],
  T extends Serializavel,
>(
  nome: string,
  consulta: (tx: Transacao, ...args: A) => Promise<T>,
  opcoes: Opcoes<A>,
): (...args: A) => Promise<T> {
  return async (...args: A) => {
    // A sessão se resolve aqui fora de propósito: `unstable_cache` não pode ler
    // cookies, e o recorte precisa virar chave em vez de ficar implícito.
    const usuario = await requerUsuario();
    const escopo = escopoDe(usuario);

    return unstable_cache(
      (...recebidos: A) => comEscopo(escopo, (tx) => consulta(tx, ...recebidos)),
      [nome, recorteDe(usuario)],
      { tags: opcoes.etiquetas(args), revalidate: opcoes.revalidar },
    )(...args);
  };
}

/**
 * Leitura igual para todo usuário autenticado — uma entrada só, sem recorte.
 *
 * Vale exclusivamente para `tipos_evento` e `categorias_financeiras`, cujas
 * políticas de select em `drizzle/politicas.sql` são `ie.autenticado()`: não
 * olham missão nem papel. Usar isto em qualquer outra tabela serviria dado de
 * uma missão para outra.
 */
export function leituraGlobal<T extends Serializavel>(
  nome: string,
  consulta: (tx: Transacao) => Promise<T>,
  opcoes: { etiquetas: string[]; revalidar: number },
): () => Promise<T> {
  return async () => {
    const usuario = await requerUsuario();
    const escopo = escopoDe(usuario);

    return unstable_cache(
      () => comEscopo(escopo, consulta),
      [nome, "global"],
      { tags: opcoes.etiquetas, revalidate: opcoes.revalidar },
    )();
  };
}

/** Cadastro do admin: muda uma vez por mês, no máximo. */
export const UMA_HORA = 3600;
/** Dado de missão: a rede de segurança curta, já que a etiqueta faz o trabalho. */
export const CINCO_MINUTOS = 300;
