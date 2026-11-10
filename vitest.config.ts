import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile();

// Tests truncate tables, so they get their own database instead of the dev one.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://pandoras:pandoras@localhost:5433/pandoras_test";
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

const serverOnlyStub = fileURLToPath(new URL("./tests/setup/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": serverOnlyStub } },
  test: {
    // Lets a project with no tests yet (frontend) pass on its own.
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "backend",
          environment: "node",
          include: ["tests/backend/**/*.test.ts"],
          globalSetup: ["tests/setup/global-db.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          // Backend tests share one real database, so files run one at a time.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["tests/frontend/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
