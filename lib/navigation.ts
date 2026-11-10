import type { FlashKey } from "@/lib/notify";

// A full page load, not client routing, so the signed-out user's cached queries are gone.
export function goToLanding(flash?: FlashKey): void {
  window.location.assign(flash ? `/?toast=${flash}` : "/");
}
