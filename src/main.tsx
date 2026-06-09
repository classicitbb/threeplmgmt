import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AppErrorBoundary } from "@/components/error-boundary";
import { installConsoleErrorTelemetry, installToastTelemetry, logErrorTelemetry, logSystemTelemetry } from "@/lib/system-telemetry";
import "./index.css";

// ── Global error telemetry ────────────────────────────────────────────────────

installConsoleErrorTelemetry();
installToastTelemetry();

// Catch unhandled promise rejections (e.g. fire-and-forget async calls that
// throw). We log to console and show a toast, but never crash the app.
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unhandled async error";

  // Skip noisy network errors — the offline banner already covers these.
  const isNetwork = /fetch|network|failed to fetch|load failed/i.test(message);
  if (!isNetwork) {
    console.error("[unhandledrejection]", error);
    logErrorTelemetry({
      error,
      title: "Unhandled promise rejection",
      source: "window.unhandledrejection",
      details: {
        reasonType: typeof event.reason,
      },
    });
    toast.error(message, { id: "unhandled-rejection", duration: 8_000 });
  }
});

// Log uncaught synchronous errors (belt-and-suspenders alongside ErrorBoundary).
window.addEventListener("error", (event) => {
  if (event.error) {
    console.error("[uncaught error]", event.error);
    logErrorTelemetry({
      error: event.error,
      title: "Uncaught browser error",
      source: "window.error",
      details: {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  }
});

// ── App mount ─────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

// Auto-check for new service worker every hour and prompt to reload when an
// update is ready. Skip in iframes / Lovable preview to avoid stale shells.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app") ||
    window.location.hostname.includes("id-preview--"));

if (!isInIframe && !isPreviewHost) {
  const updateSW = registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Poll for updates every 30 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 30 * 60 * 1000);
    },
    onNeedRefresh() {
      // If the tab is already in the background, apply silently — no disruption.
      if (document.hidden) {
        updateSW(true);
        return;
      }
      // Show a non-intrusive toast. Also auto-apply the next time the user
      // backgrounds the tab (e.g. locks their device between scan cycles).
      const applyWhenHidden = () => {
        if (document.hidden) {
          document.removeEventListener("visibilitychange", applyWhenHidden);
          updateSW(true);
        }
      };
      document.addEventListener("visibilitychange", applyWhenHidden);
      logSystemTelemetry({
        log_type: "info",
        severity: "info",
        title: "Toast: Update available",
        message: "A new version of Warehouse Wizard is ready. It will apply automatically in the background.",
        source: "toast.default",
        details: {
          toast: {
            method: "default",
            title: "Update available",
            options: {
              description: "A new version of Warehouse Wizard is ready. It will apply automatically in the background.",
              action: "Reload now",
            },
          },
        },
      });
      toast("Update available", {
        description: "A new version of Warehouse Wizard is ready. It will apply automatically in the background.",
        duration: 20_000,
        action: {
          label: "Reload now",
          onClick: () => {
            document.removeEventListener("visibilitychange", applyWhenHidden);
            updateSW(true);
          },
        },
      });
    },
    onOfflineReady() {
      toast.success("Ready to work offline");
    },
  });
} else {
  // In preview / iframe: aggressively unregister any pre-existing SW
  // and clear caches so the latest build is always served.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      const hadRegistrations = regs.length > 0;
      regs.forEach((r) => r.unregister());
      if (hadRegistrations) {
        // A SW was controlling this page — reload once after unregister
        // so the freshly-fetched bundle (not the SW-cached one) is used.
        const RELOAD_KEY = "__lovable_sw_reloaded__";
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
        }
      }
    });
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((n) => caches.delete(n));
      });
    }
  }

  // Bust HTTP cache for the app shell on every preview load by appending
  // a build/version query to the document URL when missing. This ensures
  // any intermediate caches treat each preview session as a fresh fetch.
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("v")) {
      url.searchParams.set("v", String(__APP_VERSION__) + "-" + Date.now());
      window.history.replaceState({}, "", url.toString());
    }
  } catch {
    /* no-op */
  }
}
