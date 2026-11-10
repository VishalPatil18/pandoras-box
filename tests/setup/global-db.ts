import { execFileSync } from "node:child_process";
import { Client } from "pg";

const SAFE_DB_NAME = /^[a-z_][a-z0-9_]*$/;

// Runs once before backend tests: make sure the test database exists and is migrated.
export default async function setupTestDatabase(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL is not set");

  const dbName = new URL(testUrl).pathname.slice(1);
  if (!SAFE_DB_NAME.test(dbName)) throw new Error(`Unexpected test database name: ${dbName}`);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: testUrl },
    stdio: "inherit",
  });
}
