import { contarRespostas, FAIXAS_DE_NOTA, percentual } from "../satisfacao";

/**
 * Quantas respostas em cada nota, de 0 a 10.
 *
 * Uma cor só nas barras: a leitura por faixas (0–6, 7–8, 9–10) vem escrita
 * embaixo, porque cor nunca é o único diferenciador. A tabela em `<details>`
 * é a alternativa que `docs/identidade-visual.md` exige de todo gráfico, e
 * nativa: funciona sem JavaScript e com teclado.
 */
export function DistribuicaoNotas({
  distribuicao,
  total,
}: {
  distribuicao: number[];
  total: number;
}) {
  const maior = Math.max(1, ...distribuicao);
  const faixas = FAIXAS_DE_NOTA.map((f) => ({
    rotulo: f.rotulo,
    quantidade: distribuicao
      .slice(f.de, f.ate + 1)
      .reduce((s, n) => s + n, 0),
  }));

  return (
    <div className="space-y-3">
      <ul className="grid h-24 grid-cols-11 items-end gap-1" aria-label="Respostas por nota">
        {distribuicao.map((quantidade, nota) => {
          const pct = percentual(quantidade, total);
          return (
            <li key={nota} className="flex h-full flex-col justify-end gap-1">
              <div
                role="img"
                aria-label={`Nota ${nota}: ${contarRespostas(quantidade)}${
                  pct === null ? "" : ` (${Math.round(pct)}%)`
                }`}
                className="bg-muted flex h-full items-end overflow-hidden rounded-sm"
              >
                <div
                  className="bg-primary w-full rounded-sm"
                  style={{ height: `${(quantidade / maior) * 100}%` }}
                />
              </div>
              <span className="text-muted-foreground text-center text-[11px] tabular-nums">
                {nota}
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {faixas.map((f) => (
          <div key={f.rotulo} className="flex gap-1">
            <dt>{f.rotulo}:</dt>
            <dd className="text-foreground tabular font-medium">
              {f.quantidade}
            </dd>
          </div>
        ))}
      </dl>

      <details className="text-sm">
        <summary className="text-primary cursor-pointer rounded-sm font-medium underline-offset-4 hover:underline">
          Ver como tabela
        </summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-1 font-medium">Nota</th>
              <th className="py-1 text-right font-medium">Respostas</th>
              <th className="py-1 text-right font-medium">Percentual</th>
            </tr>
          </thead>
          <tbody>
            {distribuicao.map((quantidade, nota) => {
              const pct = percentual(quantidade, total);
              return (
                <tr key={nota} className="border-t">
                  <td className="py-1">{nota}</td>
                  <td data-numeric className="py-1 text-right">
                    {quantidade}
                  </td>
                  <td data-numeric className="py-1 text-right">
                    {pct === null ? "—" : `${Math.round(pct)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
