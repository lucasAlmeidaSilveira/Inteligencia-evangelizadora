-- Toda missão passa a ter um centro principal, e todo grupo e ação passam a
-- pertencer a algum centro.
--
-- A ordem aqui não é livre: o `drizzle-kit` gera o `SET NOT NULL` primeiro, e
-- assim ele falharia em cima das linhas que hoje estão nulas. Primeiro a
-- coluna nova, depois os principais, depois o remanejo dos vínculos — só então
-- a coluna vira obrigatória.

ALTER TABLE "ie"."centros_evangelizacao" ADD COLUMN "principal" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Missão que já tem um centro homônimo ganha esse como principal, em vez de um
-- segundo com o mesmo nome — que `uq_centro_nome_por_missao` recusaria.
UPDATE "ie"."centros_evangelizacao" c
   SET "principal" = true
  FROM "ie"."missoes" m
 WHERE c."missao_id" = m."id"
   AND lower(c."nome") = lower(m."nome")
   AND NOT EXISTS (
         SELECT 1 FROM "ie"."centros_evangelizacao" p
          WHERE p."missao_id" = m."id" AND p."principal"
       );--> statement-breakpoint

-- As demais ganham um principal com o nome da própria missão. `cidade` e
-- `regiao` ficam nulas de propósito: nesta tabela, em branco significa "as
-- mesmas da missão", e copiá-las criaria uma segunda cópia para divergir.
INSERT INTO "ie"."centros_evangelizacao" ("missao_id", "nome", "tipo", "principal")
SELECT m."id", m."nome", 'centro_evangelizacao', true
  FROM "ie"."missoes" m
 WHERE NOT EXISTS (
         SELECT 1 FROM "ie"."centros_evangelizacao" p
          WHERE p."missao_id" = m."id" AND p."principal"
       );--> statement-breakpoint

-- O que pendia direto da missão passa a pender do principal dela. Nada muda de
-- missão: a chave composta (centro_id, missao_id) continua satisfeita.
UPDATE "ie"."grupos_oracao" g
   SET "centro_id" = p."id"
  FROM "ie"."centros_evangelizacao" p
 WHERE p."missao_id" = g."missao_id" AND p."principal" AND g."centro_id" IS NULL;--> statement-breakpoint

UPDATE "ie"."eventos" e
   SET "centro_id" = p."id"
  FROM "ie"."centros_evangelizacao" p
 WHERE p."missao_id" = e."missao_id" AND p."principal" AND e."centro_id" IS NULL;--> statement-breakpoint

ALTER TABLE "ie"."grupos_oracao" ALTER COLUMN "centro_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ie"."eventos" ALTER COLUMN "centro_id" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "uq_centro_principal_por_missao" ON "ie"."centros_evangelizacao" USING btree ("missao_id") WHERE "ie"."centros_evangelizacao"."principal";
