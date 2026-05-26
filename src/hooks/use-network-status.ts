/**
 * @file use-network-status.ts — Browser online/offline detection and mutation guard
 *
 * assertOnline()       — Throws OFFLINE_WORK_MESSAGE if navigator.onLine is false.
 *                        Called by MutationCache.onMutate in query-client.ts to block
 *                        ALL mutations while offline. Import directly for manual guards.
 *
 * guardMutation(fn)    — Higher-order function: wraps any async fn to call assertOnline()
 *                        before executing. Used in App.tsx for confirmPickTask:
 *                        `guardMutation(confirmPickTask)(taskId, ...)`
 *
 * useNetworkStatus()   — React hook → { online: boolean }. Subscribe to online/offline
 *                        events; use in UI components to show connectivity banners.
 */

import { useEffect, useState } from "react";

export const OFFLINE_WORK_MESSAGE = "Connection lost. Work was not posted. Reconnect and try again.";

export function isAppOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function assertOnline() {
  if (!isAppOnline()) {
    throw new Error(OFFLINE_WORK_MESSAGE);
  }
}

export function useNetworkStatus() {
  const [online, setOnline] = useState(isAppOnline);

  useEffect(() => {
    const update = () => setOnline(isAppOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return { online };
}

export function guardMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
) {
  return (...args: TArgs) => {
    assertOnline();
    return fn(...args);
  };
}
