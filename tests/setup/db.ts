import { prisma } from "@/lib/db";

export async function resetDb(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "fact", "session", "account", "verification", "user" CASCADE`;
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
