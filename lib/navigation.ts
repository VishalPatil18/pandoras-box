// A full page load clears every cached query, which is what signing out needs.
export function goToLanding(): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- client routing would keep the old user's cache.
  window.location.assign("/");
}
