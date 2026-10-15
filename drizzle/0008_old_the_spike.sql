ALTER TABLE "ie"."eventos" ADD COLUMN "nps" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "ie"."eventos" ADD CONSTRAINT "nps_entre_zero_e_dez" CHECK ("ie"."eventos"."nps" between 0 and 10);