import { useCallback, useEffect, useState } from "react";

/**
 * Thin wrapper around the browser Notification permission API.
 *
 * `"unsupported"` covers browsers/webviews without `window.Notification`
 * (some in-app/Android TWA contexts). Callers should treat it the same as
 * `"denied"` — there is nothing to request.
 */
export type NotificationPermissionState = "unsupported" | NotificationPermission;

function readPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function useNotificationPermission() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermissionState>(readPermission);

  useEffect(() => {
    if (!supported) return;
    // There is no cross-browser "permission changed" event, so re-check
    // whenever the tab regains focus (covers the user granting/denying via
    // the browser's site-settings UI in another tab).
    const recheck = () => setPermission(readPermission());
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [supported]);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (!supported) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      setPermission("denied");
      return "denied";
    }
  }, [supported]);

  return { supported, permission, requestPermission };
}
