"use client";

import { toast } from "notch-toast";

// Every toast in the app goes through here, so the library sits behind one small module.
export const TOAST_MS = 5_000;
// Long enough to outlast a slow generation; the result replaces it.
const LOADING_MS = 20_000;
export const FACT_TOAST = "fact";

export const notify = {
  success: (title: string) => toast.success(title, { duration: TOAST_MS }),
  error: (title: string) => toast.error(title, { duration: TOAST_MS }),
  warning: (title: string) => toast.warning(title, { duration: TOAST_MS }),
  info: (title: string) => toast.info(title, { duration: TOAST_MS }),
  loading: (title: string, id: string) => toast.loading(title, { id, duration: LOADING_MS }),
  dismiss: (id: string) => toast.dismiss(id),
};

// Messages that survive a full page load travel as ?toast=<key>.
export const FLASH_MESSAGES = {
  "signed-in": () => notify.success("You're signed in."),
  "signed-out": () => notify.info("You're signed out. See you soon."),
  onboarded: () => notify.success("Saved. Your first fact is on its way."),
  "session-expired": () => notify.warning("Your session ended. Sign in again."),
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function isFlashKey(value: unknown): value is FlashKey {
  return typeof value === "string" && value in FLASH_MESSAGES;
}
