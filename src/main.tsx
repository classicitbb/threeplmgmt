import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

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
      // Poll for updates every hour
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
    onNeedRefresh() {
      toast("Update available", {
        description: "A new version of Warehouse Wizard is ready.",
        duration: 15_000,
        action: {
          label: "Reload",
          onClick: () => updateSW(true),
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
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((n) => caches.delete(n));
      });
    }
  }
}
