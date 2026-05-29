import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LocationLabelPageProps {
  code: string;
  aisle?: string | null;
  bay?: string | null;
  level?: number | null;
  locationType?: string | null;
  temperatureClass?: string;
  warehouseCode?: string | null;
  zoneCode?: string | null;
  warehouseName?: string;
  zoneName?: string;
  trigger?: React.ReactNode;
}

const TEMP_COLOURS: Record<string, string> = {
  ambient: "#1a1a2e",
  cool: "#1565c0",
  frozen: "#4a148c",
};

const TEMP_LABELS: Record<string, string> = {
  ambient: "Ambient",
  cool: "Cool (2–8 °C)",
  frozen: "Frozen (−20 °C)",
};

const TYPE_LABELS: Record<string, string> = {
  rack: "Rack",
  staging: "Staging",
  quarantine: "Quarantine",
  dispatch: "Dispatch",
  receiving: "Receiving",
  floor: "Floor",
  returns: "Returns",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function MachineCodePreview({ code }: { code: string }) {
  return <QRCodeSVG value={code} size={132} level="M" />;
}

export function LocationLabelPage(props: LocationLabelPageProps) {
  const {
    code,
    aisle,
    bay,
    level,
    locationType,
    temperatureClass = "ambient",
    warehouseCode,
    zoneCode,
    warehouseName,
    zoneName,
    trigger,
  } = props;

  const accentColor = TEMP_COLOURS[temperatureClass] ?? TEMP_COLOURS.ambient;
  const tempLabel = TEMP_LABELS[temperatureClass] ?? temperatureClass;
  const typeLabel = locationType ? (TYPE_LABELS[locationType] ?? locationType) : null;
  const warehousePrefix = String(warehouseCode ?? "").trim();
  const zonePrefix = String(zoneCode ?? "").trim();
  const fullCodePrefix = warehousePrefix && zonePrefix ? `${warehousePrefix}-${zonePrefix}-` : "";
  const fullCode = fullCodePrefix && !code.toUpperCase().startsWith(fullCodePrefix.toUpperCase())
    ? `${fullCodePrefix}${code}`
    : code;
  const locationParts = [
    aisle ? `Aisle ${aisle}` : null,
    bay ? `Bay ${bay}` : null,
    level != null ? `Level ${level}` : null,
  ].filter(Boolean).join(" · ");

  function handlePrint() {
    const machineEl = document.getElementById(`__loc-machine-${code}`);
    const machineMarkup = machineEl?.innerHTML ?? "";

    const win = window.open("", "_blank", "width=560,height=380");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Location Label — ${escapeHtml(fullCode)}</title>
  <meta charset="utf-8" />
  <style>
    @page { size: 101.6mm 63.5mm landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 101.6mm;
      height: 63.5mm;
      background: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      padding: 4mm 5mm 3mm;
    }
    .accent-bar { width: 100%; height: 5px; background: ${accentColor}; border-radius: 2px; margin-bottom: 3mm; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; margin-bottom: 2mm; }
    .location-code { font-size: 22pt; font-weight: 800; letter-spacing: 0.01em; color: #000; line-height: 1; }
    .badges { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .badge { font-size: 7pt; font-weight: 600; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
    .temp-badge { background: ${accentColor}; color: #fff; }
    .type-badge { border: 1.5px solid ${accentColor}; color: ${accentColor}; }
    .sub { font-size: 8.5pt; color: #555; margin-bottom: 2mm; }
    .barcode-wrap { display: flex; justify-content: center; flex: 1; align-items: center; }
    .barcode-wrap svg { width: 100%; max-height: 18mm; }
    .qr-wrap { display: flex; justify-content: center; flex: 1; align-items: center; }
    .qr-wrap svg { width: 30mm; height: 30mm; }
    .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 2mm; }
    .footer-text { font-size: 7pt; color: #aaa; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="header">
    <span class="location-code">${escapeHtml(fullCode)}</span>
    <div class="badges">
      <span class="badge temp-badge">${escapeHtml(tempLabel)}</span>
      ${typeLabel ? `<span class="badge type-badge">${escapeHtml(typeLabel)}</span>` : ""}
    </div>
  </div>
  ${locationParts ? `<p class="sub">${escapeHtml(locationParts)}</p>` : ""}
  ${zoneName ? `<p class="sub">Zone: ${escapeHtml(zoneName)}${warehouseName ? ` · ${escapeHtml(warehouseName)}` : ""}</p>` : (warehouseName ? `<p class="sub">${escapeHtml(warehouseName)}</p>` : "")}
  <div class="qr-wrap">${machineMarkup}</div>
  <div class="footer">
    <span class="footer-text">3PL Management</span>
    <span class="footer-text">${escapeHtml(new Date().toLocaleDateString())}</span>
  </div>
  <script>window.onload=()=>{window.print();window.close();}<\/script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Printer className="mr-1 h-3.5 w-3.5" />
            Label
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Location Label — {fullCode}</DialogTitle>
        </DialogHeader>

        {/* Hidden machine-code render target for print capture */}
        <div id={`__loc-machine-${code}`} className="sr-only" aria-hidden>
          <MachineCodePreview code={fullCode} />
        </div>

        {/* Preview */}
        <div
          className="rounded-lg border border-border bg-white p-4 text-black flex flex-col gap-2"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <div className="w-full h-1.5 rounded" style={{ background: accentColor }} />

          <div className="flex items-start justify-between gap-2">
            <span className="break-words text-2xl font-extrabold leading-tight tracking-tight">{fullCode}</span>
            <div className="flex flex-col items-end gap-1">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap"
                style={{ background: accentColor }}
              >
                {tempLabel}
              </span>
              {typeLabel && (
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  {typeLabel}
                </span>
              )}
            </div>
          </div>

          {locationParts && (
            <p className="text-xs text-gray-500">{locationParts}</p>
          )}
          {(zoneName || warehouseName) && (
            <p className="text-xs text-gray-500">
              {zoneName ? `Zone: ${zoneName}` : ""}
              {zoneName && warehouseName ? " · " : ""}
              {warehouseName ?? ""}
            </p>
          )}

          <div className="flex justify-center py-1">
            <MachineCodePreview code={fullCode} />
          </div>
        </div>

        <Button className="w-full" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Label
        </Button>
      </DialogContent>
    </Dialog>
  );
}
