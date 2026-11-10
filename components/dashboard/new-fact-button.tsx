"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/rolling-number";
import { useCountdown } from "@/lib/countdown";

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
  const remaining = useCountdown(secondsUntilRefresh, receivedAt);
  const waiting = remaining > 0;

  if (fetching) {
    return (
      <Button disabled>
        <Icon name="refresh-cw" className="animate-spin" />
        Getting a fact
      </Button>
    );
  }

  return (
    <Button onClick={onClick} disabled={waiting}>
      <Icon name={waiting ? "clock" : "sparkles"} />
      {waiting ? (
        <span>
          New fact in <RollingNumber value={remaining} />s
        </span>
      ) : (
        "New fact"
      )}
    </Button>
  );
}
