import { clampRegion, type NormalizedScanRegion } from "@/lib/container-scanner-regions";

const STORAGE_KEY = "receiving.container-scanner.learning.v1";

export type ContainerScannerLearningRecord = {
  regionName: string;
  crop: Pick<NormalizedScanRegion, "x" | "y" | "width" | "height">;
  successes: number;
  oneTrySuccesses: number;
  lastAcceptedCode: string;
  lastRawText: string;
  lastSeenAt: string;
};

export type ContainerScannerSuccessSample = {
  acceptedCode: string;
  region: NormalizedScanRegion;
  rawText: string;
  attemptCount: number;
};

type LearningState = {
  records: ContainerScannerLearningRecord[];
};

function getStorage(storage?: Storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readContainerScannerLearning(storage?: Storage): LearningState {
  const store = getStorage(storage);
  if (!store) return { records: [] };
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? "{}") as Partial<LearningState>;
    return { records: Array.isArray(parsed.records) ? parsed.records.slice(0, 12) : [] };
  } catch {
    return { records: [] };
  }
}

function writeContainerScannerLearning(state: LearningState, storage?: Storage) {
  const store = getStorage(storage);
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ records: state.records.slice(0, 12) }));
  } catch {
    // Learning is opportunistic; scanner correctness must not depend on storage.
  }
}

export function getLearnedContainerScanRegion(storage?: Storage): NormalizedScanRegion | null {
  const state = readContainerScannerLearning(storage);
  const best = [...state.records].sort((a, b) => {
    const scoreA = a.oneTrySuccesses * 3 + a.successes;
    const scoreB = b.oneTrySuccesses * 3 + b.successes;
    return scoreB - scoreA || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
  })[0];
  if (!best) return null;

  return clampRegion({
    name: best.regionName,
    x: best.crop.x,
    y: best.crop.y,
    width: best.crop.width,
    height: best.crop.height,
    source: "learned",
    faceDetected: true,
  });
}

export function recordContainerScannerSuccess(sample: ContainerScannerSuccessSample, storage?: Storage) {
  const state = readContainerScannerLearning(storage);
  const regionName = sample.region.name.replace(/^learned:/, "");
  const existing = state.records.find((record) => record.regionName === regionName);
  const nextRecord: ContainerScannerLearningRecord = {
    regionName,
    crop: {
      x: sample.region.x,
      y: sample.region.y,
      width: sample.region.width,
      height: sample.region.height,
    },
    successes: (existing?.successes ?? 0) + 1,
    oneTrySuccesses: (existing?.oneTrySuccesses ?? 0) + (sample.attemptCount === 1 ? 1 : 0),
    lastAcceptedCode: sample.acceptedCode,
    lastRawText: sample.rawText.slice(0, 240),
    lastSeenAt: new Date().toISOString(),
  };

  const records = [nextRecord, ...state.records.filter((record) => record.regionName !== regionName)]
    .sort((a, b) => (b.oneTrySuccesses * 3 + b.successes) - (a.oneTrySuccesses * 3 + a.successes))
    .slice(0, 12);

  writeContainerScannerLearning({ records }, storage);
}

export const CONTAINER_SCANNER_LEARNING_STORAGE_KEY = STORAGE_KEY;
