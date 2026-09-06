CREATE TYPE "ie"."tipo_centro" AS ENUM('centro_evangelizacao', 'irradiacao');--> statement-breakpoint
CREATE TABLE "ie"."centros_evangelizacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "ie"."tipo_centro" DEFAULT 'centro_evangelizacao' NOT NULL,
	"cidade" text,
	"regiao" text,
	"endereco" text,
	"data_fundacao" date,
	"contato_telefone" text,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_centro_id_missao" UNIQUE("id","missao_id")
);
--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "centro_id" uuid;--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD COLUMN "centro_id" uuid;--> statement-breakpoint
ALTER TABLE "ie"."centros_evangelizacao" ADD CONSTRAINT "centros_evangelizacao_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_centros_missao" ON "ie"."centros_evangelizacao" USING btree ("missao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_centro_nome_por_missao" ON "ie"."centros_evangelizacao" USING btree ("missao_id",lower("nome"));--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "fk_eventos_centro_da_missao" FOREIGN KEY ("centro_id","missao_id") REFERENCES "ie"."centros_evangelizacao"("id","missao_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."grupos_oracao" ADD CONSTRAINT "fk_grupos_centro_da_missao" FOREIGN KEY ("centro_id","missao_id") REFERENCES "ie"."centros_evangelizacao"("id","missao_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_eventos_centro" ON "ie"."eventos" USING btree ("centro_id");--> statement-breakpoint
CREATE INDEX "idx_grupos_centro" ON "ie"."grupos_oracao" USING btree ("centro_id");