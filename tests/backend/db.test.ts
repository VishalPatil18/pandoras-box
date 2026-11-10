import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createUser, resetDb } from "../setup/db";

const CLOCK_TOLERANCE_MS = 5_000;

describe("database schema", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("stamps a new fact with the database clock", async () => {
    const user = await createUser();
    const fact = await prisma.fact.create({
      data: { userId: user.id, movieTitle: "Inception", movieKey: "inception", text: "A fact." },
    });
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now()`;

    expect(Math.abs(fact.createdAt.getTime() - now.getTime())).toBeLessThan(CLOCK_TOLERANCE_MS);
  });

  it("deletes a user's facts when the user is deleted", async () => {
    const user = await createUser();
    await prisma.fact.create({
      data: { userId: user.id, movieTitle: "Up", movieKey: "up", text: "A fact." },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.fact.count()).toBe(0);
  });

  it("rejects a favorite movie longer than 100 characters", async () => {
    await expect(createUser({ favoriteMovie: "a".repeat(101) })).rejects.toThrow();
  });

  // Supabase's Data API reads public tables as anon unless RLS shuts it out.
  it("enables row level security on every table", async () => {
    const open = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`;

    expect(open).toEqual([]);
  });
});
