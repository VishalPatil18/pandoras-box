"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { Icon } from "@/components/icons";
import { RollingNumber } from "@/components/ui/rolling-number";
import { useCountdown } from "@/lib/countdown";

const WINDOW_SECONDS = 60;
const RING = 2 * Math.PI * 9;
const SPRING = { type: "spring", stiffness: 420, damping: 26 } as const;

// A ring that drains as the server's 60 second window runs out.
function CountdownRing({ remaining }: { remaining: number }) {
  const progress = Math.min(1, remaining / WINDOW_SECONDS);
  return (
    <svg aria-hidden="true" viewBox="0 0 22 22" className="size-[22px] -rotate-90">
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth="2.5"
      />
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={RING}
        strokeDashoffset={RING * (1 - progress)}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

// Locked until the server's 60 second window ends, so every allowed click brings a new fact.
export function NewFactButton({
  secondsUntilRefresh,
  receivedAt,
  fetching,
  onClick,
}: {
  secondsUntilRefresh: number;
  receivedAt: number;
  fetching: boolean;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const remaining = useCountdown(secondsUntilRefresh, receivedAt);
  const waiting = remaining > 0;
  const ready = !fetching && !waiting;
  const state = fetching ? "fetching" : waiting ? "waiting" : "ready";

  return (
    <motion.button
      type="button"
      layout={!reduceMotion}
      onClick={onClick}
      disabled={!ready}
      whileHover={ready && !reduceMotion ? { y: -2 } : undefined}
      whileTap={ready && !reduceMotion ? { scale: 0.95 } : undefined}
      transition={SPRING}
      className={cn(
        "group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-pill border border-carbon py-2 pr-4 pl-2.5 text-sm font-bold tracking-[0.03em] transition-colors duration-300",
        ready ? "bg-carbon text-paper" : "cursor-not-allowed bg-paper text-carbon",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.9 }}
          transition={SPRING}
        >
          {state === "fetching" && (
            <>
              <Icon name="refresh-cw" className="size-[22px] animate-spin p-0.5" />
              Getting a fact
            </>
          )}
          {state === "waiting" && (
            <>
              <CountdownRing remaining={remaining} />
              <span>
                New fact in <RollingNumber value={remaining} />s
              </span>
            </>
          )}
          {state === "ready" && (
            <>
              <motion.span
                className="grid size-[22px] place-items-center rounded-pill bg-sun text-carbon transition-transform duration-300 group-hover:rotate-45"
                initial={reduceMotion ? false : { rotate: -120, scale: 0.4 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ ...SPRING, delay: 0.05 }}
              >
                <Icon name="sparkles" className="size-3.5" />
              </motion.span>
              New fact
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
