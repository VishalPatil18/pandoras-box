"use client";

import { useIsMutating } from "@tanstack/react-query";
import { FactTicket } from "@/components/dashboard/fact-ticket";
import { MovieEditor } from "@/components/dashboard/movie-editor";
import { ProfilePill } from "@/components/dashboard/profile-pill";
import type { Me } from "@/lib/contracts";
import { movieKey } from "@/lib/movie";
import { setMovieMutationKey, useMe } from "@/lib/queries";

// Color bands run full width; content sits in one centered 1200px column.
const COLUMN = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

export function Dashboard({ initialMe }: { initialMe: Me }) {
  const { data: me } = useMe(initialMe);
  // While a movie save is in flight the fact waits, so it is always fetched for the confirmed movie.
  const saving = useIsMutating({ mutationKey: setMovieMutationKey }) > 0;
  const movie = me.favoriteMovie ?? "";

  return (
    <main>
      <section className="bg-sky pb-12 md:pb-16">
        <div className={COLUMN}>
          <header className="flex items-center justify-between gap-3 py-4 md:py-5">
            <p className="font-display text-lg leading-none uppercase sm:text-xl">Pandoras Box</p>
            <ProfilePill me={me} />
          </header>
          <MovieEditor movie={movie} />
        </div>
      </section>

      <section className="bg-paper pt-8 pb-20 md:pt-12 md:pb-24">
        <div className={COLUMN}>
          <FactTicket movieTitle={movie} movieKey={movieKey(movie)} paused={saving} />
        </div>
      </section>
    </main>
  );
}
