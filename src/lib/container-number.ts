const ISO6346_PATTERN = /^[A-Z]{3}[UJZ]\d{7}$/;

const LETTER_VALUES: Record<string, number> = {
  A: 10,
  B: 12,
  C: 13,
  D: 14,
  E: 15,
  F: 16,
  G: 17,
  H: 18,
  I: 19,
  J: 20,
  K: 21,
  L: 23,
  M: 24,
  N: 25,
  O: 26,
  P: 27,
  Q: 28,
  R: 29,
  S: 30,
  T: 31,
  U: 32,
  V: 34,
  W: 35,
  X: 36,
  Y: 37,
  Z: 38,
};

export type ContainerNumberValidation = {
  normalized: string;
  valid: boolean;
  message: string;
};

export type ContainerNumberScanResult = {
  normalized: string;
  valid: boolean;
  candidate?: string;
  message: string;
};

export function normalizeContainerNumber(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function calculateIso6346CheckDigit(codeWithoutCheckDigit: string) {
  const code = normalizeContainerNumber(codeWithoutCheckDigit).slice(0, 10);
  if (!/^[A-Z]{3}[UJZ]\d{6}$/.test(code)) return null;

  const total = Array.from(code).reduce((sum, char, index) => {
    const value = /\d/.test(char) ? Number(char) : LETTER_VALUES[char];
    if (value == null) return sum;
    return sum + value * (2 ** index);
  }, 0);
  const remainder = total % 11;
  return remainder === 10 ? 0 : remainder;
}

export function validateIso6346ContainerNumber(value: unknown): ContainerNumberValidation {
  const normalized = normalizeContainerNumber(value);
  if (!normalized) {
    return {
      normalized,
      valid: false,
      message: "Enter a container number before saving.",
    };
  }
  if (!ISO6346_PATTERN.test(normalized)) {
    return {
      normalized,
      valid: false,
      message: "Enter a valid ISO 6346 container number: 4 letters, 7 digits.",
    };
  }
  const expected = calculateIso6346CheckDigit(normalized.slice(0, 10));
  const actual = Number(normalized.slice(10));
  if (expected !== actual) {
    return {
      normalized,
      valid: false,
      message: `Container check digit should be ${expected}. Check the number and try again.`,
    };
  }
  return {
    normalized,
    valid: true,
    message: "Valid ISO 6346 container number.",
  };
}

export function extractIso6346ContainerNumber(value: unknown): ContainerNumberScanResult {
  const text = normalizeContainerNumber(value);
  const candidates = text.match(/[A-Z]{3}[UJZ]\d{7}/g) ?? [];
  for (const candidate of candidates) {
    const validation = validateIso6346ContainerNumber(candidate);
    if (validation.valid) {
      return { ...validation, candidate };
    }
  }
  if (candidates[0]) {
    const validation = validateIso6346ContainerNumber(candidates[0]);
    return { ...validation, candidate: candidates[0] };
  }
  return {
    normalized: text,
    valid: false,
    message: "No ISO 6346 container number was found in the scan.",
  };
}
