"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import { Icon } from "@/components/icons";
import { NewFactButton } from "@/components/dashboard/new-fact-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, isUnauthenticated } from "@/lib/api";
import { formatAge, useNow } from "@/lib/countdown";
import { FACT_TOAST, notify } from "@/lib/notify";
import { useFact } from "@/lib/queries";

const FALLBACK_NOTICE = "Couldn't get a fresh fact, so here's your last one.";
const GENERIC_ERROR = "Couldn't load a fact. Try again in a moment.";
// Facts arrive as "Title (Year): text"; the prefix becomes the ticket's heading line.
const FACT_PREFIX = /^(.+?)\s*\((\d{4})\):\s*([\s\S]+)$/;

function splitFact(text: string): { heading: string | null; body: string } {
  const match = FACT_PREFIX.exec(text);
  return match
    ? { heading: `${match[1]}, ${match[2]}`, body: match[3] }
    : { heading: null, body: text };
}

// A decorative barcode derived from the title, so each movie's ticket looks its own.
// "row" lays bars left to right (phone stub); "column" stacks them top to bottom (desktop stub).
function Barcode({
  seed,
  direction,
  className,
}: {
  seed: string;
  direction: "row" | "column";
  className?: string;
}) {
  const widths = Array.from(
    { length: 26 },
    (_, i) => ((seed.charCodeAt(i % seed.length) || 7) % 3) + 1,
  );
  let offset = 0;
  const bars = widths.map((size, i) => {
    const bar = { offset, size };
    offset += size + (i % 4 === 0 ? 2 : 1);
    return bar;
  });
  const row = direction === "row";
  return (
    <svg
      aria-hidden="true"
      viewBox={row ? `0 0 ${offset} 20` : `0 0 20 ${offset}`}
      preserveAspectRatio="none"
      className={className}
    >
      {bars.map((bar) =>
        row ? (
          <rect key={bar.offset} x={bar.offset} width={bar.size} height="20" fill="currentColor" />
        ) : (
          <rect key={bar.offset} y={bar.offset} height={bar.size} width="20" fill="currentColor" />
        ),
      )}
    </svg>
  );
}

function Perforation({ printing }: { printing: boolean }) {
  const dash = cn("stroke-carbon [stroke-dasharray:7_7]", printing && "animate-perforate");
  return (
    <>
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px w-full md:hidden"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="0.5" x2="100%" y2="0.5" className={dash} />
      </svg>
      <svg
        aria-hidden="true"
        className="absolute inset-y-0 left-0 hidden h-full w-px md:block"
        preserveAspectRatio="none"
      >
        <line x1="0.5" y1="0" x2="0.5" y2="100%" className={dash} />
      </svg>
    </>
  );
}

function Printing() {
  return (
    <div className="grid gap-5" aria-label="Printing a new fact">
      <p className="inline-flex items-center gap-2 text-sm font-bold">
        <Icon name="refresh-cw" className="animate-spin" />
        Printing a new fact
      </p>
      <div className="grid gap-3.5" aria-hidden="true">
        {["w-full", "w-[88%]", "w-[54%]"].map((width, index) => (
          <span
            key={width}
            style={{ animationDelay: `${index * 160}ms` }}
            className={`h-5 animate-pulse rounded-pill bg-mist ${width}`}
          />
        ))}
      </div>
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
  const printing = loading || fact.isFetching;
  const failed = fact.isError && !printing;

  // Announce each new result once: a fresh fact, a fallback, or a cache hit that ends a pending toast.
  const announcedAt = useRef(fact.dataUpdatedAt);
  useEffect(() => {
    if (!fact.data || fact.dataUpdatedAt === announcedAt.current) return;
    announcedAt.current = fact.dataUpdatedAt;
    if (fact.data.source === "fallback") notify.warning(FALLBACK_NOTICE);
    else if (fact.data.source === "cache") notify.dismiss(FACT_TOAST);
    else notify.success("New fact ready.");
  }, [fact.data, fact.dataUpdatedAt]);

  const errorShownAt = useRef(fact.errorUpdatedAt);
  useEffect(() => {
    if (!fact.error || fact.errorUpdatedAt === errorShownAt.current) return;
    errorShownAt.current = fact.errorUpdatedAt;
    if (isUnauthenticated(fact.error)) return;
    notify.error(fact.error instanceof ApiError ? fact.error.message : GENERIC_ERROR);
  }, [fact.error, fact.errorUpdatedAt]);

  function requestNewFact() {
    notify.loading("Generating a new fact…", FACT_TOAST);
    void fact.refetch();
  }

  const content = fact.data && splitFact(fact.data.fact.text);

  return (
    <section aria-label="Your movie fact">
      <article
        aria-live="polite"
        aria-busy={printing}
        className={cn(
          "relative grid origin-bottom grid-cols-1 rounded-card-xl border border-carbon bg-paper [--stub:clamp(108px,12vw,160px)] md:grid-cols-[minmax(0,1fr)_var(--stub)]",
          printing && "animate-ticket-print",
        )}
      >
        <div className="flex flex-col gap-5 p-[clamp(20px,3vw,36px)]">
          {printing && <Printing />}

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

          {!printing && !failed && fact.data && content && (
            <div
              key={fact.data.fact.generatedAt}
              className="flex flex-1 animate-in flex-col gap-4 duration-700 ease-out-expo fade-in slide-in-from-top-2"
            >
              {content.heading && (
                <p className="font-display text-[clamp(16px,1.4vw,20px)] leading-none uppercase">
                  {content.heading}
                </p>
              )}
              <p className="max-w-[56ch] text-[clamp(18px,1.7vw,22px)] leading-[1.4] text-pretty">
                {content.body}
              </p>
              {fact.data.source === "fallback" && (
                <p className="flex items-center gap-2.5 text-sm font-bold">
                  <span className="grid size-7 place-items-center rounded-pill border border-carbon bg-lavender">
                    <Icon name="info" className="size-4" />
                  </span>
                  {FALLBACK_NOTICE}
                </p>
              )}
            </div>
          )}

          {!failed && (
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-carbon/15 pt-4">
              {!printing && fact.data ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="clock" />
                    <FactAge generatedAt={fact.data.fact.generatedAt} />
                  </span>
                  <Badge>
                    <Icon name="sparkles" />
                    AI-generated, may be inaccurate
                  </Badge>
                </div>
              ) : (
                <span />
              )}
              <NewFactButton
                secondsUntilRefresh={fact.data?.secondsUntilRefresh ?? 0}
                receivedAt={fact.dataUpdatedAt}
                fetching={printing}
                onClick={requestNewFact}
              />
            </div>
          )}
        </div>

        <div className="relative grid gap-3 rounded-b-card-xl bg-sun px-6 py-5 md:flex md:items-center md:justify-center md:rounded-r-card-xl md:rounded-bl-none md:px-3 md:py-6">
          <Perforation printing={printing} />
          {/* Phone: barcode above the name. Desktop: barcode left of the name, stretched to its height. */}
          <div className="grid gap-3 md:flex md:items-stretch md:gap-3">
            <Barcode
              seed={movieKey || "pandoras"}
              direction="row"
              className="h-7 w-full md:hidden"
            />
            <Barcode
              seed={movieKey || "pandoras"}
              direction="column"
              className="hidden w-9 self-stretch md:block"
            />
            <p
              className={cn(
                movieTitle.length > 20 ? "md:text-[26px]" : "md:text-[34px]",
                "font-display text-[28px] leading-none md:max-h-[260px] md:rotate-180 md:[writing-mode:vertical-rl]",
                printing && "animate-pulse",
              )}
            >
              {movieTitle}
            </p>
          </div>
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
    </section>
  );
}
