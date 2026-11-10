import { prisma } from "@/lib/db";

export async function resetDb(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "fact", "session", "account", "verification", "user" CASCADE`;
}

// Backdates with the database clock so tests exercise the same now() the app uses.
export async function insertFact(
  userId: string,
  fact: { movieTitle: string; text: string; ageSeconds: number },
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "fact" ("id", "userId", "movieTitle", "movieKey", "text", "createdAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${fact.movieTitle}, ${fact.movieTitle.toLowerCase()},
            ${fact.text}, now() - make_interval(secs => ${fact.ageSeconds}))`;
}

type UserOverrides = Partial<{ email: string; name: string; favoriteMovie: string | null }>;

export async function createUser(overrides: UserOverrides = {}): Promise<{ id: string }> {
  return prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Ada Okafor",
      email: `${crypto.randomUUID()}@example.com`,
      ...overrides,
    },
    select: { id: true },
  });
}
