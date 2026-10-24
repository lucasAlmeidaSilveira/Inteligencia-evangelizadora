import "server-only";

import { comEscopo, type Escopo } from "@/server/db/escopo";
import type { Transacao } from "@/server/db/index";

/**
 * Escopo do sistema: o que a rotina agendada usa para enxergar todas as
 * missões sem haver pessoa alguma do outro lado.
 *
 * É o papel `admin` para o RLS, com um `usuario_id` que não corresponde a
 * ninguém — as policies exigem um id (ver `ie.autenticado()`), e este não casa
 * com linha nenhuma de `usuarios`, então nada que dependa de "quem sou eu"
 * (notificações próprias, último acesso) encontra alguma coisa.
 *
 * Uso restrito, e a restrição é a invariante: só código disparado pelo
 * agendador, depois de conferir `CRON_SECRET`. Jamais numa requisição de
 * usuário — ali o escopo é o de `comUsuario()`, e ponto. Um `comSistema`
 * chamado numa Server Action entregaria dado de todas as missões a quem
 * pediu, sem erro em lugar nenhum.
 */
export const ESCOPO_DO_SISTEMA: Escopo = {
  papel: "admin",
  usuarioId: "00000000-0000-0000-0000-000000000000",
};

export function comSistema<T>(executar: (tx: Transacao) => Promise<T>) {
  return comEscopo(ESCOPO_DO_SISTEMA, executar);
}
