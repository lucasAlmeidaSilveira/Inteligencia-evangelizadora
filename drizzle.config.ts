import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  },
  // Restringe o diff ao nosso schema: sem isso o drizzle-kit enxergaria as
  // tabelas do Glyvo em `public` e proporia apagá-las.
  schemaFilter: ["ie"],
  verbose: true,
  strict: true,
});
