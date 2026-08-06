import { defineConfig } from "prisma/config";

/**
 * Prisma 7 no longer auto-loads .env, and the connection URL moved out of
 * schema.prisma into this file. The runtime client connects separately, via the
 * better-sqlite3 driver adapter in `src/lib/db.ts`.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing env file is fine — the default below covers a fresh checkout.
  }
}

export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Paths are resolved against the project root (process.cwd()), which is the
    // same for `prisma` CLI runs and for `next dev`.
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
