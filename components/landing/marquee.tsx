import { Fragment } from "react";
import { Icon } from "@/components/icons";

const MESSAGES = ["One movie", "A new fact every minute", "Sign in with Google"];

// Two identical halves let the -50% translate loop without a visible seam.
export function Marquee() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden bg-carbon text-xs font-bold tracking-[0.032em] text-paper uppercase"
    >
      <div className="flex w-max animate-marquee items-center gap-6 py-2.5">
        {[0, 1].map((half) =>
          MESSAGES.map((message) => (
            <Fragment key={`${half}-${message}`}>
              <span>{message}</span>
              <Icon name="sparkles" className="text-sun" />
            </Fragment>
          )),
        )}
      </div>
    </div>
  );
}
