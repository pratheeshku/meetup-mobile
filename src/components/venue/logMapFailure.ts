let logged = false;

/**
 * Logs a Static Maps load failure once per app session. The request URL
 * carries the Maps API key, so neither it nor the native error payload
 * (which can echo the URL) is ever logged.
 */
export function logMapFailureOnce(): void {
  if (logged) {
    return;
  }
  logged = true;
  console.warn('[venue-map] Static Maps image failed to load; showing placeholder');
}

export function resetMapFailureLogForTests(): void {
  logged = false;
}
