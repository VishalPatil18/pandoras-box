"use client";

import { useIsMutating } from "@tanstack/react-query";
import { useState } from "react";
import { FactTicket } from "@/components/dashboard/fact-ticket";
import { MovieEditor } from "@/components/dashboard/movie-editor";
import { ProfilePill } from "@/components/dashboard/profile-pill";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import type { Me } from "@/lib/contracts";
import { movieKey } from "@/lib/movie";
import { goToLanding } from "@/lib/navigation";
import { setMovieMutationKey, useMe } from "@/lib/queries";

function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      // Even if the request fails, the landing page re-checks the session on load.
      goToLanding();
    }
  }

  return (
    <Button variant="outline" onClick={logOut} disabled={pending}>
      <Icon name="log-out" />
      Log out
    </Button>
  );
}

export function Dashboard({ initialMe }: { initialMe: Me }) {
  const { data: me } = useMe(initialMe);
  // While a movie save is in flight the fact waits, so it is always fetched for the confirmed movie.
  const saving = useIsMutating({ mutationKey: setMovieMutationKey }) > 0;
  const movie = me.favoriteMovie ?? "";

  return (
    <ToastProvider>
      <main>
        <section className="bg-sky px-[clamp(16px,4vw,48px)] pb-16">
          <header className="flex items-center justify-between gap-3 py-5">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-pill border border-carbon bg-paper"
            >
              <Icon name="box" />
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ProfilePill me={me} />
              <LogoutButton />
            </div>
          </header>
          <MovieEditor movie={movie} />
        </section>

        <section className="bg-paper px-[clamp(16px,4vw,48px)] pt-12 pb-24">
          <FactTicket movieTitle={movie} movieKey={movieKey(movie)} paused={saving} />
        </section>
      </main>
    </ToastProvider>
  );
}
