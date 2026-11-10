import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Your movie | Pandoras Box" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.favoriteMovie) redirect("/onboarding");

  return <Dashboard initialMe={user} />;
}
