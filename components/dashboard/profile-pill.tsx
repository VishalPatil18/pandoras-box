"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import type { Me } from "@/lib/contracts";
import { displayName } from "@/lib/display";
import { goToLanding } from "@/lib/navigation";

// One joined pill: who you are on the left, Log out on the right, split by a hairline.
export function ProfilePill({ me }: { me: Me }) {
  const name = displayName(me);
  const [leaving, setLeaving] = useState(false);

  async function logOut() {
    setLeaving(true);
    try {
      await authClient.signOut();
    } finally {
      // Even if the request fails, the landing page re-checks the session on load.
      goToLanding("signed-out");
    }
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-pill border border-carbon bg-paper">
      <div className="flex min-w-0 items-center gap-2.5 py-1.5 pr-3 pl-1.5 sm:pr-4">
        <Avatar src={me.image} name={name} />
        <span className="hidden min-w-0 leading-tight sm:grid">
          <span className="truncate text-sm font-bold">{name}</span>
          <span className="max-w-[26ch] truncate text-xs text-ink-soft" title={me.email}>
            {me.email}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={logOut}
        disabled={leaving}
        aria-label="Log out"
        className="flex cursor-pointer items-center gap-2 border-l border-carbon px-3.5 text-sm font-bold tracking-[0.03em] transition-colors duration-200 hover:bg-carbon hover:text-paper focus-visible:-outline-offset-4 disabled:cursor-wait disabled:opacity-60 sm:px-5"
      >
        <Icon name="log-out" />
        <span className="hidden sm:inline">{leaving ? "Logging out" : "Log out"}</span>
      </button>
    </div>
  );
}
