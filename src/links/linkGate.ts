/**
 * The force-update gate runs before any link is handled (deep-links AD-6). `ForceUpdateGate` reports
 * its first version-policy answer here: not blocked opens the gate, blocked keeps it shut for good
 * (the blocking screen replaces the app, so no link may navigate behind it). Link sources wait on
 * `whenLinksAllowed()`. The policy check fails open after its own 5 second timeout, so a slow
 * server delays a link by at most that long.
 */
type Waiter = () => void;

let decided = false;
let blocked = false;
const waiters = new Set<Waiter>();

export function reportUpdatePolicy(isBlocked: boolean): void {
  blocked = isBlocked;
  if (!decided) {
    decided = true;
  }
  if (!blocked) {
    waiters.forEach(waiter => waiter());
    waiters.clear();
  }
}

export function linksAllowed(): boolean {
  return decided && !blocked;
}

/** Resolves once the gate is open; never resolves while the app is blocked. */
export function whenLinksAllowed(): Promise<void> {
  if (linksAllowed()) {
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    waiters.add(resolve);
  });
}

/** Test helper. */
export function _resetLinkGateForTesting(): void {
  decided = false;
  blocked = false;
  waiters.clear();
}
