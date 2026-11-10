import { redirect } from "next/navigation";
import { Hero } from "@/components/landing/hero";
import { getCurrentUser } from "@/lib/dal";

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (user) {
    // Google returns here after sign-in; carry the welcome toast to wherever the user lands.
    const { toast } = await searchParams;
    const flash = toast === "signed-in" ? "?toast=signed-in" : "";
    redirect(`${user.favoriteMovie ? "/dashboard" : "/onboarding"}${flash}`);
  }

  return <Hero />;
}
