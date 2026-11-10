import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// pg has no connect timeout by default, so a dead database would hang requests.
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 5_000;

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Reuse one client across dev hot reloads instead of opening a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
