import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Alterar estrutura exige o dono do schema.
    url: (process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL)!,
    // Verificação estrita só onde há certificado de autoridade pública.
    ssl: {
      rejectUnauthorized: (process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL ?? "").includes(".neon.tech"),
    },
  },
  // Restringe o diff ao nosso schema: sem isso o drizzle-kit enxergaria as
  // tabelas do Glyvo em `public` e proporia apagá-las.
  schemaFilter: ["ie"],
  verbose: true,
  strict: true,
});
