import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type LabelSheetItem = {
  code: string;
  title?: string | null;
  subtitle?: string | null;
  aisle?: string | null;
  bay?: string | null;
  level?: number | string | null;
  locationType?: string | null;
  temperatureClass?: string | null;
  warehouseName?: string | null;
  zoneName?: string | null;
};

type LabelSheetKind = "location" | "zone";

const TEMP_COLOURS: Record<string, string> = {
  ambient: "#1a1a2e",
  cool: "#1565c0",
  frozen: "#4a148c",
};

const TEMP_LABELS: Record<string, string> = {
  ambient: "Ambient",
  cool: "Cool",
  frozen: "Frozen",
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

function renderQrSvg(value: string) {
  return renderToStaticMarkup(<QRCodeSVG value={value} size={256} level="M" />);
}

function getAccentColor(item: LabelSheetItem) {
  return TEMP_COLOURS[String(item.temperatureClass ?? "ambient")] ?? TEMP_COLOURS.ambient;
}

function getTemperatureLabel(item: LabelSheetItem) {
  const value = String(item.temperatureClass ?? "ambient");
  return TEMP_LABELS[value] ?? value;
}

function getTypeLabel(item: LabelSheetItem) {
  const value = String(item.locationType ?? "");
  return value ? TYPE_LABELS[value] ?? value : null;
}

function locationParts(item: LabelSheetItem) {
  return [
    item.aisle ? `Aisle ${item.aisle}` : null,
    item.bay ? `Bay ${item.bay}` : null,
    item.level != null && item.level !== "" ? `Level ${item.level}` : null,
  ].filter(Boolean).join(" · ");
}

function renderLinearLocationLabel(item: LabelSheetItem) {
  const qr = renderQrSvg(item.code);
  const accent = getAccentColor(item);
  const temp = getTemperatureLabel(item);
  const type = getTypeLabel(item);
  const parts = locationParts(item);
  return `
    <div class="location-label">
      <div class="meta" style="border-color:${accent}">
        <div class="code">${escapeHtml(item.code)}</div>
        <div class="badges">
          <span class="badge temp" style="background:${accent}">${escapeHtml(temp)}</span>
          ${type ? `<span class="badge type" style="border-color:${accent};color:${accent}">${escapeHtml(type)}</span>` : ""}
        </div>
        ${parts ? `<div class="sub">${escapeHtml(parts)}</div>` : ""}
        ${item.zoneName || item.warehouseName ? `<div class="sub">Zone: ${escapeHtml(item.zoneName ?? "")}${item.zoneName && item.warehouseName ? " · " : ""}${escapeHtml(item.warehouseName ?? "")}</div>` : ""}
      </div>
      <div class="qr">${qr}</div>
    </div>`;
}

function renderZoneLabel(item: LabelSheetItem) {
  const qr = renderQrSvg(item.code);
  const accent = getAccentColor(item);
  const temp = getTemperatureLabel(item);
  return `
    <div class="zone-label">
      <div class="meta" style="border-color:${accent}">
        <div class="eyebrow">Zone aisle code</div>
        <div class="code">${escapeHtml(item.code)}</div>
        ${item.title ? `<div class="title">${escapeHtml(item.title)}</div>` : ""}
        ${item.subtitle ? `<div class="subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
        <span class="zone-temp" style="background:${accent}">${escapeHtml(temp)}</span>
      </div>
      <div class="qr">${qr}</div>
    </div>`;
}

export function LabelSheetPrintDialog({
  items,
  resourceLabel,
  kind = "location",
  trigger,
}: {
  items: LabelSheetItem[];
  resourceLabel: string;
  kind?: LabelSheetKind;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const cellsPerSheet = kind === "zone" ? 6 : 16;
  const totalCells = items.length;
  const totalSheets = Math.max(1, Math.ceil(totalCells / cellsPerSheet));

  function handlePrint() {
    if (items.length === 0) return;
    const cols = 2;
    const rows = kind === "zone" ? 3 : 8;
    const totalSlots = totalSheets * cols * rows;
    const filled: Array<LabelSheetItem | null> = Array.from({ length: totalSlots }, () => null);
    for (let i = 0; i < items.length; i += 1) {
      filled[i] = items[i] ?? null;
    }

    const sheets: Array<Array<LabelSheetItem | null>> = [];
    for (let s = 0; s < totalSheets; s += 1) {
      sheets.push(filled.slice(s * cellsPerSheet, (s + 1) * cellsPerSheet));
    }

    const sheetHtml = sheets
      .map(
        (cells) => `
      <section class="sheet">
        ${cells
          .map((cell) => {
            if (!cell) return `<div class="cell empty"></div>`;
            return `<div class="cell">${kind === "zone" ? renderZoneLabel(cell) : renderLinearLocationLabel(cell)}</div>`;
          })
          .join("")}
      </section>`,
      )
      .join("");

    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(resourceLabel)} Labels — ${items.length} items</title>
  <meta charset="utf-8" />
  <style>
    @page { size: ${kind === "zone" ? "A4" : "198mm 304mm"} portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: system-ui, -apple-system, sans-serif; color: #000; }
    .sheet {
      width: ${kind === "zone" ? "210mm" : "198mm"};
      height: ${kind === "zone" ? "297mm" : "304mm"};
      padding: ${kind === "zone" ? "9mm 6mm" : "0"};
      display: grid;
      grid-template-columns: repeat(${cols}, 99mm);
      grid-template-rows: repeat(${rows}, ${kind === "zone" ? "93mm" : "38mm"});
      gap: 0;
      page-break-after: always;
    }
    .sheet:last-child { page-break-after: auto; }
    .cell {
      width: 99mm;
      height: ${kind === "zone" ? "93mm" : "38mm"};
      padding: ${kind === "zone" ? "6mm" : "3.5mm"};
      overflow: hidden;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      border: 0.25mm dashed #d1d5db;
    }
    .cell.empty { border-style: dotted; opacity: 0.3; }
    .location-label { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 30mm; gap: 4mm; }
    .location-label .meta { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.5mm; border-left: 2mm solid #111827; padding-left: 3mm; }
    .location-label .code { font-size: 18pt; font-weight: 900; line-height: 1.02; word-break: break-word; }
    .badges { display: flex; align-items: center; gap: 1.5mm; flex-wrap: wrap; }
    .badge { font-size: 7pt; font-weight: 800; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
    .badge.temp { color: #fff; }
    .badge.type { border: 1.5px solid; }
    .sub { font-size: 8pt; color: #111827; line-height: 1.2; }
    .location-label .qr, .zone-label .qr { display: flex; align-items: center; justify-content: center; }
    .location-label .qr svg { width: 29mm; height: 29mm; }
    .zone-label { width: 100%; height: 100%; display: grid; grid-template-rows: 1fr 42mm; gap: 4mm; }
    .zone-label .meta { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 2.5mm; border-left: 3mm solid #111827; padding-left: 4mm; }
    .zone-label .eyebrow { font-size: 9pt; font-weight: 900; text-transform: uppercase; color: #334155; letter-spacing: .05em; }
    .zone-label .code { font-size: 26pt; font-weight: 900; line-height: 1.05; word-break: break-word; }
    .zone-label .title { font-size: 13pt; font-weight: 800; }
    .zone-label .subtitle { font-size: 10pt; color: #334155; }
    .zone-temp { width: fit-content; border-radius: 999px; padding: 2px 10px; color: #fff; font-size: 8pt; font-weight: 800; }
    .zone-label .qr svg { width: 40mm; height: 40mm; }
    @media print { .cell { border-color: transparent; } .cell.empty { border-color: transparent; } }
  </style>
</head>
<body>
  ${sheetHtml}
  <script>window.onload=()=>{window.print();window.close();}<\/script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print {resourceLabel} Labels Sheet</DialogTitle>
          <DialogDescription>
            {items.length} label{items.length === 1 ? "" : "s"} → {totalSheets} sheet{totalSheets === 1 ? "" : "s"} at {cellsPerSheet} per sheet.
            Filter the table first to narrow the set.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
          Avery {kind === "zone" ? "99 × 93 mm, 6 labels per sheet" : "99 × 38 mm, 16 labels per sheet"}.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handlePrint} disabled={items.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print {items.length} label{items.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BayLocationCodesPrintDialog({
  items,
  trigger,
}: {
  items: LabelSheetItem[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const cellsPerSheet = 6;
  const totalSheets = Math.max(1, Math.ceil(items.length / cellsPerSheet));

  function handlePrint() {
    if (items.length === 0) return;
    const totalSlots = totalSheets * cellsPerSheet;
    const filled: Array<LabelSheetItem | null> = Array.from({ length: totalSlots }, (_, index) => items[index] ?? null);
    const sheets: Array<Array<LabelSheetItem | null>> = [];
    for (let i = 0; i < totalSheets; i += 1) {
      sheets.push(filled.slice(i * cellsPerSheet, (i + 1) * cellsPerSheet));
    }
    const pages = sheets.map((cells) => `
      <section class="sheet">
        ${cells.map((item) => {
          if (!item) return `<div class="cell empty"></div>`;
          const qr = renderQrSvg(item.code);
          return `
            <div class="cell">
              <div class="cut cut-tl"></div><div class="cut cut-tr"></div><div class="cut cut-bl"></div><div class="cut cut-br"></div>
              <div class="bay-label">
                <div class="meta">
                  <div class="eyebrow">Bay code</div>
                  <div class="code">${escapeHtml(item.code)}</div>
                  ${item.title ? `<div class="title">${escapeHtml(item.title)}</div>` : ""}
                  ${item.subtitle ? `<div class="subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
                </div>
                <div class="qr">${qr}</div>
              </div>
            </div>`;
        }).join("")}
      </section>`).join("");

    const win = window.open("", "_blank", "width=620,height=760");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Bay Location Codes — ${items.length} bays</title>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: system-ui, -apple-system, sans-serif; color: #000; }
    .sheet {
      width: 210mm;
      height: 297mm;
      padding: 9mm 6mm;
      display: grid;
      grid-template-columns: repeat(2, 99mm);
      grid-template-rows: repeat(3, 93mm);
      page-break-after: always;
    }
    .sheet:last-child { page-break-after: auto; }
    .cell {
      position: relative;
      width: 99mm;
      height: 93mm;
      padding: 6mm;
      overflow: hidden;
    }
    .cell.empty { opacity: 0.3; }
    .bay-label {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 40mm;
      gap: 4mm;
      overflow: hidden;
    }
    .meta { min-width: 0; border-left: 3mm solid #0f766e; padding-left: 4mm; display: flex; flex-direction: column; justify-content: center; gap: 3mm; }
    .eyebrow { font-size: 11pt; font-weight: 800; text-transform: uppercase; color: #0f766e; letter-spacing: 0.04em; }
    .code { font-size: 25pt; font-weight: 900; line-height: 1.05; word-break: break-word; }
    .title { font-size: 13pt; font-weight: 700; }
    .subtitle { font-size: 11pt; color: #333; line-height: 1.25; }
    .qr { display: flex; align-items: center; justify-content: center; }
    .qr svg { width: 38mm; height: 38mm; }
    .cut { position: absolute; width: 4mm; height: 4mm; }
    .cut-tl { left: 1.5mm; top: 1.5mm; border-left: 1px solid #999; border-top: 1px solid #999; }
    .cut-tr { right: 1.5mm; top: 1.5mm; border-right: 1px solid #999; border-top: 1px solid #999; }
    .cut-bl { left: 1.5mm; bottom: 1.5mm; border-left: 1px solid #999; border-bottom: 1px solid #999; }
    .cut-br { right: 1.5mm; bottom: 1.5mm; border-right: 1px solid #999; border-bottom: 1px solid #999; }
  </style>
</head>
<body>
  ${pages}
  <script>window.onload=()=>{window.print();window.close();}<\/script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print Bay Location Codes</DialogTitle>
          <DialogDescription>
            {items.length} bay code{items.length === 1 ? "" : "s"} from the current Bin Locations search. Avery 99 × 93 mm, 6 labels per sheet.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-auto rounded-md border border-border">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No bay codes matched the current table search.</p>
          ) : (
            items.map((item) => (
              <div key={item.code} className="border-b border-border px-3 py-2 last:border-b-0">
                <p className="font-mono text-sm font-semibold">{item.code}</p>
                {item.subtitle ? <p className="text-xs text-muted-foreground">{item.subtitle}</p> : null}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handlePrint} disabled={items.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print {items.length} bay code{items.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
