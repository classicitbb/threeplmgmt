import { useCallback, useEffect, useSyncExternalStore } from "react";

import { confirmPickTask, confirmPutaway } from "@/lib/wms-core";

/**
 * Offline work queue.
 *
 * Buffers high-value warehouse-floor actions (putaway confirmation, pick task
 * confirmation) to IndexedDB when the device cannot reach the backend, then
 * replays them in order on reconnect or on explicit retry. The goal is that
 * an operator who walks into a dead spot can keep scanning, then sync with a
 * single tap when their connection returns — no app restart required.
 */

const DB_NAME = "ww-offline-queue";
const DB_VERSION = 1;
const STORE = "work";

export type OfflineWorkKind = "putaway" | "pick";

export interface OfflinePutawayPayload {
  taskId: string;
  pallet: string;
  location: string;
  override?: boolean;
  reason?: string;
  taskNumber?: string;
}

export interface OfflinePickPayload {
  taskId: string;
  pickListId?: string;
  locationCode: string;
  palletBarcode: string;
  quantity: number;
  shortReason?: string;
}

export type OfflineWorkPayload = OfflinePutawayPayload | OfflinePickPayload;

export interface OfflineWorkItem<T extends OfflineWorkPayload = OfflineWorkPayload> {
  id: string;
  kind: OfflineWorkKind;
  payload: T;
  createdAt: number;
  attempts: number;
  lastError?: string;
  lastTriedAt?: number;
}

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result: T;
    Promise.resolve(fn(store))
      .then((value) => {
        result = value;
      })
      .catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error("IndexedDB tx failed"));
    t.onabort = () => reject(t.error ?? new Error("IndexedDB tx aborted"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------- in-memory mirror + pubsub ------------------------ */

let cache: OfflineWorkItem[] = [];
let initialized = false;
let initPromise: Promise<void> | null = null;
let isFlushing = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setCache(next: OfflineWorkItem[]) {
  cache = [...next].sort((a, b) => a.createdAt - b.createdAt);
  emit();
}

async function ensureInit() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!hasIndexedDB()) {
      initialized = true;
      return;
    }
    try {
      const rows = await tx<OfflineWorkItem[]>("readonly", (store) => reqToPromise(store.getAll() as IDBRequest<OfflineWorkItem[]>));
      setCache(rows ?? []);
    } catch (err) {
      console.error("[offline-queue] init failed", err);
    } finally {
      initialized = true;
    }
  })();
  return initPromise;
}

export function subscribeOfflineQueue(listener: () => void) {
  listeners.add(listener);
  void ensureInit();
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineQueueSnapshot(): OfflineWorkItem[] {
  return cache;
}

/* ------------------------------ enqueue / drain ----------------------------- */

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueOfflineWork<T extends OfflineWorkPayload>(
  kind: OfflineWorkKind,
  payload: T,
): Promise<OfflineWorkItem<T>> {
  await ensureInit();
  const item: OfflineWorkItem<T> = {
    id: genId(),
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  if (hasIndexedDB()) {
    try {
      await tx("readwrite", (store) => reqToPromise(store.put(item)));
    } catch (err) {
      console.error("[offline-queue] enqueue persist failed", err);
    }
  }
  setCache([...cache, item as OfflineWorkItem]);
  return item;
}

async function removeItem(id: string) {
  if (hasIndexedDB()) {
    try {
      await tx("readwrite", (store) => reqToPromise(store.delete(id)));
    } catch (err) {
      console.error("[offline-queue] delete failed", err);
    }
  }
  setCache(cache.filter((it) => it.id !== id));
}

async function updateItem(item: OfflineWorkItem) {
  if (hasIndexedDB()) {
    try {
      await tx("readwrite", (store) => reqToPromise(store.put(item)));
    } catch (err) {
      console.error("[offline-queue] update failed", err);
    }
  }
  setCache(cache.map((it) => (it.id === item.id ? item : it)));
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|networkerror|load failed|connection lost|offline|fetch failed|err_network/i.test(msg);
}

async function runItem(item: OfflineWorkItem): Promise<void> {
  if (item.kind === "putaway") {
    const p = item.payload as OfflinePutawayPayload;
    await confirmPutaway(p.taskId, p.pallet, p.location, { override: p.override, overrideReason: p.reason });
    return;
  }
  if (item.kind === "pick") {
    const p = item.payload as OfflinePickPayload;
    await confirmPickTask(p.taskId, p.locationCode, p.palletBarcode, p.quantity, p.shortReason);
    return;
  }
  throw new Error(`Unknown offline work kind: ${(item as OfflineWorkItem).kind}`);
}

export interface FlushResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

let flushSubscribers = new Set<(syncing: boolean) => void>();
export function subscribeFlushState(cb: (syncing: boolean) => void) {
  flushSubscribers.add(cb);
  cb(isFlushing);
  return () => flushSubscribers.delete(cb);
}
function setFlushing(v: boolean) {
  isFlushing = v;
  flushSubscribers.forEach((cb) => cb(v));
}

/**
 * Drain queued items sequentially. Aborts on the first network-style error so
 * the queue order is preserved and the operator can retry once back online.
 */
export async function flushOfflineQueue(options?: { silent?: boolean }): Promise<FlushResult> {
  await ensureInit();
  if (isFlushing) return { succeeded: 0, failed: 0, remaining: cache.length };
  setFlushing(true);
  let succeeded = 0;
  let failed = 0;
  try {
    const snapshot = [...cache];
    for (const item of snapshot) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      const next: OfflineWorkItem = { ...item, attempts: item.attempts + 1, lastTriedAt: Date.now() };
      try {
        await runItem(next);
        await removeItem(item.id);
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isLikelyNetworkError(err)) {
          await updateItem({ ...next, lastError: message });
          failed += 1;
          break; // stop draining; wait for next reconnect / manual retry
        }
        // Permanent/business failure — surface but drop so the queue isn't wedged.
        await removeItem(item.id);
        failed += 1;
        if (!options?.silent) {
          console.error("[offline-queue] item dropped after non-retryable error", item, err);
        }
      }
    }
  } finally {
    setFlushing(false);
  }
  return { succeeded, failed, remaining: cache.length };
}

export async function clearOfflineQueue() {
  if (hasIndexedDB()) {
    try {
      await tx("readwrite", (store) => reqToPromise(store.clear()));
    } catch (err) {
      console.error("[offline-queue] clear failed", err);
    }
  }
  setCache([]);
}

/* ---------------------------------- hooks ---------------------------------- */

const emptySnapshot: OfflineWorkItem[] = [];
function getSnapshot() {
  return cache.length === 0 ? emptySnapshot : cache;
}

export function useOfflineQueue() {
  const items = useSyncExternalStore(subscribeOfflineQueue, getSnapshot, getSnapshot);
  const syncing = useSyncExternalStore(
    (cb) => subscribeFlushState(() => cb()),
    () => isFlushing,
    () => false,
  );
  const retry = useCallback(() => flushOfflineQueue(), []);
  return { items, count: items.length, syncing, retry };
}

/* ------------------------- auto-replay on reconnect ------------------------- */

let listenersInstalled = false;
export function installOfflineAutoReplay() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  const handler = () => {
    void ensureInit().then(() => {
      if (cache.length > 0) {
        void flushOfflineQueue({ silent: true });
      }
    });
  };
  window.addEventListener("online", handler);
  // Also try on first load (in case we boot already online with a stale queue).
  void ensureInit().then(() => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      if (cache.length > 0) void flushOfflineQueue({ silent: true });
    }
  });
}

export function useInstallOfflineAutoReplay() {
  useEffect(() => {
    installOfflineAutoReplay();
  }, []);
}
