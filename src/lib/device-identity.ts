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

const TRUSTED_DEVICE_STORAGE_PREFIX = "warehouse-wizard.trusted-device.";

export function hasTrustedDeviceShortcut(deviceId: string) {
  if (typeof window === "undefined" || !deviceId) return false;
  try {
    return window.localStorage.getItem(TRUSTED_DEVICE_STORAGE_PREFIX + deviceId) === "1";
  } catch {
    return false;
  }
}

export function setTrustedDeviceShortcut(deviceId: string, trusted: boolean) {
  if (typeof window === "undefined" || !deviceId) return;
  try {
    const key = TRUSTED_DEVICE_STORAGE_PREFIX + deviceId;
    if (trusted) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}
