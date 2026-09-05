import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { FormularioMissao } from "@/features/missoes/components/formulario-missao";
import { obterMissao } from "@/features/missoes/queries";
import { requerUsuario } from "@/server/auth/sessao";

export const metadata = { title: "Editar missão" };

export default async function PaginaEditarMissao({
  params,
}: PageProps<"/missoes/[id]/editar">) {
  const { id } = await params;
  const [usuario, missao] = await Promise.all([
    requerUsuario(),
    obterMissao(id),
  ]);

  if (!missao) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina titulo="Editar missão" descricao={missao.nome} />
      <FormularioMissao
        missaoId={missao.id}
        podeArquivar={usuario.ehAdmin}
        // Os campos de texto vazios voltam como null do banco; o formulário
        // precisa de "" para manter os inputs controlados.
        valores={{
          nome: missao.nome,
          cidade: missao.cidade,
          regiao: missao.regiao ?? "",
          endereco: missao.endereco ?? "",
          dataFundacao: missao.dataFundacao ?? "",
          responsavelNome: missao.responsavelNome ?? "",
          contatoTelefone: missao.contatoTelefone ?? "",
          contatoEmail: missao.contatoEmail ?? "",
          membrosTotal: missao.membrosTotal,
          observacoes: missao.observacoes ?? "",
          ativo: missao.ativo,
        }}
      />
    </div>
  );
}
