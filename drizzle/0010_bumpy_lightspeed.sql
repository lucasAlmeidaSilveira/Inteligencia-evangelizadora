CREATE TABLE "ie"."evento_pesquisas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"token" text NOT NULL,
	"aberta" boolean DEFAULT true NOT NULL,
	"encerra_em" timestamp with time zone NOT NULL,
	"criada_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_pesquisas_evento_id_unique" UNIQUE("evento_id"),
	CONSTRAINT "evento_pesquisas_token_unique" UNIQUE("token"),
	CONSTRAINT "token_base64url" CHECK ("ie"."evento_pesquisas"."token" ~ '^[A-Za-z0-9_-]{43}$')
);
--> statement-breakpoint
CREATE TABLE "ie"."evento_respostas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesquisa_id" uuid NOT NULL,
	"evento_id" uuid NOT NULL,
	"nota" smallint NOT NULL,
	"comentario" text,
	"respondida_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nota_entre_zero_e_dez" CHECK ("ie"."evento_respostas"."nota" between 0 and 10),
	CONSTRAINT "comentario_ate_500" CHECK ("ie"."evento_respostas"."comentario" is null or char_length("ie"."evento_respostas"."comentario") <= 500)
);
--> statement-breakpoint
ALTER TABLE "ie"."evento_pesquisas" ADD CONSTRAINT "evento_pesquisas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_pesquisas" ADD CONSTRAINT "evento_pesquisas_criada_por_usuarios_id_fk" FOREIGN KEY ("criada_por") REFERENCES "ie"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_respostas" ADD CONSTRAINT "evento_respostas_pesquisa_id_evento_pesquisas_id_fk" FOREIGN KEY ("pesquisa_id") REFERENCES "ie"."evento_pesquisas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ie"."evento_respostas" ADD CONSTRAINT "evento_respostas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "ie"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_respostas_evento" ON "ie"."evento_respostas" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "idx_respostas_pesquisa_data" ON "ie"."evento_respostas" USING btree ("pesquisa_id","respondida_em");