const DEVICE_ID_STORAGE_KEY = "warehouse-wizard.device-id";

function fallbackDeviceId() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.length >= 16) {
    return existing;
  }

  const next = window.crypto?.randomUUID ? window.crypto.randomUUID() : fallbackDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

export function isDesktopClient() {
  if (typeof window === "undefined") return false;
  try {
    const hasFinePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
    const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    return hasFinePointer && !isTouch;
  } catch {
    return false;
  }
}
