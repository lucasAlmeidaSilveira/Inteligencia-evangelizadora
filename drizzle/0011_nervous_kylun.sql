CREATE TYPE "ie"."tipo_historico" AS ENUM('acao_criada', 'acao_alterada', 'lancamento_adicionado', 'lancamento_excluido', 'documento_adicionado', 'documento_excluido', 'link_adicionado', 'link_excluido', 'pesquisa_aberta', 'pesquisa_encerrada', 'pesquisa_reaberta', 'pesquisa_link_renovado', 'respostas_excluidas');--> statement-breakpoint
CREATE TABLE "ie"."evento_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"tipo" "ie"."tipo_historico" NOT NULL,
	"usuario_id" uuid,
	"usuario_nome" text,
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ie"."evento_historico" ADD CONSTRAINT "evento_historico_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_historico" ADD CONSTRAINT "evento_historico_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_historico_evento_data" ON "ie"."evento_historico" USING btree ("evento_id","registrado_em");