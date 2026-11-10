"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "cn";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { isUnauthenticated } from "@/lib/api";
import { movieKey, normalizeMovie } from "@/lib/movie";
import { FACT_TOAST, notify } from "@/lib/notify";
import { useSetMovie } from "@/lib/queries";

// Long titles step down a size so they stay a few lines and the ticket stays in view.
function titleSize(title: string): string {
  if (title.length > 28) return "text-[clamp(36px,5vw,80px)]";
  if (title.length > 14) return "text-[clamp(44px,6.5vw,108px)]";
  return "text-[clamp(56px,9vw,140px)]";
}

// View and edit share one spot: the title swaps for a field, Save and Cancel.
export function MovieEditor({ movie }: { movie: string }) {
  const setMovie = useSetMovie();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    editButton.current?.focus();
  }, [editing]);

  function close() {
    returnFocus.current = true;
    setError(null);
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") close();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = normalizeMovie(new FormData(event.currentTarget).get("movie"));
    if (!title.ok) return setError(title.message);

    close();
    if (title.value === movie) return;

    const previous = movie;
    setMovie.mutate(title.value, {
      onSuccess: () => {
        if (movieKey(previous) === movieKey(title.value))
          return notify.success("Favorite movie updated.");
        notify.loading(`Saved. Generating a fact about ${title.value}…`, FACT_TOAST);
      },
      onError: (failure) => {
        if (isUnauthenticated(failure)) return;
        notify.error(`Couldn't save "${title.value}". Your favorite is still ${previous}.`);
      },
    });
  }

  return (
    <div className="pt-[clamp(24px,6vh,72px)]">
      <p id="movie-label" className="mb-3 text-sm font-bold">
        Your favorite movie
      </p>

      {editing ? (
        <form
          noValidate
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          className="grid max-w-[960px] grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <Field
            label="Favorite movie"
            hideLabel
            name="movie"
            defaultValue={movie}
            autoComplete="off"
            maxLength={140}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            error={error}
            className="rounded-pill px-6 py-3.5 text-[clamp(22px,3vw,32px)] font-bold"
          />
          <Button type="submit">
            <Icon name="check" />
            Save
          </Button>
          <Button type="button" variant="outline" onClick={close}>
            <Icon name="x" />
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <h1
            className={cn(
              // Size first: cn drops a leading-* that comes before a text-* size.
              titleSize(movie),
              "font-display leading-[0.85] [overflow-wrap:break-word] [text-wrap:balance]",
            )}
          >
            {movie}
          </h1>
          <Button
            ref={editButton}
            variant="outline"
            size="sm"
            aria-describedby="movie-label"
            onClick={() => setEditing(true)}
          >
            <Icon name="pencil" />
            Edit
          </Button>
        </div>
      )}

      {setMovie.isPending && (
        <p className="mt-3 inline-flex items-center gap-2 font-bold">
          <Icon name="refresh-cw" className="animate-spin" />
          Saving
        </p>
      )}
    </div>
  );
}
