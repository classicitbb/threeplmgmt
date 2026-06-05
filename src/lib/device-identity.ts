const DEVICE_ID_STORAGE_KEY = "warehouse-wizard.device-id";
const DEVICE_TRUST_STORAGE_KEY = "warehouse-wizard.device-trust.v1";

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
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile === true) return false;

  const ua = navigator.userAgent.toLowerCase();
  const mobileOrTablet = /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const hasTouch = navigator.maxTouchPoints > 0;
  return !(mobileOrTablet || (coarsePointer && hasTouch));
}

export function markTrustedDeviceShortcut(deviceId: string) {
  if (typeof window === "undefined") return;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  window.localStorage.setItem(DEVICE_TRUST_STORAGE_KEY, JSON.stringify({ deviceId, expiresAt, isActive: true }));
}

export function hasTrustedDeviceShortcut(deviceId: string) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DEVICE_TRUST_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { deviceId?: string; expiresAt?: string; isActive?: boolean };
    return parsed.isActive === true && parsed.deviceId === deviceId && Boolean(parsed.expiresAt) && new Date(parsed.expiresAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

export function clearTrustedDeviceShortcut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEVICE_TRUST_STORAGE_KEY);
}
