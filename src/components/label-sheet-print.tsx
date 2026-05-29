import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LabelSheetItem = {
  code: string;
  title?: string | null;
  subtitle?: string | null;
};

type PaperSize = "letter" | "a4";
type GridPreset = "2x5" | "3x7" | "3x8" | "4x8";

const PAPER: Record<PaperSize, { label: string; w: string; h: string }> = {
  letter: { label: "US Letter (8.5 × 11 in)", w: "215.9mm", h: "279.4mm" },
  a4: { label: "A4 (210 × 297 mm)", w: "210mm", h: "297mm" },
};

const GRIDS: Record<GridPreset, { label: string; cols: number; rows: number }> = {
  "2x5": { label: "2 × 5 (10 per sheet — large)", cols: 2, rows: 5 },
  "3x7": { label: "3 × 7 (21 per sheet — Avery 5160 style)", cols: 3, rows: 7 },
  "3x8": { label: "3 × 8 (24 per sheet)", cols: 3, rows: 8 },
  "4x8": { label: "4 × 8 (32 per sheet — small)", cols: 4, rows: 8 },
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

export function LabelSheetPrintDialog({
  items,
  resourceLabel,
  trigger,
}: {
  items: LabelSheetItem[];
  resourceLabel: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<PaperSize>("letter");
  const [grid, setGrid] = useState<GridPreset>("3x7");
  const [startCell, setStartCell] = useState<number>(1);
  const [margin, setMargin] = useState<number>(8);

  const cellsPerSheet = useMemo(() => GRIDS[grid].cols * GRIDS[grid].rows, [grid]);
  const totalCells = startCell - 1 + items.length;
  const totalSheets = Math.max(1, Math.ceil(totalCells / cellsPerSheet));

  function handlePrint() {
    if (items.length === 0) return;
    const { w, h } = PAPER[paper];
    const { cols, rows } = GRIDS[grid];
    const totalSlots = totalSheets * cols * rows;
    const filled: Array<LabelSheetItem | null> = Array.from({ length: totalSlots }, () => null);
    const offset = Math.max(0, Math.min(cellsPerSheet - 1, startCell - 1));
    for (let i = 0; i < items.length; i += 1) {
      filled[offset + i] = items[i] ?? null;
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
            const qr = renderQrSvg(cell.code);
            return `
            <div class="cell">
              <div class="qr">${qr}</div>
              <div class="meta">
                <div class="code">${escapeHtml(cell.code)}</div>
                ${cell.title ? `<div class="title">${escapeHtml(cell.title)}</div>` : ""}
                ${cell.subtitle ? `<div class="subtitle">${escapeHtml(cell.subtitle)}</div>` : ""}
              </div>
            </div>`;
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
    @page { size: ${paper === "letter" ? "letter" : "A4"} portrait; margin: ${margin}mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: system-ui, -apple-system, sans-serif; color: #000; }
    .sheet {
      width: ${w};
      height: ${h};
      padding: ${margin}mm;
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      grid-template-rows: repeat(${rows}, 1fr);
      gap: 2mm;
      page-break-after: always;
    }
    .sheet:last-child { page-break-after: auto; }
    .cell {
      border: 0.4mm dashed #ddd;
      border-radius: 1.5mm;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1mm;
      overflow: hidden;
    }
    .cell.empty { border-style: dotted; opacity: 0.3; }
    .qr { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }
    .qr svg { width: 100%; height: 100%; max-width: 28mm; max-height: 28mm; }
    .meta { width: 100%; text-align: center; line-height: 1.15; }
    .code { font-size: 8pt; font-weight: 700; letter-spacing: 0.02em; word-break: break-all; }
    .title { font-size: 7pt; color: #333; margin-top: 0.5mm; }
    .subtitle { font-size: 6pt; color: #777; }
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
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Paper size</Label>
            <Select value={paper} onValueChange={(v) => setPaper(v as PaperSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAPER).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Grid</Label>
            <Select value={grid} onValueChange={(v) => setGrid(v as GridPreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(GRIDS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start-cell">Start at cell</Label>
              <Input
                id="start-cell"
                type="number"
                min={1}
                max={cellsPerSheet}
                value={startCell}
                onChange={(e) => setStartCell(Math.max(1, Math.min(cellsPerSheet, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="margin">Page margin (mm)</Label>
              <Input
                id="margin"
                type="number"
                min={0}
                max={25}
                value={margin}
                onChange={(e) => setMargin(Math.max(0, Math.min(25, Number(e.target.value) || 0)))}
              />
            </div>
          </div>
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