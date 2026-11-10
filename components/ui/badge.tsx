import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-carbon bg-lavender px-3 py-1.5 text-xs font-bold tracking-[0.03em]">
      {children}
    </span>
  );
}
