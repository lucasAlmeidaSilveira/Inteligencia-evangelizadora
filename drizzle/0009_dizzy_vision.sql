CREATE TYPE "ie"."canal_lembrete" AS ENUM('interno', 'email');--> statement-breakpoint
CREATE TABLE "ie"."grupo_contagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"membros_efetivos" integer NOT NULL,
	"membros_flutuantes" integer NOT NULL,
	"membros_evadidos" integer NOT NULL,
	"registrado_por" uuid,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contagem_nao_negativa" CHECK ("ie"."grupo_contagens"."membros_efetivos" >= 0 and "ie"."grupo_contagens"."membros_flutuantes" >= 0 and "ie"."grupo_contagens"."membros_evadidos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ie"."lembretes_contagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"usuario_id" uuid,
	"canal" "ie"."canal_lembrete" NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ie"."notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"url" text,
	"lida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "url_interna" CHECK ("ie"."notificacoes"."url" is null or "ie"."notificacoes"."url" ~ '^/')
);
--> statement-breakpoint
-- ─── grupos_oracao: de um total para três contagens ─────────────────────────
-- Trecho reordenado à mão. O gerado criava a coluna calculada antes das colunas
-- de que ela depende e descartava o total existente sem copiá-lo para lugar
-- nenhum. A ordem aqui: criar as três, preservar o total como "efetivos",
-- só então trocar `quantidade_pessoas` pela coluna gerada.
ALTER TABLE "ie"."grupos_oracao" ADD COLUMN "membros_efetivos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD COLUMN "membros_flutuantes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD COLUMN "membros_evadidos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- O total que já existia era a melhor contagem disponível: vira "efetivos",
-- com flutuantes e evadidos em zero até a próxima atualização.
UPDATE "ie"."grupos_oracao" SET "membros_efetivos" = "quantidade_pessoas";--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" DROP CONSTRAINT "quantidade_pessoas_nao_negativa";--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" DROP COLUMN "quantidade_pessoas";--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD COLUMN "quantidade_pessoas" integer GENERATED ALWAYS AS ("membros_efetivos" + "membros_flutuantes") STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."grupo_contagens" ADD CONSTRAINT "grupo_contagens_grupo_id_grupos_oracao_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "ie"."grupos_oracao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."grupo_contagens" ADD CONSTRAINT "grupo_contagens_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."lembretes_contagem" ADD CONSTRAINT "lembretes_contagem_grupo_id_grupos_oracao_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "ie"."grupos_oracao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."lembretes_contagem" ADD CONSTRAINT "lembretes_contagem_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "ie"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contagens_grupo_data" ON "ie"."grupo_contagens" USING btree ("grupo_id","registrado_em");--> statement-breakpoint
CREATE INDEX "idx_lembretes_grupo_data" ON "ie"."lembretes_contagem" USING btree ("grupo_id","enviado_em");--> statement-breakpoint
CREATE INDEX "idx_notificacoes_usuario_nao_lidas" ON "ie"."notificacoes" USING btree ("usuario_id") WHERE "ie"."notificacoes"."lida_em" is null;--> statement-breakpoint
CREATE INDEX "idx_notificacoes_usuario_data" ON "ie"."notificacoes" USING btree ("usuario_id","criado_em");--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD CONSTRAINT "membros_nao_negativos" CHECK ("ie"."grupos_oracao"."membros_efetivos" >= 0 and "ie"."grupos_oracao"."membros_flutuantes" >= 0 and "ie"."grupos_oracao"."membros_evadidos" >= 0);--> statement-breakpoint
-- Cada grupo existente ganha a primeira linha de histórico, datada da última
-- alteração do cadastro. É o ponto de partida do lembrete bimestral: sem ela,
-- todo grupo antigo pareceria "nunca contado" e receberia aviso no primeiro
-- dia — inclusive os atualizados na semana passada.
INSERT INTO "ie"."grupo_contagens" ("grupo_id", "membros_efetivos", "membros_flutuantes", "membros_evadidos", "registrado_em")
SELECT "id", "membros_efetivos", "membros_flutuantes", "membros_evadidos", "atualizado_em" FROM "ie"."grupos_oracao";
