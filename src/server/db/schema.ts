import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
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
    /** Nulo = o grupo pende direto da missão, sem passar por centro algum. */
    centroId: uuid("centro_id"),
    nome: text("nome").notNull(),
    quantidadePessoas: integer("quantidade_pessoas").notNull().default(0),
    /** 0 = domingo … 6 = sábado. */
    diaSemana: integer("dia_semana"),
    horario: time("horario"),
    local: text("local"),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoria,
  },
  (t) => [
    check("quantidade_pessoas_nao_negativa", sql`${t.quantidadePessoas} >= 0`),
    check("dia_semana_valido", sql`${t.diaSemana} is null or ${t.diaSemana} between 0 and 6`),
    index("idx_grupos_missao").on(t.missaoId),
    index("idx_grupos_centro").on(t.centroId),
    /*
     * Pelo par (centro, missão), não só pelo centro.
     *
     * Um FK simples deixaria um grupo da Zona Leste apontar para um centro da
     * Zona Sul — dado de outra missão entrando por uma porta que o RLS não
     * vigia, e sem erro nenhum. Com `missao_id` notNull e `centro_id` nulável,
     * o MATCH SIMPLE do Postgres simplesmente não checa nada quando o centro é
     * nulo, que é justamente o caso "diretamente na missão".
     *
     * Sem `onDelete`: o `no action` obriga `excluirCentro` a desvincular à
     * vista, com o usuário sabendo quantos registros isso afeta. Um
     * `set null` composto tentaria zerar também `missao_id`, que é notNull.
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
    /** Nulo = a ação é da missão inteira, não de um centro específico. */
    centroId: uuid("centro_id"),
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
    participantesTotal: integer("participantes_total").notNull().default(0),
    servosEngajados: integer("servos_engajados").notNull().default(0),
    status: statusEventoEnum("status").notNull().default("planejado"),
    criadoPor: uuid("criado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    ...auditoria,
  },
  (t) => [
    check("periodo_valido", sql`${t.dataFim} >= ${t.dataInicio}`),
    check("participantes_nao_negativo", sql`${t.participantesTotal} >= 0`),
    check("servos_nao_negativo", sql`${t.servosEngajados} >= 0`),
    index("idx_eventos_missao").on(t.missaoId),
    index("idx_eventos_centro").on(t.centroId),
    index("idx_eventos_tipo").on(t.tipoEventoId),
    // Consulta mais frequente do sistema: eventos de um mês no calendário.
    index("idx_eventos_periodo").on(t.dataInicio, t.dataFim),
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
  }),
);

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
}));

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

/* ═══════════════════════════════ Tipos ════════════════════════════════════ */

export type Usuario = typeof usuarios.$inferSelect;
export type Missao = typeof missoes.$inferSelect;
export type MissaoIndicador = typeof missaoIndicadores.$inferSelect;
export type CentroEvangelizacao = typeof centrosEvangelizacao.$inferSelect;
export type GrupoOracao = typeof gruposOracao.$inferSelect;
export type GrupoPastor = typeof grupoPastores.$inferSelect;
export type TipoEvento = typeof tiposEvento.$inferSelect;
export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type Evento = typeof eventos.$inferSelect;
export type EventoLancamento = typeof eventoLancamentos.$inferSelect;
export type EventoDocumento = typeof eventoDocumentos.$inferSelect;
export type EventoLink = typeof eventoLinks.$inferSelect;
export type Papel = (typeof papelEnum.enumValues)[number];
export type StatusEvento = (typeof statusEventoEnum.enumValues)[number];
export type TipoCentro = (typeof tipoCentroEnum.enumValues)[number];
