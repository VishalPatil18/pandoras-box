import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

type GoogleProfileFields = { name?: string | null; email: string; picture?: string | null };

// Google can omit the name; storing "" keeps sign-in working and the UI falls back to the email.
export function profileToUser(profile: GoogleProfileFields): { name: string; image?: string } {
  return { name: profile.name?.trim() ?? "", image: profile.picture ?? undefined };
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  session: {
    // Off so a deleted session stops working on the very next request.
    cookieCache: { enabled: false },
  },
  socialProviders: {
    google: {
      clientId: requiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      prompt: "select_account",
      mapProfileToUser: profileToUser,
      overrideUserInfoOnSignIn: true,
    },
  },
});
