## Problem

The per-row "Label" button on Locations opens `LocationLabelPage`, which still uses a 1D barcode for short codes and only switches to QR when the hierarchy code exceeds 24 characters (`QR_THRESHOLD = 24`). The v1.7 baseline says all location labels should be QR.

## Fix

In `src/components/location-label-page.tsx`:

- Make the preview always render `<QRCodeSVG />` (drop the length check in `LabelCodeGraphic`).
- Make the print HTML always use the `qr-wrap` branch with `QRCode.toString(...)` (drop the `useQr` length check; keep the existing QR generation path).
- Remove now-unused `JsBarcode` import, `BarcodePreview` component, and `QR_THRESHOLD` constant.

No UI/copy/layout changes beyond swapping the graphic — label card, fields, and print sheet stay identical.

## Out of scope

Bulk label sheet (`LabelSheetPrintDialog`), pallet/zone/warehouse labels — those already QR per v1.7. No change log entry needed (bug fix to existing v1.7 baseline).
