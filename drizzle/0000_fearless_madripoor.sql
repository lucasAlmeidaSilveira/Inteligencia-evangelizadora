CREATE SCHEMA IF NOT EXISTS "ie";
--> statement-breakpoint
CREATE TYPE "ie"."papel" AS ENUM('admin', 'responsavel');--> statement-breakpoint
CREATE TYPE "ie"."status_evento" AS ENUM('planejado', 'em_andamento', 'realizado', 'cancelado');--> statement-breakpoint
CREATE TYPE "ie"."tipo_categoria" AS ENUM('receita', 'despesa', 'ambos');--> statement-breakpoint
CREATE TYPE "ie"."tipo_lancamento" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TABLE "ie"."categorias_financeiras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" "ie"."tipo_categoria" DEFAULT 'ambos' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_financeiras_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "ie"."evento_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"chave_armazenamento" text NOT NULL,
	"tipo_mime" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"enviado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_documentos_chave_armazenamento_unique" UNIQUE("chave_armazenamento"),
	CONSTRAINT "tamanho_positivo" CHECK ("ie"."evento_documentos"."tamanho_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."evento_lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"tipo" "ie"."tipo_lancamento" NOT NULL,
	"categoria_id" uuid,
	"descricao" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"data" date NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valor_positivo" CHECK ("ie"."evento_lancamentos"."valor" > 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."evento_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"url" text NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "url_http" CHECK ("ie"."evento_links"."url" ~* '^https?://')
);
--> statement-breakpoint
CREATE TABLE "ie"."eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"tipo_evento_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"observacoes" text,
	"data_inicio" timestamp with time zone NOT NULL,
	"data_fim" timestamp with time zone NOT NULL,
	"local" text,
	"endereco" text,
	"participantes_total" integer DEFAULT 0 NOT NULL,
	"servos_engajados" integer DEFAULT 0 NOT NULL,
	"status" "ie"."status_evento" DEFAULT 'planejado' NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periodo_valido" CHECK ("ie"."eventos"."data_fim" >= "ie"."eventos"."data_inicio"),
	CONSTRAINT "participantes_nao_negativo" CHECK ("ie"."eventos"."participantes_total" >= 0),
	CONSTRAINT "servos_nao_negativo" CHECK ("ie"."eventos"."servos_engajados" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."grupo_responsaveis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"telefone" text,
	"email" text,
	"ordem" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordem_entre_um_e_tres" CHECK ("ie"."grupo_responsaveis"."ordem" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "ie"."grupos_oracao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"quantidade_pessoas" integer DEFAULT 0 NOT NULL,
	"dia_semana" integer,
	"horario" time,
	"local" text,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quantidade_pessoas_nao_negativa" CHECK ("ie"."grupos_oracao"."quantidade_pessoas" >= 0),
	CONSTRAINT "dia_semana_valido" CHECK ("ie"."grupos_oracao"."dia_semana" is null or "ie"."grupos_oracao"."dia_semana" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "ie"."missao_indicadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"membros_total" integer NOT NULL,
	"grupos_total" integer NOT NULL,
	"pessoas_grupos_total" integer NOT NULL,
	"observacao" text,
	"registrado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competencia_no_dia_um" CHECK (date_part('day', "ie"."missao_indicadores"."competencia") = 1),
	CONSTRAINT "indicadores_nao_negativos" CHECK ("ie"."missao_indicadores"."membros_total" >= 0 and "ie"."missao_indicadores"."grupos_total" >= 0 and "ie"."missao_indicadores"."pessoas_grupos_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."missoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"cidade" text DEFAULT 'São Paulo' NOT NULL,
	"regiao" text,
	"endereco" text,
	"data_fundacao" date,
	"responsavel_nome" text,
	"contato_telefone" text,
	"contato_email" text,
	"membros_total" integer DEFAULT 0 NOT NULL,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missoes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "membros_total_nao_negativo" CHECK ("ie"."missoes"."membros_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."tipos_evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cor" text DEFAULT '#7C3AED' NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_evento_nome_unique" UNIQUE("nome"),
	CONSTRAINT "cor_hexadecimal" CHECK ("ie"."tipos_evento"."cor" ~* '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "ie"."usuario_missoes" (
	"usuario_id" uuid NOT NULL,
	"missao_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_missoes_usuario_id_missao_id_pk" PRIMARY KEY("usuario_id","missao_id")
);
--> statement-breakpoint
CREATE TABLE "ie"."usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"papel" "ie"."papel" DEFAULT 'responsavel' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ie"."evento_documentos" ADD CONSTRAINT "evento_documentos_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_documentos" ADD CONSTRAINT "evento_documentos_enviado_por_usuarios_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_lancamentos" ADD CONSTRAINT "evento_lancamentos_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_lancamentos" ADD CONSTRAINT "evento_lancamentos_categoria_id_categorias_financeiras_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "ie"."categorias_financeiras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_lancamentos" ADD CONSTRAINT "evento_lancamentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_links" ADD CONSTRAINT "evento_links_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "eventos_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "eventos_tipo_evento_id_tipos_evento_id_fk" FOREIGN KEY ("tipo_evento_id") REFERENCES "ie"."tipos_evento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "eventos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."grupo_responsaveis" ADD CONSTRAINT "grupo_responsaveis_grupo_id_grupos_oracao_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "ie"."grupos_oracao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD CONSTRAINT "grupos_oracao_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."missao_indicadores" ADD CONSTRAINT "missao_indicadores_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."missao_indicadores" ADD CONSTRAINT "missao_indicadores_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."usuario_missoes" ADD CONSTRAINT "usuario_missoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "ie"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."usuario_missoes" ADD CONSTRAINT "usuario_missoes_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documentos_evento" ON "ie"."evento_documentos" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "idx_lancamentos_evento" ON "ie"."evento_lancamentos" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "idx_links_evento" ON "ie"."evento_links" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "idx_eventos_missao" ON "ie"."eventos" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "idx_eventos_tipo" ON "ie"."eventos" USING btree ("tipo_evento_id");--> statement-breakpoint
CREATE INDEX "idx_eventos_periodo" ON "ie"."eventos" USING btree ("data_inicio","data_fim");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_responsavel_ordem" ON "ie"."grupo_responsaveis" USING btree ("grupo_id","ordem");--> statement-breakpoint
CREATE INDEX "idx_grupos_missao" ON "ie"."grupos_oracao" USING btree ("missao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_indicador_missao_competencia" ON "ie"."missao_indicadores" USING btree ("missao_id","competencia");--> statement-breakpoint
CREATE INDEX "idx_missoes_ativo" ON "ie"."missoes" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "idx_usuario_missoes_missao" ON "ie"."usuario_missoes" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "idx_usuarios_papel" ON "ie"."usuarios" USING btree ("papel");