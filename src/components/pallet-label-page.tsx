import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
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
  expiryDate?: string | null;
  clientName?: string | null;
  warehouseName?: string | null;
  temperatureClass?: string;
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

function BarcodePreview({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !code) return;
    try {
      JsBarcode(ref.current, code, {
        format: "CODE128",
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 14,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // invalid barcode value
    }
  }, [code]);

  return <svg ref={ref} />;
}

export function PalletLabelPage(props: PalletLabelPageProps) {
  const {
    barcode,
    productSku,
    productName,
    quantity,
    lotNumber,
    expiryDate,
    clientName,
    warehouseName,
    temperatureClass = "ambient",
    trigger,
  } = props;

  const accentColor = TEMP_COLOURS[temperatureClass] ?? TEMP_COLOURS.ambient;
  const tempLabel = TEMP_LABELS[temperatureClass] ?? temperatureClass;

  function handlePrint() {
    const barcodeEl = document.getElementById(`__pl-bc-${barcode}`);
    const barcodeSvg = barcodeEl?.innerHTML ?? "";

    const win = window.open("", "_blank", "width=560,height=420");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Pallet Label — ${barcode}</title>
  <meta charset="utf-8" />
  <style>
    @page { size: 101.6mm 152.4mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 101.6mm;
      min-height: 152.4mm;
      background: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      padding: 5mm;
      color: #000;
    }
    .accent-bar { width: 100%; height: 6px; background: ${accentColor}; border-radius: 2px; margin-bottom: 4mm; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; margin-bottom: 3mm; }
    .pallet-code { font-size: 18pt; font-weight: 800; letter-spacing: 0.01em; line-height: 1; }
    .temp-badge { font-size: 8pt; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: ${accentColor}; color: #fff; white-space: nowrap; }
    .product { margin-bottom: 3mm; }
    .sku { font-size: 11pt; font-weight: 700; }
    .name { font-size: 9pt; color: #444; margin-top: 1mm; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 4mm; margin-bottom: 4mm; }
    .meta-item { font-size: 8.5pt; }
    .meta-label { color: #888; text-transform: uppercase; font-size: 6.5pt; letter-spacing: 0.05em; }
    .meta-value { font-weight: 600; }
    .barcode-wrap { display: flex; justify-content: center; flex: 1; align-items: center; padding: 3mm 0; }
    .barcode-wrap svg { width: 100%; max-height: 30mm; }
    .footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 2mm; border-top: 1px solid #eee; }
    .footer-text { font-size: 7pt; color: #999; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="header">
    <span class="pallet-code">${barcode}</span>
    <span class="temp-badge">${tempLabel}</span>
  </div>
  ${(productSku || productName) ? `<div class="product">
    ${productSku ? `<div class="sku">${productSku}</div>` : ""}
    ${productName ? `<div class="name">${productName}</div>` : ""}
  </div>` : ""}
  <div class="meta">
    ${quantity != null ? `<div class="meta-item"><div class="meta-label">Quantity</div><div class="meta-value">${quantity}</div></div>` : ""}
    ${lotNumber ? `<div class="meta-item"><div class="meta-label">Lot</div><div class="meta-value">${lotNumber}</div></div>` : ""}
    ${expiryDate ? `<div class="meta-item"><div class="meta-label">Expiry</div><div class="meta-value">${expiryDate}</div></div>` : ""}
    ${clientName ? `<div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${clientName}</div></div>` : ""}
    ${warehouseName ? `<div class="meta-item"><div class="meta-label">Warehouse</div><div class="meta-value">${warehouseName}</div></div>` : ""}
  </div>
  <div class="barcode-wrap">${barcodeSvg}</div>
  <div class="footer">
    <span class="footer-text">Warehouse Wizard</span>
    <span class="footer-text">${new Date().toLocaleString()}</span>
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
            Print label
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pallet Label — {barcode}</DialogTitle>
        </DialogHeader>

        {/* Hidden barcode render target for print capture */}
        <div id={`__pl-bc-${barcode}`} className="sr-only" aria-hidden>
          <BarcodePreview code={barcode} />
        </div>

        {/* Preview */}
        <div
          className="rounded-lg border border-border bg-white p-4 text-black flex flex-col gap-2"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <div className="w-full h-1.5 rounded" style={{ background: accentColor }} />

          <div className="flex items-start justify-between gap-2">
            <span className="text-xl font-extrabold leading-tight tracking-tight">{barcode}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap"
              style={{ background: accentColor }}
            >
              {tempLabel}
            </span>
          </div>

          {(productSku || productName) && (
            <div className="text-xs">
              {productSku && <div className="font-semibold">{productSku}</div>}
              {productName && <div className="text-gray-600">{productName}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            {quantity != null && (
              <div><span className="text-gray-500 uppercase">Qty: </span><span className="font-semibold">{quantity}</span></div>
            )}
            {lotNumber && (
              <div><span className="text-gray-500 uppercase">Lot: </span><span className="font-semibold">{lotNumber}</span></div>
            )}
            {expiryDate && (
              <div><span className="text-gray-500 uppercase">Exp: </span><span className="font-semibold">{expiryDate}</span></div>
            )}
            {clientName && (
              <div><span className="text-gray-500 uppercase">Client: </span><span className="font-semibold">{clientName}</span></div>
            )}
          </div>

          <div className="flex justify-center py-1">
            <BarcodePreview code={barcode} />
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
