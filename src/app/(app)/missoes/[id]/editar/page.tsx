import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/padroes/cabecalho-pagina";
import { FormularioMissao } from "@/features/missoes/components/formulario-missao";
import { obterMissao } from "@/features/missoes/queries";
import { redirect } from "next/navigation";

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

  // O auxiliar registra os dados da missão, mas não altera o cadastro dela.
  // O RLS recusaria a escrita de qualquer forma; parar aqui evita mostrar um
  // formulário que só falharia ao salvar.
  if (!usuario.podeEditarMissao) redirect(`/missoes/${id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Esta rota fica fora do grupo `(painel)`, então não herda o cabeçalho
          nem as abas da missão. A trilha é o que preserva o nome e o caminho
          de volta. */}
      <CabecalhoPagina
        trilha={[
          { rotulo: "Missões", href: "/missoes" },
          { rotulo: missao.nome, href: `/missoes/${missao.id}`, dinamico: true },
          { rotulo: "Editar missão", href: `/missoes/${missao.id}/editar` },
        ]}
        titulo="Editar missão"
        descricao={missao.nome}
      />
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
          contatoTelefone: missao.contatoTelefone ?? "",
          membrosTotal: missao.membrosTotal,
          observacoes: missao.observacoes ?? "",
          ativo: missao.ativo,
        }}
      />
    </div>
  );
}
