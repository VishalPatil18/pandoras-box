"use client";

import { Icon } from "@/components/icons";
import { NewFactButton } from "@/components/dashboard/new-fact-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatAge, useNow } from "@/lib/countdown";
import { useFact } from "@/lib/queries";

const FALLBACK_NOTICE = "Couldn't get a fresh fact, so here's your last one.";
const GENERIC_ERROR = "Couldn't load a fact. Try again in a moment.";

function Skeleton() {
  return (
    <div className="grid gap-3.5" aria-hidden="true">
      {["w-full", "w-[88%]", "w-[54%]"].map((width) => (
        <span key={width} className={`h-5 animate-pulse rounded-pill bg-mist ${width}`} />
      ))}
    </div>
  );
}

function FactAge({ generatedAt }: { generatedAt: string }) {
  const now = useNow();
  const seconds = Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 1_000));
  return <span>Generated {formatAge(seconds)}</span>;
}

// The fact printed on an admission ticket: white body, Sunburst stub, perforation with notches.
export function FactTicket({
  movieTitle,
  movieKey,
  paused,
}: {
  movieTitle: string;
  movieKey: string;
  paused: boolean;
}) {
  const fact = useFact(movieKey, { enabled: !paused });
  const loading = paused || fact.isPending;
  const failed = fact.isError && !loading;

  return (
    <section aria-label="Your movie fact" className="max-w-[1120px]">
      <article
        aria-live="polite"
        aria-busy={loading || fact.isFetching}
        className="relative grid grid-cols-1 rounded-card-xl border border-carbon bg-paper [--stub:clamp(120px,16vw,200px)] md:grid-cols-[minmax(0,1fr)_var(--stub)]"
      >
        <div className="grid min-h-60 content-start gap-6 p-[clamp(24px,4vw,48px)]">
          {loading && <Skeleton />}

          {failed && (
            <div className="grid justify-items-start gap-4">
              <span className="grid size-11 -rotate-6 place-items-center rounded-[14px] border border-carbon bg-ember">
                <Icon name="triangle-alert" />
              </span>
              <p className="max-w-[40ch] text-[clamp(18px,1.8vw,22px)]">
                {fact.error instanceof ApiError ? fact.error.message : GENERIC_ERROR}
              </p>
              <Button size="sm" onClick={() => fact.refetch()}>
                <Icon name="rotate-ccw" />
                Try again
              </Button>
            </div>
          )}

          {!loading && !failed && fact.data && (
            <div
              key={fact.data.fact.generatedAt}
              className="grid animate-in gap-6 duration-700 ease-out-expo fade-in slide-in-from-top-1"
            >
              <p className="max-w-[52ch] text-[clamp(20px,2vw,24px)] leading-[1.35] text-pretty">
                {fact.data.fact.text}
              </p>
              {fact.data.source === "fallback" && (
                <p className="flex items-center gap-2.5 text-sm font-bold">
                  <span className="grid size-7 place-items-center rounded-pill border border-carbon bg-lavender">
                    <Icon name="info" className="size-4" />
                  </span>
                  {FALLBACK_NOTICE}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" />
                  <FactAge generatedAt={fact.data.fact.generatedAt} />
                </span>
                <Badge>
                  <Icon name="sparkles" />
                  AI-generated, may be inaccurate
                </Badge>
              </div>
            </div>
          )}
        </div>

        <div className="grid place-items-start rounded-b-card-xl border-t border-dashed border-carbon bg-sun px-6 py-4 md:place-items-center md:rounded-r-card-xl md:rounded-bl-none md:border-t-0 md:border-l md:px-3 md:py-6">
          <p className="font-display text-[28px] leading-[0.8] md:max-h-[280px] md:rotate-180 md:overflow-hidden md:text-[clamp(24px,3vw,40px)] md:text-ellipsis md:whitespace-nowrap md:[writing-mode:vertical-rl]">
            {movieTitle}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="absolute -top-4 right-[calc(var(--stub)-15px)] hidden size-[30px] rounded-full border border-carbon bg-paper [clip-path:inset(50%_0_0_0)] md:block"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-4 right-[calc(var(--stub)-15px)] hidden size-[30px] rounded-full border border-carbon bg-paper [clip-path:inset(0_0_50%_0)] md:block"
        />
      </article>

      {!failed && (
        <div className="mt-6 flex justify-end">
          <NewFactButton
            secondsUntilRefresh={fact.data?.secondsUntilRefresh ?? 0}
            receivedAt={fact.dataUpdatedAt}
            fetching={loading || fact.isFetching}
            onClick={() => fact.refetch()}
          />
        </div>
      )}
    </section>
  );
}
