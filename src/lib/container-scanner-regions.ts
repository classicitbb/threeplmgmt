export type NormalizedScanRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "learned" | "container-face" | "fallback";
  faceDetected: boolean;
  containerType?: "standard" | "high-cube";
};

export type ContainerFaceEstimate = {
  x: number;
  y: number;
  width: number;
  height: number;
  detected: boolean;
  containerType: "standard" | "high-cube";
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function clampRegion(region: NormalizedScanRegion): NormalizedScanRegion {
  const x = clamp(region.x);
  const y = clamp(region.y);
  const width = clamp(region.width, 0.04, 1 - x);
  const height = clamp(region.height, 0.04, 1 - y);
  return { ...region, x, y, width, height };
}

export function estimateContainerFaceFromFrame(width: number, height: number): ContainerFaceEstimate {
  const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
  const containerType = aspect > 1.35 ? "standard" : "high-cube";

  return {
    x: aspect > 1.35 ? 0.04 : 0.08,
    y: 0.06,
    width: aspect > 1.35 ? 0.92 : 0.84,
    height: 0.88,
    detected: true,
    containerType,
  };
}

function fromFace(
  face: ContainerFaceEstimate,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedScanRegion {
  return clampRegion({
    name,
    x: face.x + face.width * x,
    y: face.y + face.height * y,
    width: face.width * width,
    height: face.height * height,
    source: "container-face",
    faceDetected: face.detected,
    containerType: face.containerType,
  });
}

export function getContainerScanRegions(options: {
  frameWidth: number;
  frameHeight: number;
  learnedRegion?: NormalizedScanRegion | null;
}) {
  const face = estimateContainerFaceFromFrame(options.frameWidth, options.frameHeight);
  const regions: NormalizedScanRegion[] = [];

  if (options.learnedRegion) {
    regions.push(clampRegion({ ...options.learnedRegion, name: "learned-best-crop", source: "learned" }));
  }

  regions.push(
    fromFace(face, "top-right-number-row", 0.54, 0.10, 0.40, 0.16),
    fromFace(face, "expanded-upper-right", 0.46, 0.06, 0.50, 0.30),
    fromFace(face, "upper-band", 0.08, 0.05, 0.88, 0.28),
    fromFace(face, "right-door-panel", 0.50, 0.08, 0.46, 0.52),
    {
      name: "full-frame-paper-fallback",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      source: "fallback",
      faceDetected: false,
    },
  );

  const seen = new Set<string>();
  return regions.filter((region) => {
    const key = `${region.name}:${region.x.toFixed(3)}:${region.y.toFixed(3)}:${region.width.toFixed(3)}:${region.height.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scanRegionToPixels(region: NormalizedScanRegion, frameWidth: number, frameHeight: number) {
  return {
    x: Math.max(0, Math.round(region.x * frameWidth)),
    y: Math.max(0, Math.round(region.y * frameHeight)),
    width: Math.max(1, Math.round(region.width * frameWidth)),
    height: Math.max(1, Math.round(region.height * frameHeight)),
  };
}
