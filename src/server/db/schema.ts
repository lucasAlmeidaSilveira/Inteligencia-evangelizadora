import { relations, sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema dedicado dentro da instância compartilhada com o Glyvo.
 * Isola as tabelas deste sistema sem exigir um banco novo.
 */
export const ie = pgSchema("ie");

/**
 * Três níveis, do mais amplo ao mais restrito:
 *
 * - `admin`        — administrador master. Cria missões, configura o sistema e
 *                    enxerga tudo. Não pertence a missão alguma.
 * - `responsavel`  — um por missão. Edita os dados da missão e convida os
 *                    auxiliares dela.
 * - `auxiliar`     — registra grupos, ações, financeiro e indicadores da sua
 *                    missão. Não edita a missão nem convida ninguém.
 */
export const papelEnum = ie.enum("papel", [
  "admin",
  "responsavel",
  "auxiliar",
]);

/**
 * Duas formas da mesma coisa: uma frente de evangelização dentro da missão.
 *
 * A irradiação nasce de um centro e ainda não se sustenta sozinha. Guardar a
 * distinção — em vez de chamar as duas de "centro" — é o que deixa o
 * coordenador ver quantas frentes já andam com as próprias pernas.
 */
export const tipoCentroEnum = ie.enum("tipo_centro", [
  "centro_evangelizacao",
  "irradiacao",
]);

export const statusEventoEnum = ie.enum("status_evento", [
  "planejado",
  "em_andamento",
  "realizado",
  "cancelado",
]);

export const tipoLancamentoEnum = ie.enum("tipo_lancamento", [
  "receita",
  "despesa",
]);

export const tipoCategoriaEnum = ie.enum("tipo_categoria", [
  "receita",
  "despesa",
  "ambos",
]);

const auditoria = {
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/* ══════════════════════════ Identidade e acesso ══════════════════════════ */

/**
 * Espelho local do usuário do Firebase Auth. O Firebase guarda credenciais;
 * aqui ficam papel e vínculo com missões — que é o que o RLS precisa
 * consultar a cada requisição.
 */
export const usuarios = ie.table(
  "usuarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firebaseUid: text("firebase_uid").notNull().unique(),
    nome: text("nome").notNull(),
    email: text("email").notNull().unique(),
    // Sem valor padrão de propósito: permissão é decisão explícita de quem
    // convida, nunca algo que a pessoa herda por omissão.
    papel: papelEnum("papel").notNull(),
    /**
     * A missão a que a pessoa pertence. Nulo apenas para o admin, que não
     * pertence a nenhuma. `restrict` de propósito: apagar uma missão que ainda
     * tem gente vinculada apagaria acessos em silêncio — o admin precisa
     * resolver o que fazer com essas pessoas antes.
     */
    missaoId: uuid("missao_id").references(() => missoes.id, {
      onDelete: "restrict",
    }),
    ativo: boolean("ativo").notNull().default(true),
    ultimoAcessoEm: timestamp("ultimo_acesso_em", { withTimezone: true }),
    ...auditoria,
  },
  (t) => [
    index("idx_usuarios_papel").on(t.papel),
    index("idx_usuarios_missao").on(t.missaoId),
    // Admin não pertence a missão; todos os demais pertencem a exatamente uma.
    check(
      "papel_e_missao_coerentes",
      sql`(${t.papel} = 'admin' and ${t.missaoId} is null) or (${t.papel} <> 'admin' and ${t.missaoId} is not null)`,
    ),
    // No máximo um responsável por missão — imposto pelo banco, não por
    // convenção: dois responsáveis significaria duas pessoas convidando gente
    // sem que nenhuma respondesse pela outra.
    uniqueIndex("uq_responsavel_por_missao")
      .on(t.missaoId)
      .where(sql`${t.papel} = 'responsavel'`),
  ],
);

/* ═════════════════════════════════ Missões ════════════════════════════════ */

export const missoes = ie.table(
  "missoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: text("nome").notNull(),
    slug: text("slug").notNull().unique(),
    cidade: text("cidade").notNull().default("São Paulo"),
    regiao: text("regiao"),
    endereco: text("endereco"),
    dataFundacao: date("data_fundacao"),
    /* Quem responde pela missão não é mais um texto livre: é a conta com papel
       `responsavel` vinculada a ela. Nome e e-mail vêm de lá — uma fonte só,
       que não fica desatualizada quando o responsável muda. */
    contatoTelefone: text("contato_telefone"),
    /** Valor corrente. O histórico vive em `missaoIndicadores` e é opcional. */
    membrosTotal: integer("membros_total").notNull().default(0),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoria,
  },
  (t) => [
    check("membros_total_nao_negativo", sql`${t.membrosTotal} >= 0`),
    index("idx_missoes_ativo").on(t.ativo),
  ],
);

/**
 * Fotografia opcional dos indicadores num mês. Se o usuário nunca registrar,
 * o sistema funciona igual — apenas não há linha de tendência no gráfico.
 */
export const missaoIndicadores = ie.table(
  "missao_indicadores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missaoId: uuid("missao_id")
      .notNull()
      .references(() => missoes.id, { onDelete: "cascade" }),
    /** Sempre o dia 1 do mês de referência — garantido por CHECK. */
    competencia: date("competencia").notNull(),
    membrosTotal: integer("membros_total").notNull(),
    gruposTotal: integer("grupos_total").notNull(),
    pessoasGruposTotal: integer("pessoas_grupos_total").notNull(),
    observacao: text("observacao"),
    registradoPor: uuid("registrado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    ...auditoria,
  },
  (t) => [
    uniqueIndex("uq_indicador_missao_competencia").on(t.missaoId, t.competencia),
    check("competencia_no_dia_um", sql`date_part('day', ${t.competencia}) = 1`),
    check("indicadores_nao_negativos", sql`${t.membrosTotal} >= 0 and ${t.gruposTotal} >= 0 and ${t.pessoasGruposTotal} >= 0`),
  ],
);

/* ═══════════════════ Centros de evangelização e irradiações ═══════════════ */

/**
 * Uma frente de evangelização dentro da missão — uma "missão pequena", com os
 * próprios grupos de oração e as próprias ações apostólicas.
 *
 * O vínculo dos grupos e das ações com o centro é opcional: antes desta tabela
 * tudo pendia direto da missão, e continuar aceitando esse estado evita
 * inventar um centro "Sede" para dado antigo que ninguém decidiu criar.
 */
export const centrosEvangelizacao = ie.table(
  "centros_evangelizacao",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missaoId: uuid("missao_id")
      .notNull()
      .references(() => missoes.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    tipo: tipoCentroEnum("tipo").notNull().default("centro_evangelizacao"),
    /**
     * O centro principal da missão — o que nasce junto com ela e recebe tudo
     * que não foi separado em outra frente.
     *
     * Existe para que `grupos_oracao.centro_id` e `eventos.centro_id` possam
     * ser `not null`: sempre há um centro para onde apontar, sem inventar um
     * estado "sem centro" que ninguém sabe interpretar.
     */
    principal: boolean("principal").notNull().default(false),
    /** Sem o default "São Paulo" que `missoes` tem: em branco aqui significa
     *  "a mesma da missão", e um default esconderia essa diferença. */
    cidade: text("cidade"),
    regiao: text("regiao"),
    endereco: text("endereco"),
    dataFundacao: date("data_fundacao"),
    contatoTelefone: text("contato_telefone"),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoria,
  },
  (t) => [
    index("idx_centros_missao").on(t.missaoId),
    // Dois centros de mesmo nome na mesma missão transformam o select de
    // grupos e ações em adivinhação. `lower()` porque "Santo Amaro" e
    // "santo amaro" são o mesmo lugar para quem digita.
    uniqueIndex("uq_centro_nome_por_missao").on(
      t.missaoId,
      sql`lower(${t.nome})`,
    ),
    // Exatamente um principal por missão — índice único parcial, como o de
    // responsável. Dois principais significaria dois destinos padrão para o
    // que não foi separado, e nenhuma regra para escolher entre eles.
    uniqueIndex("uq_centro_principal_por_missao")
      .on(t.missaoId)
      .where(sql`${t.principal}`),
    /*
     * Alvo do FK composto de `grupos_oracao` e `eventos`. Redundante como
     * unicidade — a chave primária já garante —, mas o Postgres exige
     * unicidade declarada sobre exatamente o par referenciado.
     *
     * `unique()` e não `uniqueIndex()`: a constraint nasce dentro do CREATE
     * TABLE, enquanto o índice viria num CREATE INDEX que o drizzle-kit emite
     * depois dos ALTER TABLE ADD FOREIGN KEY — e a migration falharia com
     * "there is no unique constraint matching given keys".
     */
    unique("uq_centro_id_missao").on(t.id, t.missaoId),
  ],
);

/* ═══════════════════════════ Grupos de oração ═════════════════════════════ */

export const gruposOracao = ie.table(
  "grupos_oracao",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missaoId: uuid("missao_id")
      .notNull()
      .references(() => missoes.id, { onDelete: "cascade" }),
    /** Todo grupo pertence a um centro. Sem escolha explícita, ao principal —
     *  que é justamente o centro criado junto com a missão para receber o que
     *  não foi separado em outra frente. */
    centroId: uuid("centro_id").notNull(),
    nome: text("nome").notNull(),
    /**
     * A contagem do grupo, em três números que as missões já acompanhavam em
     * planilha: quem frequenta sempre, quem aparece às vezes e quem deixou de
     * vir. Os três são obrigatórios — zero é resposta, em branco não é.
     *
     * Toda alteração desses números também vira uma linha em
     * `grupo_contagens`: é o histórico que diz quando a contagem foi feita, e
     * é dele que o lembrete bimestral decide quem já passou do prazo.
     */
    membrosEfetivos: integer("membros_efetivos").notNull().default(0),
    membrosFlutuantes: integer("membros_flutuantes").notNull().default(0),
    membrosEvadidos: integer("membros_evadidos").notNull().default(0),
    /**
     * Quantas pessoas o grupo reúne: efetivos mais flutuantes. Coluna gerada
     * pelo banco, não gravada pela aplicação — assim os indicadores, o painel
     * e os relatórios continuam somando `quantidade_pessoas` sem saber da
     * divisão em três, e não há como os dois valores divergirem. Evadidos
     * ficam de fora: quem saiu não está no grupo.
     */
    quantidadePessoas: integer("quantidade_pessoas")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`${gruposOracao.membrosEfetivos} + ${gruposOracao.membrosFlutuantes}`,
      ),
    /** 0 = domingo … 6 = sábado. */
    diaSemana: integer("dia_semana"),
    horario: time("horario"),
    local: text("local"),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoria,
  },
  (t) => [
    check(
      "membros_nao_negativos",
      sql`${t.membrosEfetivos} >= 0 and ${t.membrosFlutuantes} >= 0 and ${t.membrosEvadidos} >= 0`,
    ),
    check("dia_semana_valido", sql`${t.diaSemana} is null or ${t.diaSemana} between 0 and 6`),
    index("idx_grupos_missao").on(t.missaoId),
    index("idx_grupos_centro").on(t.centroId),
    /*
     * Pelo par (centro, missão), não só pelo centro.
     *
     * Um FK simples deixaria um grupo da Zona Leste apontar para um centro da
     * Zona Sul — dado de outra missão entrando por uma porta que o RLS não
     * vigia, e sem erro nenhum. Com as duas colunas `not null`, a checagem
     * vale sempre.
     *
     * `no action` e não `restrict`, e a diferença importa: o `no action` é
     * conferido no fim do comando, então apagar a missão funciona mesmo com o
     * cascade removendo centros e grupos na mesma instrução. `restrict`
     * dispararia na hora e recusaria.
     *
     * Apagar um centro, esse sim, obriga `excluirCentro` a remanejar os
     * vínculos à vista — com o usuário sabendo quantos registros mudam.
     */
    foreignKey({
      columns: [t.centroId, t.missaoId],
      foreignColumns: [centrosEvangelizacao.id, centrosEvangelizacao.missaoId],
      name: "fk_grupos_centro_da_missao",
    }),
  ],
);

/**
 * De 1 a 3 pastores por grupo — "pastor" é o termo usado pelas missões para
 * quem responde por um grupo de oração.
 *
 * O limite não precisa de trigger: `ordem` restrita a 1..3 mais unicidade por
 * grupo já torna o quarto pastor impossível de inserir — e sem a condição de
 * corrida que existe ao validar contando linhas.
 */
export const grupoPastores = ie.table(
  // Nome físico preservado de quando o domínio dizia "responsável". Renomear
  // a tabela exigiria uma migração destrutiva sem ganho algum: o código, a
  // interface e as consultas já falam "pastor", que é o termo das missões.
  "grupo_responsaveis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposOracao.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    telefone: text("telefone"),
    ordem: integer("ordem").notNull().default(1),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("ordem_entre_um_e_tres", sql`${t.ordem} between 1 and 3`),
    uniqueIndex("uq_grupo_responsavel_ordem").on(t.grupoId, t.ordem),
  ],
);

/**
 * Histórico das contagens de um grupo: uma linha por vez que alguém informou
 * (ou confirmou) os três números.
 *
 * Substitui a planilha bimestral. A linha mais recente é, por definição, a
 * contagem corrente — e a data dela é o que diz se o grupo está em dia ou se
 * o lembrete precisa sair. Não há coluna "última contagem em" no grupo: seria
 * um estado a mais para divergir deste histórico.
 *
 * Linhas nunca são editadas nem apagadas pela aplicação; só caem em cascata
 * com o grupo.
 */
export const grupoContagens = ie.table(
  "grupo_contagens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposOracao.id, { onDelete: "cascade" }),
    membrosEfetivos: integer("membros_efetivos").notNull(),
    membrosFlutuantes: integer("membros_flutuantes").notNull(),
    membrosEvadidos: integer("membros_evadidos").notNull(),
    registradoPor: uuid("registrado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    registradoEm: timestamp("registrado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "contagem_nao_negativa",
      sql`${t.membrosEfetivos} >= 0 and ${t.membrosFlutuantes} >= 0 and ${t.membrosEvadidos} >= 0`,
    ),
    // A pergunta de sempre é "qual a última contagem deste grupo?".
    index("idx_contagens_grupo_data").on(t.grupoId, t.registradoEm),
  ],
);

/**
 * Por onde o lembrete saiu. `interno` é a notificação dentro do sistema;
 * `email` é a mensagem enviada ao endereço da pessoa.
 */
export const canalLembreteEnum = ie.enum("canal_lembrete", ["interno", "email"]);

/**
 * Registro de cada lembrete de contagem enviado.
 *
 * É o que impede a rotina diária de repetir o aviso: um grupo vencido só
 * recebe lembrete novo quando o anterior já tem dois meses. Sem este registro,
 * o agendador teria que rodar exatamente de dois em dois meses — e qualquer
 * falha ou atraso dele perderia ou duplicaria avisos.
 */
export const lembretesContagem = ie.table(
  "lembretes_contagem",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposOracao.id, { onDelete: "cascade" }),
    /** Quem recebeu. Nulo se a pessoa saiu da equipe depois. */
    usuarioId: uuid("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    canal: canalLembreteEnum("canal").notNull(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_lembretes_grupo_data").on(t.grupoId, t.enviadoEm)],
);

/**
 * Notificação interna: o aviso que a pessoa vê no sino do cabeçalho.
 *
 * Pertence a um usuário, não a uma missão — a política de RLS é "cada um lê
 * e marca as suas". Quem escreve é a rotina de lembretes, com o escopo do
 * sistema. `url` é para onde o clique leva: a tela do grupo, já com o diálogo
 * de contagem aberto.
 */
export const notificacoes = ie.table(
  "notificacoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    mensagem: text("mensagem").notNull(),
    /** Caminho interno (`/missoes/...`), nunca endereço externo. */
    url: text("url"),
    lidaEm: timestamp("lida_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("url_interna", sql`${t.url} is null or ${t.url} ~ '^/'`),
    // O sino pergunta "quantas não lidas tenho?" a cada página.
    index("idx_notificacoes_usuario_nao_lidas")
      .on(t.usuarioId)
      .where(sql`${t.lidaEm} is null`),
    index("idx_notificacoes_usuario_data").on(t.usuarioId, t.criadoEm),
  ],
);

/* ═══════════════════════ Configuração (só admin) ══════════════════════════ */

export const tiposEvento = ie.table(
  "tipos_evento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: text("nome").notNull().unique(),
    /** Alimenta a cor do evento no calendário mensal. */
    cor: text("cor").notNull().default("#7C3AED"),
    descricao: text("descricao"),
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    /**
     * Ganha cartão próprio no painel, com o total de ações realizadas do tipo.
     *
     * SVES e retiros são os números que a missão acompanha de perto, e o tipo
     * é cadastro do admin — não dá para fixá-los no código sem quebrar na
     * primeira renomeação. Marcar a linha sobrevive a isso e serve tipos que
     * ainda não existem. `false` por padrão: nenhum tipo já cadastrado aparece
     * no painel sem alguém ter pedido.
     */
    destacarNoPainel: boolean("destacar_no_painel").notNull().default(false),
    ...auditoria,
  },
  (t) => [check("cor_hexadecimal", sql`${t.cor} ~* '^#[0-9a-f]{6}$'`)],
);

export const categoriasFinanceiras = ie.table(
  "categorias_financeiras",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: text("nome").notNull().unique(),
    tipo: tipoCategoriaEnum("tipo").notNull().default("ambos"),
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoria,
  },
);

/* ═══════════════════════ Ações apostólicas (eventos) ══════════════════════ */

export const eventos = ie.table(
  "eventos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missaoId: uuid("missao_id")
      .notNull()
      .references(() => missoes.id, { onDelete: "cascade" }),
    /** Toda ação pertence a um centro — ao principal, quando não se escolhe
     *  outro. Ver a nota em `gruposOracao.centroId`. */
    centroId: uuid("centro_id").notNull(),
    tipoEventoId: uuid("tipo_evento_id")
      .notNull()
      // `restrict`: apagar um tipo em uso apagaria silenciosamente o histórico.
      .references(() => tiposEvento.id, { onDelete: "restrict" }),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    observacoes: text("observacoes"),
    dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull(),
    dataFim: timestamp("data_fim", { withTimezone: true }).notNull(),
    local: text("local"),
    endereco: text("endereco"),
    /** Quem responde pela ação. Texto livre de propósito: quase sempre é um
     *  servo da equipe que não tem login no sistema, e exigir um usuário
     *  cadastrado deixaria o campo vazio na maioria das ações. */
    responsavelNome: text("responsavel_nome"),
    /**
     * Quantos compareceram. O nome ficou de quando havia um número só; hoje
     * lê-se "presentes", e é este o número que painel, relatórios e agregados
     * somam — o que interessa consolidar é presença, não inscrição.
     */
    participantesTotal: integer("participantes_total").notNull().default(0),
    /** Pode ser menor que `participantesTotal`: gente aparece sem se inscrever. */
    participantesInscritos: integer("participantes_inscritos")
      .notNull()
      .default(0),
    participantesNovos: integer("participantes_novos").notNull().default(0),
    /** Seguiram em grupo de oração depois da ação — o fruto que a missão mede. */
    participantesPermaneceram: integer("participantes_permaneceram")
      .notNull()
      .default(0),
    servosEngajados: integer("servos_engajados").notNull().default(0),
    /**
     * Satisfação dos participantes, nota de 0 a 10 (NPS). Nulo é "não houve
     * pesquisa", diferente de zero, que é a pior nota possível — sem essa
     * distinção toda ação antiga apareceria como detestada.
     *
     * `numeric(3,1)` e não `integer`: a nota que a missão tem em mãos é a média
     * das respostas, e "8,7" arredondado para 9 some com a diferença entre duas
     * ações que o índice de impacto existe para comparar.
     */
    nps: numeric("nps", { precision: 3, scale: 1 }),
    /** Nulo é "não orçado", diferente de zero, que é "orçado em nada". Sem essa
     *  distinção a tela mostraria R$ 0,00 previsto em toda ação antiga. */
    orcamentoPrevisto: numeric("orcamento_previsto", {
      precision: 12,
      scale: 2,
    }),
    status: statusEventoEnum("status").notNull().default("planejado"),
    /** Marcada pela missão para ser levada ao regional. */
    destaqueRegional: boolean("destaque_regional").notNull().default(false),
    criadoPor: uuid("criado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    ...auditoria,
  },
  (t) => [
    check("periodo_valido", sql`${t.dataFim} >= ${t.dataInicio}`),
    check("participantes_nao_negativo", sql`${t.participantesTotal} >= 0`),
    check("inscritos_nao_negativo", sql`${t.participantesInscritos} >= 0`),
    check("novos_nao_negativo", sql`${t.participantesNovos} >= 0`),
    check("permaneceram_nao_negativo", sql`${t.participantesPermaneceram} >= 0`),
    check("servos_nao_negativo", sql`${t.servosEngajados} >= 0`),
    check("orcamento_nao_negativo", sql`${t.orcamentoPrevisto} >= 0`),
    // A escala é do NPS, não nossa: fora de 0..10 a nota não significa nada.
    check("nps_entre_zero_e_dez", sql`${t.nps} between 0 and 10`),
    /* Não há CHECK relacionando `novos`/`permaneceram` a `participantesTotal`:
       essa regra vive no zod, onde o erro chega no campo certo e em português.
       Vindo do banco, um engano de digitação viraria erro de constraint. */
    index("idx_eventos_missao").on(t.missaoId),
    index("idx_eventos_centro").on(t.centroId),
    index("idx_eventos_tipo").on(t.tipoEventoId),
    // Consulta mais frequente do sistema: eventos de um mês no calendário.
    index("idx_eventos_periodo").on(t.dataInicio, t.dataFim),
    // Parcial: destaque é a minoria das ações, e o índice só precisa dessas.
    index("idx_eventos_destaque")
      .on(t.missaoId)
      .where(sql`${t.destaqueRegional}`),
    // Mesmo raciocínio do FK de `grupos_oracao`: o par impede que a ação de
    // uma missão aponte para o centro de outra.
    foreignKey({
      columns: [t.centroId, t.missaoId],
      foreignColumns: [centrosEvangelizacao.id, centrosEvangelizacao.missaoId],
      name: "fk_eventos_centro_da_missao",
    }),
  ],
);

/**
 * Financeiro linha a linha. Não existe coluna `saldo` em lugar nenhum:
 * saldo é sempre soma de receitas menos soma de despesas, calculado na
 * leitura. Coluna de saldo é estado que pode divergir dos lançamentos.
 */
export const eventoLancamentos = ie.table(
  "evento_lancamentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    tipo: tipoLancamentoEnum("tipo").notNull(),
    categoriaId: uuid("categoria_id").references(
      () => categoriasFinanceiras.id,
      { onDelete: "set null" },
    ),
    descricao: text("descricao").notNull(),
    /** `numeric` chega como string no driver — nunca converter para float,
     *  que introduz erro de arredondamento em dinheiro. */
    valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
    data: date("data").notNull(),
    criadoPor: uuid("criado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    ...auditoria,
  },
  (t) => [
    check("valor_positivo", sql`${t.valor} > 0`),
    index("idx_lancamentos_evento").on(t.eventoId),
  ],
);

export const eventoDocumentos = ie.table(
  "evento_documentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    /** Chave do objeto no R2: `{missaoId}/{eventoId}/{uuid}-{arquivo}`. */
    chaveArmazenamento: text("chave_armazenamento").notNull().unique(),
    tipoMime: text("tipo_mime").notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    enviadoPor: uuid("enviado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("tamanho_positivo", sql`${t.tamanhoBytes} > 0`),
    index("idx_documentos_evento").on(t.eventoId),
  ],
);

export const eventoLinks = ie.table(
  "evento_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    url: text("url").notNull(),
    descricao: text("descricao"),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("url_http", sql`${t.url} ~* '^https?://'`),
    index("idx_links_evento").on(t.eventoId),
  ],
);

/*
 * Pesquisa de satisfação pública de uma ação.
 *
 * Uma por ação (`evento_id` único): "gerar novo link" troca o token da mesma
 * linha em vez de criar outra, e assim as respostas já colhidas continuam
 * penduradas na pesquisa. O token é a única credencial do participante — quem
 * tem o link responde, sem login — e o papel `pesquisa` do RLS não enxerga
 * esta tabela: só duas funções SECURITY DEFINER (ver drizzle/politicas.sql)
 * leem o token do escopo e devolvem o estritamente necessário.
 */
export const eventoPesquisas = ie.table(
  "evento_pesquisas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: uuid("evento_id")
      .notNull()
      .unique()
      .references(() => eventos.id, { onDelete: "cascade" }),
    /** 43 caracteres base64url de `randomBytes(32)`: 256 bits, inenumerável. */
    token: text("token").notNull().unique(),
    aberta: boolean("aberta").notNull().default(true),
    /** Link esquecido não fica aberto para sempre: depois daqui a função de
     *  resposta recusa, mesmo com `aberta` ligado. */
    encerraEm: timestamp("encerra_em", { withTimezone: true }).notNull(),
    criadaPor: uuid("criada_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    ...auditoria,
  },
  (t) => [check("token_base64url", sql`${t.token} ~ '^[A-Za-z0-9_-]{43}$'`)],
);

/**
 * Cada resposta é anônima e só tem nota e comentário. Resposta duplicada da
 * mesma pessoa é aceita por decisão de produto; o que a função de inserção
 * limita é inundação, não repetição.
 */
export const eventoRespostas = ie.table(
  "evento_respostas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pesquisaId: uuid("pesquisa_id")
      .notNull()
      .references(() => eventoPesquisas.id, { onDelete: "cascade" }),
    /** Repetido de propósito: o agregado por ação e a policy de leitura
     *  filtram por aqui sem JOIN com a pesquisa. */
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    nota: smallint("nota").notNull(),
    comentario: text("comentario"),
    respondidaEm: timestamp("respondida_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("nota_entre_zero_e_dez", sql`${t.nota} between 0 and 10`),
    check(
      "comentario_ate_500",
      sql`${t.comentario} is null or char_length(${t.comentario}) <= 500`,
    ),
    index("idx_respostas_evento").on(t.eventoId),
    // A janela antiflood pergunta "quantas nesta pesquisa no último minuto".
    index("idx_respostas_pesquisa_data").on(t.pesquisaId, t.respondidaEm),
  ],
);

/*
 * O que pode acontecer com uma ação e merece ficar registrado. Um valor por
 * acontecimento, e não um texto livre: é o enum que deixa a tela escolher
 * ícone e frase sem adivinhar a partir de uma string.
 */
export const tipoHistoricoEnum = ie.enum("tipo_historico", [
  "acao_criada",
  "acao_alterada",
  "lancamento_adicionado",
  "lancamento_excluido",
  "documento_adicionado",
  "documento_excluido",
  "link_adicionado",
  "link_excluido",
  "pesquisa_aberta",
  "pesquisa_encerrada",
  "pesquisa_reaberta",
  "pesquisa_link_renovado",
  "respostas_excluidas",
]);

/**
 * Histórico de uma ação: uma linha por acontecimento, com quem fez e quando.
 *
 * Quem escreve aqui são triggers (ver "Histórico da ação" em
 * drizzle/politicas.sql), nunca a aplicação. A alternativa descartada — cada
 * Server Action montar o diff e inserir — exigiria um SELECT a mais por
 * edição para conhecer o valor anterior e, pior, dependeria de ninguém
 * esquecer: um caminho de escrita novo sem a chamada deixaria um buraco no
 * histórico sem erro nenhum. No trigger o `OLD` vem de graça e não há como
 * uma escrita em `eventos` passar por fora.
 *
 * `usuario_nome` é cópia do nome no momento do registro, e não só a FK: quem
 * saiu da equipe continua nomeado no histórico, e um responsável enxerga o
 * nome do admin que editou a ação dele mesmo sem ver a linha do admin em
 * `usuarios`. Nulo quando não havia pessoa no escopo (semeadura, correção
 * via SQL).
 *
 * `detalhes` depende do tipo: em `acao_alterada` é a lista de campos com
 * valor anterior e novo; nos demais, o suficiente para dizer o que foi
 * ("lançamento 'Aluguel do salão', R$ 350,00"). A forma exata está em
 * `features/eventos/historico.ts`.
 *
 * Linhas nunca são editadas nem apagadas pela aplicação — não há policy de
 * UPDATE nem de DELETE. Caem em cascata com a ação.
 */
export const eventoHistorico = ie.table(
  "evento_historico",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    tipo: tipoHistoricoEnum("tipo").notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    usuarioNome: text("usuario_nome"),
    detalhes: jsonb("detalhes").notNull().default({}),
    /**
     * `clock_timestamp()` e não `now()`: `now()` é o instante em que a
     * transação começou, igual para tudo que ela grava — e reiniciar a
     * pesquisa grava duas linhas na mesma transação ("link renovado" e "N
     * respostas excluídas") que empatariam e sairiam em ordem aleatória. O
     * relógio de parede as separa na ordem em que de fato aconteceram.
     */
    registradoEm: timestamp("registrado_em", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    // A aba pergunta "o que aconteceu com esta ação, do mais recente ao mais
    // antigo" — e nada além disso.
    index("idx_historico_evento_data").on(t.eventoId, t.registradoEm),
  ],
);

/* ═════════════════════════════ Relacionamentos ════════════════════════════ */

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  missao: one(missoes, {
    fields: [usuarios.missaoId],
    references: [missoes.id],
  }),
}));

export const missoesRelations = relations(missoes, ({ many }) => ({
  usuarios: many(usuarios),
  centros: many(centrosEvangelizacao),
  grupos: many(gruposOracao),
  eventos: many(eventos),
  indicadores: many(missaoIndicadores),
}));

export const centrosEvangelizacaoRelations = relations(
  centrosEvangelizacao,
  ({ one, many }) => ({
    missao: one(missoes, {
      fields: [centrosEvangelizacao.missaoId],
      references: [missoes.id],
    }),
    grupos: many(gruposOracao),
    eventos: many(eventos),
  }),
);

export const missaoIndicadoresRelations = relations(
  missaoIndicadores,
  ({ one }) => ({
    missao: one(missoes, {
      fields: [missaoIndicadores.missaoId],
      references: [missoes.id],
    }),
  }),
);

export const gruposOracaoRelations = relations(
  gruposOracao,
  ({ one, many }) => ({
    missao: one(missoes, {
      fields: [gruposOracao.missaoId],
      references: [missoes.id],
    }),
    centro: one(centrosEvangelizacao, {
      fields: [gruposOracao.centroId],
      references: [centrosEvangelizacao.id],
    }),
    pastores: many(grupoPastores),
    contagens: many(grupoContagens),
    lembretes: many(lembretesContagem),
  }),
);

export const grupoContagensRelations = relations(grupoContagens, ({ one }) => ({
  grupo: one(gruposOracao, {
    fields: [grupoContagens.grupoId],
    references: [gruposOracao.id],
  }),
}));

export const lembretesContagemRelations = relations(
  lembretesContagem,
  ({ one }) => ({
    grupo: one(gruposOracao, {
      fields: [lembretesContagem.grupoId],
      references: [gruposOracao.id],
    }),
    usuario: one(usuarios, {
      fields: [lembretesContagem.usuarioId],
      references: [usuarios.id],
    }),
  }),
);

export const notificacoesRelations = relations(notificacoes, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [notificacoes.usuarioId],
    references: [usuarios.id],
  }),
}));

export const grupoPastoresRelations = relations(grupoPastores, ({ one }) => ({
  grupo: one(gruposOracao, {
    fields: [grupoPastores.grupoId],
    references: [gruposOracao.id],
  }),
}));

export const eventosRelations = relations(eventos, ({ one, many }) => ({
  missao: one(missoes, {
    fields: [eventos.missaoId],
    references: [missoes.id],
  }),
  centro: one(centrosEvangelizacao, {
    fields: [eventos.centroId],
    references: [centrosEvangelizacao.id],
  }),
  tipo: one(tiposEvento, {
    fields: [eventos.tipoEventoId],
    references: [tiposEvento.id],
  }),
  lancamentos: many(eventoLancamentos),
  documentos: many(eventoDocumentos),
  links: many(eventoLinks),
  pesquisa: one(eventoPesquisas),
  respostas: many(eventoRespostas),
  historico: many(eventoHistorico),
}));

export const eventoHistoricoRelations = relations(
  eventoHistorico,
  ({ one }) => ({
    evento: one(eventos, {
      fields: [eventoHistorico.eventoId],
      references: [eventos.id],
    }),
    usuario: one(usuarios, {
      fields: [eventoHistorico.usuarioId],
      references: [usuarios.id],
    }),
  }),
);

export const eventoLancamentosRelations = relations(
  eventoLancamentos,
  ({ one }) => ({
    evento: one(eventos, {
      fields: [eventoLancamentos.eventoId],
      references: [eventos.id],
    }),
    categoria: one(categoriasFinanceiras, {
      fields: [eventoLancamentos.categoriaId],
      references: [categoriasFinanceiras.id],
    }),
  }),
);

export const eventoDocumentosRelations = relations(
  eventoDocumentos,
  ({ one }) => ({
    evento: one(eventos, {
      fields: [eventoDocumentos.eventoId],
      references: [eventos.id],
    }),
  }),
);

export const eventoLinksRelations = relations(eventoLinks, ({ one }) => ({
  evento: one(eventos, {
    fields: [eventoLinks.eventoId],
    references: [eventos.id],
  }),
}));

export const eventoPesquisasRelations = relations(
  eventoPesquisas,
  ({ one, many }) => ({
    evento: one(eventos, {
      fields: [eventoPesquisas.eventoId],
      references: [eventos.id],
    }),
    respostas: many(eventoRespostas),
  }),
);

export const eventoRespostasRelations = relations(
  eventoRespostas,
  ({ one }) => ({
    pesquisa: one(eventoPesquisas, {
      fields: [eventoRespostas.pesquisaId],
      references: [eventoPesquisas.id],
    }),
    evento: one(eventos, {
      fields: [eventoRespostas.eventoId],
      references: [eventos.id],
    }),
  }),
);

/* ═══════════════════════════════ Tipos ════════════════════════════════════ */

export type Usuario = typeof usuarios.$inferSelect;
export type Missao = typeof missoes.$inferSelect;
export type MissaoIndicador = typeof missaoIndicadores.$inferSelect;
export type CentroEvangelizacao = typeof centrosEvangelizacao.$inferSelect;
export type GrupoOracao = typeof gruposOracao.$inferSelect;
export type GrupoPastor = typeof grupoPastores.$inferSelect;
export type GrupoContagem = typeof grupoContagens.$inferSelect;
export type LembreteContagem = typeof lembretesContagem.$inferSelect;
export type Notificacao = typeof notificacoes.$inferSelect;
export type TipoEvento = typeof tiposEvento.$inferSelect;
export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type Evento = typeof eventos.$inferSelect;
export type EventoLancamento = typeof eventoLancamentos.$inferSelect;
export type EventoDocumento = typeof eventoDocumentos.$inferSelect;
export type EventoLink = typeof eventoLinks.$inferSelect;
export type EventoPesquisa = typeof eventoPesquisas.$inferSelect;
export type EventoResposta = typeof eventoRespostas.$inferSelect;
export type EventoHistorico = typeof eventoHistorico.$inferSelect;
export type Papel = (typeof papelEnum.enumValues)[number];
export type StatusEvento = (typeof statusEventoEnum.enumValues)[number];
export type TipoHistorico = (typeof tipoHistoricoEnum.enumValues)[number];
export type TipoCentro = (typeof tipoCentroEnum.enumValues)[number];
export type CanalLembrete = (typeof canalLembreteEnum.enumValues)[number];
