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

interface PalletLabelPageProps {
  barcode: string;
  productSku?: string;
  productName?: string;
  quantity?: number;
  lotNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  containerNumber?: string | null;
  poNumber?: string | null;
  clientName?: string | null;
  warehouseName?: string | null;
  locationCode?: string | null;
  receiptReference?: string | null;
  packaging?: string | null;
  draftSequence?: string | number | null;
  draftCount?: string | number | null;
  temperatureClass?: string;
  trigger?: React.ReactNode;
  onPrinted?: () => Promise<void> | void;
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

const EMPTY_VALUE = "________________";

function displayValue(value: unknown) {
  if (value == null || value === "") return EMPTY_VALUE;
  return String(value);
}

function hasValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}

function escapeHtml(value: unknown) {
  return displayValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function FieldBlock({ label, value, highlight }: { label: string; value: unknown; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-md border border-amber-500 bg-amber-50 px-3 py-2" : "rounded-md border border-slate-300 bg-white/70 px-3 py-2"}>
      <p className={highlight ? "text-[10px] font-bold uppercase tracking-wide text-amber-700" : "text-[10px] font-bold uppercase tracking-wide text-slate-500"}>{label}</p>
      <p className="mt-1 min-h-5 break-words text-sm font-semibold text-slate-950">{displayValue(value)}</p>
    </div>
  );
}

function BarcodePreview({ code, size = 220 }: { code: string; size?: number }) {
  if (!code) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG value={code} size={size} bgColor="#ffffff" fgColor="#000000" level="H" />
      <p className="font-mono text-sm font-semibold tracking-wider text-black">{code}</p>
    </div>
  );
}

export function PalletLabelPage(props: PalletLabelPageProps) {
  const {
    barcode,
    productSku,
    productName,
    quantity,
    lotNumber,
    batchNumber,
    expiryDate,
    containerNumber,
    poNumber,
    clientName,
    warehouseName,
    locationCode,
    receiptReference,
    packaging,
    draftSequence,
    draftCount,
    temperatureClass = "ambient",
    trigger,
    onPrinted,
  } = props;

  const accentColor = TEMP_COLOURS[temperatureClass] ?? TEMP_COLOURS.ambient;
  const tempLabel = TEMP_LABELS[temperatureClass] ?? temperatureClass;
  const safeBarcode = displayValue(barcode);
  const draftPosition = hasValue(draftSequence) && hasValue(draftCount) ? `${draftSequence}/${draftCount}` : draftSequence;
  const fields = [
    ["Pallet barcode", safeBarcode],
    ["Temperature", tempLabel],
    ["SKU", productSku],
    ["Product", productName],
    ["Quantity", quantity],
    ["Expiry", expiryDate],
    ["Lot", lotNumber],
    ["Batch", batchNumber],
    ["Container", containerNumber],
    ["PO", poNumber],
    ["Client", clientName],
    ["Warehouse", warehouseName],
    ["Location", locationCode],
    ["Receipt", receiptReference],
    ["Packaging", packaging],
    ["Draft", draftPosition],
  ].filter(([label, value]) => label === "Pallet barcode" || hasValue(value));

  function handlePrint() {
    const barcodeEl = document.getElementById(`__pl-bc-${barcode}`);
    const barcodeSvg = barcodeEl?.innerHTML ?? "";

    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Pallet Label — ${escapeHtml(safeBarcode)}</title>
  <meta charset="utf-8" />
  <style>
    @page { size: auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; background: #fff; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #000;
    }
    .sheet {
      width: 8.5in;
      min-height: 11in;
      padding: 0.45in;
      display: flex;
      flex-direction: column;
      gap: 0.22in;
      background: #ffffff;
      border: 0.08in solid ${accentColor};
    }
    .accent-bar { width: 100%; height: 0.08in; background: ${accentColor}; border-radius: 999px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.25in; }
    .title { font-size: 16pt; font-weight: 800; text-transform: uppercase; color: ${accentColor}; }
    .pallet-code { font-size: 42pt; font-weight: 900; letter-spacing: 0.01em; line-height: 1; }
    .temp-badge { font-size: 14pt; font-weight: 800; padding: 0.08in 0.18in; border-radius: 999px; background: ${accentColor}; color: #fff; white-space: nowrap; }
    .field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.14in; }
    .field { border: 1px solid #94a3b8; border-radius: 0.06in; background: rgba(255,255,255,0.75); padding: 0.1in; min-height: 0.62in; }
    .field.expiry { border-color: #f59e0b; background: #fffbeb; }
    .field-label { color: #475569; text-transform: uppercase; font-size: 8.5pt; font-weight: 800; letter-spacing: 0.05em; }
    .field.expiry .field-label { color: #92400e; }
    .field-value { margin-top: 0.05in; font-size: 14pt; line-height: 1.2; font-weight: 750; overflow-wrap: anywhere; }
    .barcode-section { margin-top: auto; border: 2px solid ${accentColor}; background: #fff; border-radius: 0.08in; padding: 0.2in; }
    .barcode-label { color: #475569; text-transform: uppercase; font-size: 9pt; font-weight: 800; letter-spacing: 0.05em; text-align: center; }
    .barcode-wrap { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 2.6in; padding-top: 0.12in; gap: 0.08in; }
    .barcode-wrap svg { width: 2.4in; height: 2.4in; }
    .barcode-text { font-family: 'Courier New', monospace; font-size: 16pt; font-weight: 800; letter-spacing: 0.04em; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #94a3b8; padding-top: 0.14in; }
    .footer-text { font-size: 9pt; color: #475569; font-weight: 650; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { width: 100vw; min-height: 100vh; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="accent-bar"></div>
    <div class="header">
      <div>
        <div class="title">Pallet Label</div>
        <div class="pallet-code">${escapeHtml(safeBarcode)}</div>
      </div>
      <span class="temp-badge">${escapeHtml(tempLabel)}</span>
    </div>
    <div class="field-grid">
      ${fields.map(([label, value]) => `<div class="field${label === "Expiry" ? " expiry" : ""}"><div class="field-label">${escapeHtml(label)}</div><div class="field-value">${escapeHtml(value)}</div></div>`).join("")}
    </div>
    <div class="barcode-section">
      <div class="barcode-label">Scan QR code</div>
      <div class="barcode-wrap">${barcodeSvg}<div class="barcode-text">${escapeHtml(safeBarcode)}</div></div>
    </div>
    <div class="footer">
      <span class="footer-text">Warehouse Wizard</span>
      <span class="footer-text">${escapeHtml(new Date().toLocaleString())}</span>
    </div>
  </div>
  <script>window.onload=()=>{window.print();window.close();}<\/script>
</body>
</html>`);
    win.document.close();
    void Promise.resolve(onPrinted?.());
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Printer className="mr-1 h-3.5 w-3.5" />
            Print label
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pallet Label — {barcode}</DialogTitle>
        </DialogHeader>

        {/* Hidden barcode render target for print capture */}
        <div id={`__pl-bc-${barcode}`} className="sr-only" aria-hidden>
          <BarcodePreview code={barcode} />
        </div>

        {/* Preview */}
        <div className="max-h-[68vh] overflow-auto rounded-lg bg-muted/30 p-3">
          <div
            className="mx-auto flex aspect-[8.5/11] w-full max-w-[520px] flex-col gap-3 rounded-lg border-[6px] bg-white p-5 text-black shadow-sm"
            style={{ borderColor: accentColor, fontFamily: "system-ui, sans-serif" }}
          >
            <div className="h-2 w-full rounded-full" style={{ background: accentColor }} />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: accentColor }}>
                  Pallet Label
                </p>
                <p className="break-words text-3xl font-black leading-tight tracking-tight">{safeBarcode}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: accentColor }}
              >
                {displayValue(tempLabel)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fields.map(([label, value]) => (
                <FieldBlock key={label} label={label} value={value} highlight={label === "Expiry"} />
              ))}
            </div>

            <div className="mt-auto rounded-md border-2 bg-white p-3" style={{ borderColor: accentColor }}>
              <p className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">Scan barcode</p>
              <div className="flex justify-center py-3">
                <BarcodePreview code={barcode} />
              </div>
            </div>
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

