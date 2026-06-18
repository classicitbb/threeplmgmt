import { describe, expect, it } from "vitest";

import { getLearnedContainerScanRegion, recordContainerScannerSuccess } from "@/lib/container-scanner-learning";
import { getContainerScanRegions, type NormalizedScanRegion } from "@/lib/container-scanner-regions";

function region(name: string, x: number): NormalizedScanRegion {
  return {
    name,
    x,
    y: 0.1,
    width: 0.25,
    height: 0.12,
    source: "container-face",
    faceDetected: true,
  };
}

describe("container scanner learning", () => {
  it("saves successful one-try crops and prioritizes them later", () => {
    const storage = window.localStorage;
    storage.clear();

    recordContainerScannerSuccess({
      acceptedCode: "MTBU0200596",
      region: region("top-right-number-row", 0.56),
      rawText: "MTBU 020059 6",
      attemptCount: 1,
    }, storage);

    const learned = getLearnedContainerScanRegion(storage);
    expect(learned).toMatchObject({
      name: "top-right-number-row",
      x: 0.56,
      source: "learned",
    });

    const regions = getContainerScanRegions({ frameWidth: 1280, frameHeight: 720, learnedRegion: learned });
    expect(regions[0]).toMatchObject({ name: "learned-best-crop", source: "learned" });
  });

  it("does not learn anything from invalid candidates", () => {
    const storage = window.localStorage;
    storage.clear();

    expect(getLearnedContainerScanRegion(storage)).toBeNull();
  });
});
