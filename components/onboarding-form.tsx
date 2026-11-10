"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError, isUnauthenticated } from "@/lib/api";
import { goToLanding } from "@/lib/navigation";
import { notify } from "@/lib/notify";
import { normalizeMovie } from "@/lib/movie";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = normalizeMovie(new FormData(event.currentTarget).get("movie"));
    if (!title.ok) return setError(title.message);

    setError(null);
    setSaving(true);
    try {
      await api.setMovie(title.value);
      router.replace("/dashboard?toast=onboarded");
    } catch (failure) {
      if (isUnauthenticated(failure)) return goToLanding("session-expired");
      const message =
        failure instanceof ApiError ? failure.message : "Couldn't save your movie. Try again.";
      // Field problems stay next to the field; anything else also gets a toast.
      setError(message);
      if (!(failure instanceof ApiError && failure.code === "VALIDATION_ERROR"))
        notify.error(message);
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-[560px]">
      <h1 className="mb-8 max-w-[14ch] text-[clamp(36px,5vw,64px)] leading-none font-bold tracking-[-0.02em]">
        What&apos;s your favorite movie?
      </h1>
      <div className="mb-6">
        <Field
          label="Favorite movie"
          name="movie"
          autoComplete="off"
          placeholder="Spirited Away"
          maxLength={140}
          help="Just one. You can change it later from your dashboard."
          error={error}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving" : "Save and continue"}
      </Button>
    </form>
  );
}
