import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BarcodeScanButtonProps {
  onScan: (value: string) => void;
  title?: string;
  className?: string;
  enableTextRecognition?: boolean;
}

const BARCODE_FORMATS = [
  "qr_code", "code_128", "code_39", "code_93",
  "ean_13", "ean_8", "upc_a", "upc_e",
  "data_matrix", "pdf417", "aztec",
];

export function BarcodeScanButton({ onScan, title = "Scan barcode", className, enableTextRecognition = false }: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const textDetectorRef = useRef<any>(null);
  const lastTextScanRef = useRef(0);

  const stopStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    textDetectorRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setDetected(null);
      return;
    }

    let cancelled = false;

    async function start() {
      const supportsBarcode = "BarcodeDetector" in window;
      const supportsText = enableTextRecognition && "TextDetector" in window;
      if (!supportsBarcode && !supportsText) {
        setError(enableTextRecognition
          ? "Live scanning or text recognition is not available on this device. Type the code manually instead."
          : "Live scanning requires Chrome on Android or Safari 17+. Type the code manually instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (supportsBarcode) {
          // Use formats that the device supports (BarcodeDetector.getSupportedFormats exists in spec)
          let formats = BARCODE_FORMATS;
          try {
            const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
            formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
          } catch {
            // getSupportedFormats not available — use all; constructor will ignore unknowns
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
            const now = Date.now();
            let detectedText: Array<{ rawValue?: string; text?: string }> = [];
            if (codes.length === 0 && textDetectorRef.current && now - lastTextScanRef.current > 750) {
              lastTextScanRef.current = now;
              detectedText = await textDetectorRef.current.detect(videoRef.current);
            }
            const value = codes[0]?.rawValue ?? detectedText.map((item) => item.rawValue ?? item.text ?? "").filter(Boolean).join(" ");
            if (value) {
              if (cancelled) return;
              setDetected(value);
              stopStream();
              // Brief green flash before closing
              setTimeout(() => {
                if (!cancelled) {
                  onScan(value);
                  setOpen(false);
                }
              }, 500);
              return;
            }
          } catch {
            // Frame not ready yet — keep scanning
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
    };
  }, [enableTextRecognition, open, onScan, stopStream]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`h-10 w-10 shrink-0 ${className ?? ""}`}
        title={title}
        onClick={() => setOpen(true)}
        aria-label={title}
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>

          {detected ? (
            <div className="rounded-md bg-green-50 p-4 text-center dark:bg-green-950/30">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Scanned</p>
              <p className="font-mono text-lg font-semibold text-green-800 dark:text-green-200 break-all">{detected}</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              {/* Live camera feed */}
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {/* Scan reticle overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-36 w-64">
                  {/* Darkened surround */}
                  <div className="absolute inset-0 rounded shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  {/* Corner brackets */}
                  <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white rounded-tl" />
                  <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white rounded-tr" />
                  <div className="absolute left-0 bottom-0 h-6 w-6 border-l-2 border-b-2 border-white rounded-bl" />
                  <div className="absolute right-0 bottom-0 h-6 w-6 border-r-2 border-b-2 border-white rounded-br" />
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {detected ? "Loading…" : enableTextRecognition ? "Point your camera at a QR code, barcode, or container number" : "Point your camera at a barcode or QR code"}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
