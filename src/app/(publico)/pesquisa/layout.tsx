import { Marca } from "@/components/marca";

/**
 * Moldura da única área pública do sistema: a pesquisa de satisfação.
 *
 * Aninhado sob o layout raiz — que já traz fontes, tema e o Toaster — e fora
 * do grupo `(app)`, que exige sessão. Não é um segundo layout raiz: dois
 * `<html>` fariam o Next tratar o site como duas aplicações, com recarga
 * completa entre elas. Sem barra lateral, sem menu, sem link para dentro do
 * sistema: quem está aqui é participante, não coordenador, e nada nesta tela
 * pode levar para onde o login é exigido.
 */
export default function LayoutPesquisa({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4 sm:p-8">
      <div className="vidro w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <Marca className="text-primary" />
        </div>
        {children}
      </div>
    </main>
  );
}
