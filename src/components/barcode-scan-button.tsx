import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ScanValidationResult = {
  valid: boolean;
  value?: string;
  message?: string;
};

interface BarcodeScanButtonProps {
  onScan: (value: string) => void;
  title?: string;
  buttonLabel?: string;
  className?: string;
  disabled?: boolean;
  enableTextRecognition?: boolean;
  requireConfirm?: boolean;
  statusText?: string;
  validateScan?: (raw: string) => ScanValidationResult;
  /** After scan is accepted, simulate Enter keydown on this input to advance focus. */
  inputRef?: RefObject<HTMLInputElement | null>;
}

type PendingScan = {
  raw: string;
  value: string;
  message?: string;
};

const BARCODE_FORMATS = [
  "qr_code", "code_128", "code_39", "code_93",
  "ean_13", "ean_8", "upc_a", "upc_e",
  "data_matrix", "pdf417", "aztec",
];

const OCR_SCAN_INTERVAL_MS = 1800;

function getScanCandidate(raw: string, validateScan?: (raw: string) => ScanValidationResult) {
  if (!validateScan) return { valid: true, value: raw, raw };

  const result = validateScan(raw);
  return {
    valid: result.valid,
    value: result.value ?? raw,
    raw,
    message: result.message,
  };
}

async function recognizeTextFromVideo(video: HTMLVideoElement) {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const cropWidth = Math.round(width * 0.68);
  const cropHeight = Math.round(height * 0.44);
  const sourceX = Math.max(0, Math.round((width - cropWidth) / 2));
  const sourceY = Math.max(0, Math.round((height - cropHeight) / 2));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.drawImage(video, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const image = canvas.toDataURL("image/png");
  const tesseract = await import("tesseract.js");
  const result = await (tesseract as any).recognize(image, "eng");
  return String(result?.data?.text ?? "");
}

export function BarcodeScanButton({
  onScan,
  title = "Scan barcode",
  buttonLabel,
  className,
  disabled = false,
  enableTextRecognition = false,
  requireConfirm = false,
  statusText,
  validateScan,
  inputRef,
}: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const pendingScanRef = useRef<PendingScan | null>(null);
  const acceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const textDetectorRef = useRef<any>(null);
  const lastTextScanRef = useRef(0);
  const ocrBusyRef = useRef(false);

  const stopStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    textDetectorRef.current = null;
  }, []);

  const acceptScan = useCallback((value: string) => {
    setDetected(value);
    setPendingScan(null);
    pendingScanRef.current = null;
    stopStream();
    setTimeout(() => {
      onScan(value);
      setOpen(false);
      if (inputRef?.current) {
        inputRef.current.focus();
        inputRef.current.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      }
    }, 400);
  }, [inputRef, onScan, stopStream]);

  const handleScanValue = useCallback((rawValue: string, source: "barcode" | "text" | "ocr") => {
    const candidate = getScanCandidate(rawValue, validateScan);
    if (!candidate.valid) {
      if (validateScan || source !== "barcode") {
        setScanMessage(candidate.message ?? "No usable scan was found. Keep the code centered and try again.");
      }
      return false;
    }

    const pending = { raw: rawValue, value: candidate.value, message: candidate.message };
    if (requireConfirm) {
      pendingScanRef.current = pending;
      setPendingScan(pending);
      setScanMessage(candidate.message ?? "Valid scan recognized. Confirm to insert.");
      stopStream();
      return true;
    }

    if (source === "text" || source === "ocr") {
      pendingScanRef.current = pending;
      setPendingScan(pending);
      setScanMessage(candidate.message ?? "Text recognized. Insert will continue automatically.");
      if (acceptTimerRef.current != null) clearTimeout(acceptTimerRef.current);
      acceptTimerRef.current = setTimeout(() => {
        if (pendingScanRef.current?.value === pending.value) {
          acceptScan(pending.value);
        }
      }, 1500);
      return true;
    }

    acceptScan(candidate.value);
    return true;
  }, [acceptScan, requireConfirm, stopStream, validateScan]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setDetected(null);
      setPendingScan(null);
      setScanMessage(null);
      pendingScanRef.current = null;
      ocrBusyRef.current = false;
      if (acceptTimerRef.current != null) {
        clearTimeout(acceptTimerRef.current);
        acceptTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function start() {
      const supportsBarcode = "BarcodeDetector" in window;
      const supportsText = enableTextRecognition && "TextDetector" in window;
      const supportsOcrFallback = enableTextRecognition && typeof document !== "undefined";
      if (!supportsBarcode && !supportsText && !supportsOcrFallback) {
        setError(enableTextRecognition
          ? "Live scanning or text recognition is not available on this device. Type the code manually instead."
          : "Live scanning requires Chrome on Android or Safari 17+. Type the code manually instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (supportsBarcode) {
          let formats = BARCODE_FORMATS;
          try {
            const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
            formats = BARCODE_FORMATS.filter((format) => supported.includes(format));
          } catch {
            // getSupportedFormats is not implemented everywhere.
          }
          detectorRef.current = new (window as any).BarcodeDetector({ formats: formats.length ? formats : BARCODE_FORMATS });
        }
        if (supportsText) {
          textDetectorRef.current = new (window as any).TextDetector();
        }

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes: Array<{ rawValue: string }> = detectorRef.current
              ? await detectorRef.current.detect(videoRef.current)
              : [];
            if (codes.length > 0) {
              if (cancelled) return;
              if (handleScanValue(codes[0].rawValue, "barcode")) return;
            }

            const now = Date.now();
            if (textDetectorRef.current && now - lastTextScanRef.current > 750) {
              lastTextScanRef.current = now;
              const detectedText: Array<{ rawValue?: string; text?: string }> = await textDetectorRef.current.detect(videoRef.current);
              const ocrValue = detectedText.map((item) => item.rawValue ?? item.text ?? "").filter(Boolean).join(" ");
              if (ocrValue && !cancelled && handleScanValue(ocrValue, "text")) return;
            } else if (!textDetectorRef.current && supportsOcrFallback && !ocrBusyRef.current && now - lastTextScanRef.current > OCR_SCAN_INTERVAL_MS) {
              lastTextScanRef.current = now;
              ocrBusyRef.current = true;
              setScanMessage("Capturing image and reading container text...");
              recognizeTextFromVideo(videoRef.current)
                .then((text) => {
                  if (!cancelled && text.trim()) handleScanValue(text, "ocr");
                })
                .catch(() => {
                  if (!cancelled) setScanMessage("Text was not clear enough. Keep the container number centered.");
                })
                .finally(() => {
                  ocrBusyRef.current = false;
                });
            }
          } catch {
            // Frame not ready yet; keep scanning.
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg.includes("Permission") || msg.includes("permission")
            ? "Camera permission denied. Please allow camera access and try again."
            : `Camera error: ${msg}`);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
      if (acceptTimerRef.current != null) {
        clearTimeout(acceptTimerRef.current);
        acceptTimerRef.current = null;
      }
    };
  }, [enableTextRecognition, handleScanValue, open, stopStream]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={buttonLabel ? "default" : "icon"}
        className={cn("h-10 shrink-0", buttonLabel ? "px-3" : "w-10", className)}
        title={title}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={title}
      >
        <Camera className="h-4 w-4" />
        {buttonLabel ? <span>{buttonLabel}</span> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {statusText ?? (enableTextRecognition ? "Use the camera to scan a barcode, QR code, or readable text." : "Use the camera to scan a barcode or QR code.")}
            </DialogDescription>
          </DialogHeader>

          {detected ? (
            <div className="rounded-md bg-green-50 p-4 text-center dark:bg-green-950/30">
              <p className="mb-1 text-xs text-green-600 dark:text-green-400">Scanned</p>
              <p className="break-all font-mono text-lg font-semibold text-green-800 dark:text-green-200">{detected}</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-36 w-64">
                  <div className={cn(
                    "absolute inset-0 rounded shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
                    pendingScan && "shadow-[0_0_0_9999px_rgba(22,163,74,0.25)]",
                  )} />
                  <div className={cn("absolute left-0 top-0 h-6 w-6 rounded-tl border-l-2 border-t-2 border-white", pendingScan && "border-green-400")} />
                  <div className={cn("absolute right-0 top-0 h-6 w-6 rounded-tr border-r-2 border-t-2 border-white", pendingScan && "border-green-400")} />
                  <div className={cn("absolute bottom-0 left-0 h-6 w-6 rounded-bl border-b-2 border-l-2 border-white", pendingScan && "border-green-400")} />
                  <div className={cn("absolute bottom-0 right-0 h-6 w-6 rounded-br border-b-2 border-r-2 border-white", pendingScan && "border-green-400")} />
                </div>
              </div>
              {pendingScan && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-black/75 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-green-300">Valid text recognized</p>
                    <p className="break-all font-mono text-sm font-semibold text-white">{pendingScan.value}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 shrink-0 gap-1.5 bg-green-600 text-white hover:bg-green-700"
                    onClick={() => {
                      if (acceptTimerRef.current != null) {
                        clearTimeout(acceptTimerRef.current);
                        acceptTimerRef.current = null;
                      }
                      acceptScan(pendingScan.value);
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Use
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className={cn("text-center text-xs", scanMessage && !pendingScan ? "text-amber-500" : "text-muted-foreground")}>
            {detected ? "Loading..." : scanMessage ?? statusText ?? (enableTextRecognition ? "Point your camera at a QR code, barcode, or container number" : "Point your camera at a barcode or QR code")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
