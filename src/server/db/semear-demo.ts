import { config } from "dotenv";

config({ path: ".env.local" });

import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { configuracaoDeConexao, DEFINIR_SEARCH_PATH } from "./conexao";

/**
 * Popula um banco de demonstração com dados fictícios.
 *
 *   pnpm demo:semear
 *
 * Serve para ver o painel, os gráficos e o calendário com volume realista —
 * doze meses de competências, dezenas de ações apostólicas, lançamentos
 * financeiros. Nada aqui é dado real.
 */

/* ═══════════════════════════ Trava de segurança ═══════════════════════════ */

function exigirBancoLocal(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL_ADMIN ausente.");

  const { hostname } = new URL(url);
  const local = hostname === "localhost" || hostname === "127.0.0.1";

  if (!local) {
    console.error(
      `\n✗ Recusando rodar contra "${hostname}".\n\n` +
        "  Este script apaga tudo antes de semear. Ele só roda em banco local,\n" +
        "  para que um esquecimento de variável de ambiente não destrua dados\n" +
        "  de produção.\n\n" +
        "  Use:  pnpm demo:subir\n",
    );
    process.exit(1);
  }
}

/* ═══════════════════════════════ Sorteio ══════════════════════════════════ */

/** Gerador com semente fixa: a mesma demonstração toda vez que rodar. */
let semente = 20260905;
function aleatorio() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
}
const inteiro = (min: number, max: number) =>
  Math.floor(aleatorio() * (max - min + 1)) + min;
const escolher = <T>(lista: readonly T[]) => lista[inteiro(0, lista.length - 1)];

/* ═══════════════════════════════ Dados ════════════════════════════════════ */

const MISSOES = [
  { nome: "Missão Nossa Senhora Aparecida", regiao: "Itaquera", cidade: "São Paulo", membros: 320 },
  { nome: "Missão São José Operário", regiao: "Santana", cidade: "São Paulo", membros: 245 },
  { nome: "Missão Sagrado Coração de Jesus", regiao: "Santo Amaro", cidade: "São Paulo", membros: 410 },
  { nome: "Missão Santa Rita de Cássia", regiao: "Centro", cidade: "Guarulhos", membros: 178 },
  { nome: "Missão São Francisco de Assis", regiao: "Butantã", cidade: "São Paulo", membros: 96 },
];

const NOMES = [
  "Ana Paula Ribeiro", "Carlos Eduardo Nunes", "Mariana Alves Costa",
  "João Pedro Martins", "Fernanda Souza Lima", "Rafael Oliveira Dias",
  "Juliana Ferreira", "Marcos Antônio Silva", "Beatriz Carvalho",
  "Tiago Mendes Rocha", "Patrícia Gomes", "Eduardo Barbosa",
  "Luciana Teixeira", "Roberto Cardoso", "Camila Fernandes",
  "Zé Ramalho Pinto", "Ana Lúcia Moreira", "Paulo Sérgio Ramos",
  "Vanessa Duarte", "Gabriel Antunes",
];

const GRUPOS = [
  "Grupo Sagrado Coração", "Grupo Nossa Senhora do Rosário", "Grupo São Judas Tadeu",
  "Grupo Divino Espírito Santo", "Grupo Santa Teresinha", "Grupo São Vicente",
  "Grupo Mãe Rainha", "Grupo Bom Pastor", "Grupo Nossa Senhora de Fátima",
  "Grupo Santo Antônio",
];

const LOCAIS = [
  "Salão paroquial", "Casa da família Silva", "Centro comunitário",
  "Quadra da comunidade", "Capela São Pedro", "Sede da missão",
];

/* Nomes de bairro: é assim que as missões chamam suas frentes — pelo lugar
   onde estão, não por um santo, que já é o nome dos grupos de oração. */
const CENTROS = [
  "Santo Amaro", "Guaianases", "Jardim Ângela", "Cidade Tiradentes",
  "Brasilândia", "Capão Redondo", "Itaim Paulista", "Grajaú",
];

const TITULOS = [
  "Retiro de Carnaval", "Cerco de Jericó", "Missão de Rua no centro",
  "Encontro de Casais", "Vigília de Pentecostes", "Formação de líderes",
  "Ação social no bairro", "Noite de Louvor", "Encontro de Jovens",
  "Festa da Padroeira", "Café com a comunidade", "Mutirão de Natal",
  "Retiro de Quaresma", "Escola de Evangelização", "Visita aos enfermos",
];

const RECEITAS = [
  "Doações da comunidade", "Inscrições dos participantes",
  "Venda de camisetas", "Rifa beneficente", "Parceria com comércio local",
];
const DESPESAS = [
  "Alimentação", "Aluguel do espaço", "Transporte da equipe",
  "Material gráfico", "Som e iluminação", "Decoração", "Combustível",
];

const LINKS = [
  { titulo: "Formulário de inscrição", url: "https://forms.gle/exemplo-inscricao" },
  { titulo: "Álbum de fotos", url: "https://photos.app.goo.gl/exemplo" },
  { titulo: "Transmissão ao vivo", url: "https://youtube.com/live/exemplo" },
  { titulo: "Material de divulgação", url: "https://drive.google.com/exemplo" },
];

/* ══════════════════════════════ Semeadura ═════════════════════════════════ */

async function principal() {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  exigirBancoLocal(url);

  const pool = new Pool({ ...configuracaoDeConexao(url), max: 1 });
  const c = await pool.connect();

  try {
    await c.query("begin");
    await c.query(DEFINIR_SEARCH_PATH);
    await c.query("select set_config('app.papel', 'admin', true)");

    // Limpa antes: a demonstração precisa ser reproduzível, não acumulativa.
    for (const t of [
      "evento_links", "evento_documentos", "evento_lancamentos", "eventos",
      "grupo_responsaveis", "grupos_oracao", "centros_evangelizacao",
      "missao_indicadores", "usuarios", "missoes",
    ]) {
      await c.query(`delete from ie.${t}`);
    }

    const { rows: tipos } = await c.query<{ id: string; nome: string }>(
      "select id, nome from tipos_evento where ativo order by ordem",
    );
    const { rows: categorias } = await c.query<{ id: string; nome: string; tipo: string }>(
      "select id, nome, tipo from categorias_financeiras where ativo",
    );

    if (tipos.length === 0) {
      throw new Error("Rode `pnpm db:seed` antes: não há tipos de evento.");
    }

    const catReceita = categorias.filter((x) => x.tipo !== "despesa");
    const catDespesa = categorias.filter((x) => x.tipo !== "receita");

    // ─── Administrador master ─────────────────────────────────────────────
    const uidAdmin = process.env.DEMO_ADMIN_UID ?? `demo-admin-${randomUUID()}`;
    await c.query(
      `insert into usuarios (firebase_uid, nome, email, papel, missao_id)
       values ($1, $2, $3, 'admin', null)`,
      [uidAdmin, process.env.DEMO_ADMIN_NOME ?? "Administrador Demo",
       process.env.DEMO_ADMIN_EMAIL ?? "admin@demo.local"],
    );

    let nomeAtual = 0;
    const proximoNome = () => NOMES[nomeAtual++ % NOMES.length];

    const hoje = new Date();
    const totais = { centros: 0, grupos: 0, pastores: 0, competencias: 0, eventos: 0, lancamentos: 0, links: 0, usuarios: 1 };

    for (const [indice, missao] of MISSOES.entries()) {
      const slug = missao.nome.toLowerCase().normalize("NFD")
        .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { rows: [criada] } = await c.query<{ id: string }>(
        `insert into missoes (nome, slug, cidade, regiao, endereco, data_fundacao,
                              contato_telefone, membros_total, observacoes, ativo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning id`,
        [missao.nome, slug, missao.cidade, missao.regiao,
         `Rua das Palmeiras, ${inteiro(50, 900)}`,
         `${inteiro(1998, 2018)}-0${inteiro(1, 9)}-1${inteiro(0, 9)}`,
         `(11) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`,
         // A última missão fica sem total informado, para mostrar a estimativa
         // pelos grupos de oração funcionando na tela.
         indice === MISSOES.length - 1 ? 0 : missao.membros,
         indice === 0 ? "Missão com forte atuação social no entorno." : null],
      );

      // ─── Equipe ─────────────────────────────────────────────────────────
      await c.query(
        `insert into usuarios (firebase_uid, nome, email, papel, missao_id, ultimo_acesso_em)
         values ($1,$2,$3,'responsavel',$4, now() - ($5 || ' hours')::interval)`,
        [`demo-resp-${indice}`, proximoNome(), `responsavel${indice}@demo.local`,
         criada.id, inteiro(1, 72)],
      );
      totais.usuarios++;

      for (let a = 0; a < inteiro(1, 2); a++) {
        await c.query(
          `insert into usuarios (firebase_uid, nome, email, papel, missao_id, ultimo_acesso_em)
           values ($1,$2,$3,'auxiliar',$4, now() - ($5 || ' days')::interval)`,
          [`demo-aux-${indice}-${a}`, proximoNome(),
           `auxiliar${indice}${a}@demo.local`, criada.id, inteiro(0, 20)],
        );
        totais.usuarios++;
      }

      // ─── Centros de evangelização ───────────────────────────────────────
      // O principal nasce com a missão, como faz `criarMissao`: é ele que
      // recebe tudo que não foi separado em outra frente.
      const { rows: [principal] } = await c.query<{ id: string }>(
        `insert into centros_evangelizacao (missao_id, nome, tipo, principal, ativo)
         values ($1, $2, 'centro_evangelizacao', true, true) returning id`,
        [criada.id, missao.nome],
      );
      totais.centros++;

      // A primeira missão fica só com o principal, de propósito: é o estado de
      // quem ainda não abriu outras frentes, e a tela precisa ficar boa nele.
      const centros: string[] = [];
      if (indice > 0) {
        for (let ce = 0; ce < inteiro(1, 3); ce++) {
          const { rows: [centro] } = await c.query<{ id: string }>(
            `insert into centros_evangelizacao (missao_id, nome, tipo, cidade,
                                                regiao, contato_telefone, ativo)
             values ($1,$2,$3,$4,$5,$6,true) returning id`,
            [criada.id, `${escolher(CENTROS)} ${ce + 1}`,
             // Uma irradiação a cada dois centros: a mistura é o normal em
             // campo, e é o que exercita os dois selos na tela.
             ce % 2 === 1 ? "irradiacao" : "centro_evangelizacao",
             missao.cidade, missao.regiao,
             `(11) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`],
          );
          centros.push(centro.id);
          totais.centros++;
        }
      }

      /** Parte dos grupos e ações vai para uma frente própria; o resto fica no
       *  principal, que é onde eles estariam sem essa separação. */
      const centroSorteado = () =>
        centros.length > 0 && Math.random() < 0.6
          ? escolher(centros)
          : principal.id;

      // ─── Grupos de oração ───────────────────────────────────────────────
      const quantosGrupos = inteiro(3, 5);
      let pessoasEmGrupos = 0;

      for (let g = 0; g < quantosGrupos; g++) {
        const pessoas = inteiro(8, 32);
        pessoasEmGrupos += pessoas;

        const { rows: [grupo] } = await c.query<{ id: string }>(
          `insert into grupos_oracao (missao_id, centro_id, nome, quantidade_pessoas,
                                      dia_semana, horario, local, ativo)
           values ($1,$2,$3,$4,$5,$6,$7,true) returning id`,
          [criada.id, centroSorteado(), `${escolher(GRUPOS)} ${g + 1}`, pessoas,
           inteiro(0, 6),
           `${String(inteiro(15, 20)).padStart(2, "0")}:${escolher(["00", "30"])}`,
           escolher(LOCAIS)],
        );
        totais.grupos++;

        for (let pastor = 1; pastor <= inteiro(1, 3); pastor++) {
          await c.query(
            `insert into grupo_responsaveis (grupo_id, nome, telefone, ordem)
             values ($1,$2,$3,$4)`,
            [grupo.id, proximoNome(),
             pastor === 1 ? `(11) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}` : null,
             pastor],
          );
          totais.pastores++;
        }
      }

      // ─── Competências: doze meses, com crescimento e oscilação ──────────
      const base = missao.membros || pessoasEmGrupos;
      for (let m = 11; m >= 0; m--) {
        const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
        // Crescimento suave para trás, com ruído: linha realista, não uma reta.
        const fator = 1 - m * inteiro(12, 28) / 1000;
        await c.query(
          `insert into missao_indicadores (missao_id, competencia, membros_total,
                                           grupos_total, pessoas_grupos_total, observacao)
           values ($1,$2,$3,$4,$5,$6)`,
          [criada.id,
           `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}-01`,
           Math.max(10, Math.round(base * fator) + inteiro(-8, 8)),
           Math.max(1, quantosGrupos - Math.floor(m / 5)),
           Math.max(5, Math.round(pessoasEmGrupos * fator)),
           m === 3 ? "Mês do retiro; muitos visitantes novos." : null],
        );
        totais.competencias++;
      }

      // ─── Ações apostólicas ──────────────────────────────────────────────
      for (let e = 0; e < inteiro(6, 11); e++) {
        // Distribuídas entre 13 meses atrás e 2 meses à frente.
        const deslocamento = inteiro(-390, 60);
        const inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() + deslocamento);
        inicio.setHours(inteiro(8, 19), escolher([0, 30]), 0, 0);

        const duracaoHoras = escolher([2, 3, 4, 8, 26, 50]);
        const fim = new Date(inicio.getTime() + duracaoHoras * 3600_000);

        const futuro = inicio > hoje;
        const status = futuro
          ? escolher(["planejado", "planejado", "planejado", "cancelado"])
          : escolher(["realizado", "realizado", "realizado", "cancelado"]);

        const participantes = status === "cancelado" || futuro ? 0 : inteiro(25, 480);
        const servos = participantes === 0 ? 0 : Math.max(4, Math.round(participantes / inteiro(6, 14)));

        const { rows: [evento] } = await c.query<{ id: string }>(
          `insert into eventos (missao_id, centro_id, tipo_evento_id, titulo, descricao,
                                data_inicio, data_fim, local, endereco,
                                participantes_total, servos_engajados, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
          [criada.id, centroSorteado(), escolher(tipos).id,
           `${escolher(TITULOS)} ${inicio.getFullYear()}`,
           aleatorio() > 0.5 ? "Ação voltada à evangelização e ao acolhimento da comunidade." : null,
           inicio.toISOString(), fim.toISOString(), escolher(LOCAIS),
           aleatorio() > 0.6 ? `Av. Central, ${inteiro(100, 2000)}` : null,
           participantes, servos, status],
        );
        totais.eventos++;

        // Financeiro só para o que já aconteceu.
        if (status === "realizado") {
          for (let l = 0; l < inteiro(2, 4); l++) {
            const cat = escolher(catReceita);
            await c.query(
              `insert into evento_lancamentos (evento_id, tipo, categoria_id, descricao, valor, data)
               values ($1,'receita',$2,$3,$4,$5)`,
              [evento.id, cat?.id ?? null, escolher(RECEITAS),
               (inteiro(15000, 380000) / 100).toFixed(2),
               inicio.toISOString().slice(0, 10)],
            );
            totais.lancamentos++;
          }
          for (let l = 0; l < inteiro(2, 5); l++) {
            const cat = escolher(catDespesa);
            await c.query(
              `insert into evento_lancamentos (evento_id, tipo, categoria_id, descricao, valor, data)
               values ($1,'despesa',$2,$3,$4,$5)`,
              [evento.id, cat?.id ?? null, escolher(DESPESAS),
               (inteiro(8000, 210000) / 100).toFixed(2),
               inicio.toISOString().slice(0, 10)],
            );
            totais.lancamentos++;
          }
        }

        if (aleatorio() > 0.55) {
          const link = escolher(LINKS);
          await c.query(
            `insert into evento_links (evento_id, titulo, url, ordem) values ($1,$2,$3,0)`,
            [evento.id, link.titulo, link.url],
          );
          totais.links++;
        }
      }
    }

    await c.query("commit");

    console.log("\n✓ Dados fictícios criados:\n");
    console.log(`  ${MISSOES.length} missões`);
    console.log(`  ${totais.usuarios} usuários (1 admin, ${MISSOES.length} responsáveis, ${totais.usuarios - MISSOES.length - 1} auxiliares)`);
    console.log(`  ${totais.centros} centros de evangelização e irradiações`);
    console.log(`  ${totais.grupos} grupos de oração com ${totais.pastores} pastores`);
    console.log(`  ${totais.competencias} competências registradas (12 meses por missão)`);
    console.log(`  ${totais.eventos} ações apostólicas`);
    console.log(`  ${totais.lancamentos} lançamentos financeiros`);
    console.log(`  ${totais.links} links úteis\n`);
  } catch (erro) {
    await c.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    c.release();
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error("✗ Falha ao semear:", erro?.message ?? erro);
  process.exit(1);
});
