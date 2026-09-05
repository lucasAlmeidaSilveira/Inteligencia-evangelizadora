import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { FormularioMissao } from "@/features/missoes/components/formulario-missao";
import { requerAdmin } from "@/server/auth/sessao";

export const metadata = { title: "Nova missão" };

export default async function PaginaNovaMissao() {
  await requerAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina
        titulo="Nova missão"
        descricao="Os grupos de oração e as ações apostólicas são cadastrados depois, dentro da missão."
      />
      <FormularioMissao />
    </div>
  );
}
