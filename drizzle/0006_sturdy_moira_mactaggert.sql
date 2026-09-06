ALTER TABLE "ie"."eventos" ADD COLUMN "responsavel_nome" text;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "participantes_inscritos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "participantes_novos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "participantes_permaneceram" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "orcamento_previsto" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD COLUMN "destaque_regional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_eventos_destaque" ON "ie"."eventos" USING btree ("missao_id") WHERE "ie"."eventos"."destaque_regional";--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "inscritos_nao_negativo" CHECK ("ie"."eventos"."participantes_inscritos" >= 0);--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "novos_nao_negativo" CHECK ("ie"."eventos"."participantes_novos" >= 0);--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "permaneceram_nao_negativo" CHECK ("ie"."eventos"."participantes_permaneceram" >= 0);--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "orcamento_nao_negativo" CHECK ("ie"."eventos"."orcamento_previsto" >= 0);