import {
  calculateIso6346CheckDigit,
  extractIso6346ContainerNumber,
  normalizeContainerNumber,
  validateIso6346ContainerNumber,
} from "@/lib/container-number";

describe("ISO 6346 container numbers", () => {
  it("normalizes scanned text", () => {
    expect(normalizeContainerNumber(" msku 123-456-5 ")).toBe("MSKU1234565");
  });

  it("calculates and validates the check digit", () => {
    expect(calculateIso6346CheckDigit("MSKU123456")).toBe(5);
    expect(validateIso6346ContainerNumber("MSKU1234565")).toMatchObject({ valid: true });
  });

  it("rejects invalid check digits", () => {
    expect(validateIso6346ContainerNumber("MSKU1234567")).toMatchObject({
      valid: false,
      message: "Container check digit should be 5. Check the number and try again.",
    });
  });

  it("extracts a valid container number from OCR text", () => {
    expect(extractIso6346ContainerNumber("Container: MSKU 1234565 / PO-1")).toMatchObject({
      normalized: "MSKU1234565",
      valid: true,
    });
  });

  it("extracts a valid container number from separated OCR characters", () => {
    expect(extractIso6346ContainerNumber("M S K U 1 2 3 4 5 6 5")).toMatchObject({
      normalized: "MSKU1234565",
      valid: true,
    });
  });

  it("repairs common OCR confusions by container-number position", () => {
    expect(extractIso6346ContainerNumber("M5KU I234S65")).toMatchObject({
      normalized: "MSKU1234565",
      valid: true,
    });
  });

  it("returns the invalid candidate when the check digit fails", () => {
    expect(extractIso6346ContainerNumber("Container MSKU 1234567")).toMatchObject({
      normalized: "MSKU1234567",
      valid: false,
      candidate: "MSKU1234567",
      message: "Container check digit should be 5. Check the number and try again.",
    });
  });

  it("reports when OCR does not contain a container candidate", () => {
    expect(extractIso6346ContainerNumber("dock door 12 no box code")).toMatchObject({
      valid: false,
      message: "No ISO 6346 container number was found in the scan.",
    });
  });
});
