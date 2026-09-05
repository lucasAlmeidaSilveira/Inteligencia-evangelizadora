ALTER TYPE "ie"."papel" ADD VALUE 'auxiliar';--> statement-breakpoint
ALTER TABLE "ie"."usuario_missoes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ie"."usuario_missoes" CASCADE;--> statement-breakpoint
ALTER TABLE "ie"."usuarios" ALTER COLUMN "papel" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ie"."usuarios" ADD COLUMN "missao_id" uuid;--> statement-breakpoint
ALTER TABLE "ie"."usuarios" ADD CONSTRAINT "usuarios_missao_id_missoes_id_fk" FOREIGN KEY ("missao_id") REFERENCES "ie"."missoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usuarios_missao" ON "ie"."usuarios" USING btree ("missao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_responsavel_por_missao" ON "ie"."usuarios" USING btree ("missao_id") WHERE "ie"."usuarios"."papel" = 'responsavel';--> statement-breakpoint
ALTER TABLE "ie"."usuarios" ADD CONSTRAINT "papel_e_missao_coerentes" CHECK (("ie"."usuarios"."papel" = 'admin' and "ie"."usuarios"."missao_id" is null) or ("ie"."usuarios"."papel" <> 'admin' and "ie"."usuarios"."missao_id" is not null));