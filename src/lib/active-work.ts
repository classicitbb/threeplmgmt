/**
 * Tracks whether an operator currently has a scan/confirm flow in progress
 * (e.g. mid put-away, mid pick, receiving dialog open). Background refresh
 * and service-worker reloads consult this to avoid blanking out active work.
 *
 * Reference-counted so multiple concurrent flows compose correctly.
 */
let active = 0;

export function beginActiveWork(): () => void {
  active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = Math.max(0, active - 1);
  };
}

export function isActiveWorkInProgress(): boolean {
  return active > 0;
}

/** Test helper — reset the counter. Not used in production code. */
export function __resetActiveWorkForTests(): void {
  active = 0;
}