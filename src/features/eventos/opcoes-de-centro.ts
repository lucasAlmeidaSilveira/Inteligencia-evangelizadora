import type { CentroParaSelecao } from "@/features/centros/queries";

/** O que os selects de centro de uma ação precisam saber de cada opção. */
export type OpcaoDeCentro = Pick<
  CentroParaSelecao,
  "id" | "missaoId" | "nome" | "principal" | "endereco"
>;

/**
 * As opções dos dois selects de centro de uma ação já cadastrada: de qual
 * frente ela é (`centros`) e onde acontece (`locais`).
 *
 * A base é a mesma — os centros que recebem vínculo novo —, e a cada lista se
 * soma o centro que a ação já usa naquele papel, ainda que arquivado. Sem ele
 * o select abriria sem a opção atual, e salvar trocaria o centro, ou apagaria
 * o local, sem ninguém pedir. Só naquele papel: centro inativo não recebe
 * vínculo novo, e oferecer o arquivado no outro select seria oferecer um.
 */
export function opcoesDeCentro(
  base: OpcaoDeCentro[],
  acao: {
    missaoId: string;
    centroId: string;
    centroNome: string;
    localCentroId: string | null;
    /** Já resolvidos pela consulta: com um centro como local, são os dele. */
    local: string | null;
    endereco: string | null;
  },
) {
  const falta = (id: string) => !base.some((c) => c.id === id);

  // Nunca é o principal: esse vem sempre na base, mesmo arquivado,
  // justamente porque `centro_id` é obrigatório.
  const arquivado = (
    id: string,
    nome: string,
    endereco: string | null,
  ): OpcaoDeCentro => ({
    id,
    missaoId: acao.missaoId,
    nome: `${nome} (inativo)`,
    principal: false,
    endereco,
  });

  return {
    centros: falta(acao.centroId)
      ? [...base, arquivado(acao.centroId, acao.centroNome, null)]
      : base,
    locais:
      acao.localCentroId && falta(acao.localCentroId)
        ? [
            ...base,
            arquivado(acao.localCentroId, acao.local ?? "", acao.endereco),
          ]
        : base,
  };
}
