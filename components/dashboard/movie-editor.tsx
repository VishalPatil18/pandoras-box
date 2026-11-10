"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { isUnauthenticated } from "@/lib/api";
import { normalizeMovie } from "@/lib/movie";
import { useSetMovie } from "@/lib/queries";

// View and edit share one spot: the title swaps for a field, Save and Cancel.
export function MovieEditor({ movie }: { movie: string }) {
  const setMovie = useSetMovie();
  const toast = useToast();
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
      onError: (failure) => {
        if (isUnauthenticated(failure)) return;
        toast.show(`Couldn't save "${title.value}". Your favorite is still ${previous}.`);
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
          <h1 className="font-display text-[clamp(56px,9vw,140px)] leading-[0.8] [overflow-wrap:anywhere]">
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
