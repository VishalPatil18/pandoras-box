"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1_000;

// Re-renders once a second so ages and countdowns stay current.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Counts down from when the response arrived, so the browser's clock never decides the window.
export function useCountdown(seconds: number, receivedAt: number): number {
  const now = useNow();
  const elapsedSeconds = Math.floor(Math.max(0, now - receivedAt) / 1_000);
  return Math.max(0, seconds - elapsedSeconds);
}

export function formatAge(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
