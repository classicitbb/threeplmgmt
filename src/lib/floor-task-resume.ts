type NullableScopeValue = string | null | undefined;

export interface PutawayResumeScanState {
  pallet: string;
  location: string;
  override: boolean;
  reason: string;
}

export interface PutawayResumeSnapshot {
  userId?: NullableScopeValue;
  warehouseId?: NullableScopeValue;
  selectedTaskId: string | null;
  taskSearch: string;
  scanQuery: string;
  scanState: Record<string, PutawayResumeScanState>;
  bayScanState: Record<string, string>;
  openTasksExpanded: boolean;
  updatedAt: number;
}

export interface PickTaskResumeSnapshot {
  taskId: string;
  pickListId: string;
  locationCode: string;
  palletBarcode: string;
  bayScan: string;
  confirmPrompt: boolean;
  updatedAt: number;
}

export interface ReceivingResumeSnapshot<FormState = unknown> {
  userId?: NullableScopeValue;
  shipmentEntryMode: "shipment" | "pallet";
  shipmentOpen: boolean;
  showShipmentMore: boolean;
  shipmentContainerTouched: boolean;
  draftSearch: string;
  printOpen: boolean;
  printContainer: string;
  selectedDraftIds: string[];
  shipmentForm: FormState;
  updatedAt: number;
}

export interface CycleCountResumeSnapshot {
  userId?: NullableScopeValue;
  entryQty: Record<string, string>;
  exceptionReason: Record<string, string>;
  approvalReason: Record<string, string>;
  updatedAt: number;
}

const PUTAWAY_KEY = "warehouseWizard.floorResume.putaway";
const PICK_KEY_PREFIX = "warehouseWizard.floorResume.pick";
const RECEIVING_KEY = "warehouseWizard.floorResume.receiving";
const CYCLE_COUNT_KEY = "warehouseWizard.floorResume.cycle-counts";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function sameScope(left: NullableScopeValue, right: NullableScopeValue) {
  return (left ?? null) === (right ?? null);
}

export function loadPutawayResumeSnapshot(scope?: { userId?: NullableScopeValue; warehouseId?: NullableScopeValue }) {
  const snapshot = readJson<PutawayResumeSnapshot>(PUTAWAY_KEY);
  if (!snapshot) return null;
  if (!scope) return snapshot;
  if (!sameScope(snapshot.userId, scope.userId) || !sameScope(snapshot.warehouseId, scope.warehouseId)) {
    return null;
  }
  return snapshot;
}

export function savePutawayResumeSnapshot(snapshot: PutawayResumeSnapshot) {
  writeJson(PUTAWAY_KEY, snapshot);
}

export function clearPutawayResumeSnapshot() {
  removeKey(PUTAWAY_KEY);
}

function pickKey(taskId: string, pickListId: string) {
  return `${PICK_KEY_PREFIX}.${pickListId}.${taskId}`;
}

export function loadPickTaskResumeSnapshot(taskId: string, pickListId: string) {
  return readJson<PickTaskResumeSnapshot>(pickKey(taskId, pickListId));
}

export function savePickTaskResumeSnapshot(snapshot: PickTaskResumeSnapshot) {
  writeJson(pickKey(snapshot.taskId, snapshot.pickListId), snapshot);
}

export function clearPickTaskResumeSnapshot(taskId: string, pickListId: string) {
  removeKey(pickKey(taskId, pickListId));
}

export function loadReceivingResumeSnapshot<FormState = unknown>(scope?: { userId?: NullableScopeValue }) {
  const snapshot = readJson<ReceivingResumeSnapshot<FormState>>(RECEIVING_KEY);
  if (!snapshot) return null;
  if (!scope) return snapshot;
  if (!sameScope(snapshot.userId, scope.userId)) return null;
  return snapshot;
}

export function saveReceivingResumeSnapshot<FormState = unknown>(snapshot: ReceivingResumeSnapshot<FormState>) {
  writeJson(RECEIVING_KEY, snapshot);
}

export function clearReceivingResumeSnapshot() {
  removeKey(RECEIVING_KEY);
}

export function loadCycleCountResumeSnapshot(scope?: { userId?: NullableScopeValue }) {
  const snapshot = readJson<CycleCountResumeSnapshot>(CYCLE_COUNT_KEY);
  if (!snapshot) return null;
  if (!scope) return snapshot;
  if (!sameScope(snapshot.userId, scope.userId)) return null;
  return snapshot;
}

export function saveCycleCountResumeSnapshot(snapshot: CycleCountResumeSnapshot) {
  writeJson(CYCLE_COUNT_KEY, snapshot);
}

export function clearCycleCountResumeSnapshot() {
  removeKey(CYCLE_COUNT_KEY);
}
