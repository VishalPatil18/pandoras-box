import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { OnboardingForm } from "@/components/onboarding-form";
import { Sticker } from "@/components/sticker";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Choose your movie | Pandoras Box" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.favoriteMovie) redirect("/dashboard");

  return (
    <main className="min-h-dvh bg-paper px-[clamp(16px,4vw,48px)] pb-12">
      <header className="py-5">
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-pill border border-carbon bg-paper"
        >
          <Icon name="box" />
        </span>
      </header>
      <div className="grid items-center gap-12 pt-[clamp(24px,8vh,96px)] md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <OnboardingForm />
        <div
          aria-hidden="true"
          className="relative hidden min-h-[340px] place-items-center md:grid"
        >
          <Sticker
            icon="clapperboard"
            color="lavender"
            rotate={-8}
            className="w-[clamp(140px,22vw,260px)] rounded-card-xl"
          />
          <Sticker
            icon="check"
            color="mint"
            rotate={12}
            className="absolute top-[8%] right-[10%]"
          />
          <Sticker
            icon="film"
            color="ember"
            rotate={-14}
            className="absolute bottom-[6%] left-[4%]"
          />
        </div>
      </div>
    </main>
  );
}
