import { redirect } from "next/navigation";
import { Hero } from "@/components/landing/hero";
import { getCurrentUser } from "@/lib/dal";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.favoriteMovie ? "/dashboard" : "/onboarding");

  return <Hero />;
}
