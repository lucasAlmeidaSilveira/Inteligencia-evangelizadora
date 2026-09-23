/**
 * O que o navegador abre sozinho, sem baixar.
 *
 * Fica em `lib` e não junto do R2 porque os botões da lista precisam decidir
 * no cliente se mostram "Visualizar" — e `server/armazenamento/r2.ts` é
 * `server-only`, importá-lo de um componente quebraria o build.
 */
const TIPOS_VISUALIZAVEIS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/**
 * Oferecer "visualizar" num .docx ou .xlsx seria um botão que engana: o
 * navegador não renderiza esses formatos e responderia com um download, só que
 * depois do clique errado. Word, Excel e CSV ficam só com baixar.
 */
export function tipoPodeSerVisto(tipo: string) {
  return (TIPOS_VISUALIZAVEIS as readonly string[]).includes(tipo);
}
