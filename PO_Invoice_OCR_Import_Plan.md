# PO / Supplier Invoice OCR Import — Implementation Plan

**App:** Warehouse Wizard WMS (Lovable frontend + Supabase backend)
**Feature:** Upload a PO or supplier invoice (PDF/image) → extract line items via OCR → feed the *existing* CSV validation grid → user reviews/corrects → confirm import.
**Hard constraint:** the source document is **never persistently stored**. Processed in memory, discarded immediately.
**Status:** For your review before we build.

---

## 1. Recommended extraction API

**Recommendation: Azure AI Document Intelligence — prebuilt `invoice` model.**

The decisive factor for your use case is **line-item table accuracy**, because each line item becomes one row in the validator grid. That is exactly where the three APIs diverge most.

### Comparison

| Criterion | Azure Doc Intelligence (prebuilt-invoice) | AWS Textract AnalyzeExpense | Google Document AI (Invoice Parser) |
|---|---|---|---|
| **Line-item accuracy** (benchmark) | **~87%** — best; robust across varied table layouts | ~82% — good on clean templates | **~40%** — weak on multi-column tables |
| **Header field accuracy** | **~93%** — best | ~78% | reasonable |
| **Price** | $10 / 1,000 pages (first 500/mo free) | $10 / 1,000 pages first 1M ($8 after); 100 pages/mo free for 3 mo | $0.10 per 10-page block, per document → **effectively $0.10 per short invoice** |
| **Real cost on short invoices** | ~$0.01/page | ~$0.01/page | ~$0.10 each (1–3 page invoices all hit the first block) |
| **Auth from a Supabase Edge Function** | **Single API key** in an `Ocp-Apim-Subscription-Key` header — trivial in Deno | AWS SigV4 request signing — the fiddliest of the three in Deno | GCP service-account JWT → OAuth token exchange — moderate |
| **Call flow** | Async: POST bytes → poll `Operation-Location` | **Synchronous single call** — simplest flow | Synchronous single call |
| **In-memory (no storage) support** | Yes — POST raw bytes in request body | Yes — `Document.Bytes` inline | Yes — `rawDocument.content` base64 |
| **Confidence scores per field/cell** | Yes | Yes | Yes |

### Why Azure wins here

Two of your requirements point the same direction:

- **Line items are the payload.** Azure's ~87% line-item accuracy vs. Google's ~40% is the difference between a usable grid and one the user re-types. Google Document AI is effectively disqualified for line-item-heavy invoices despite good header parsing.
- **Easiest Supabase integration.** Azure authenticates with a single static API key in a header. Textract requires AWS Signature V4 signing, which is the most painful part of calling AWS from Deno (either hand-rolled crypto or pulling in the `@aws-sdk` npm bundle, which bloats cold starts). Azure's key-in-header model is a few lines of `fetch`.

The one trade-off: Azure is **asynchronous** (submit, then poll for the result), so the Edge Function polls for a few seconds. That's a minor code concern and well within Edge Function limits for typical invoices.

### When to reconsider

- **If cost at very high volume dominates** and your invoices are consistently clean single-template POs, Textract AnalyzeExpense is the same headline price with a simpler synchronous call — but budget engineering time for SigV4 and accept lower line-item accuracy.
- **Do not choose Google Document AI** for this feature. Its per-document block pricing punishes short invoices ($0.10 each) *and* its line-item accuracy is the weakest of the three — the worst combination for your case.
- **Caribbean caveat:** all benchmark numbers come from generic invoice sets. Your suppliers' layouts and currency formats will differ. **Before committing, run 15–20 real supplier invoices through Azure's free tier (500 pages/mo)** and measure line-item accuracy on *your* mix. The recommendation stands unless your documents behave very differently.

---

## 2. Supabase Edge Function design

**Function name:** `extract-invoice`
**Runtime:** Deno (Supabase Edge Functions)
**Responsibility:** receive an uploaded file in memory → call Azure → normalize the response into the validator's row schema → return JSON. **No writes to Supabase Storage. No temp files.**

### Data flow

```
Browser (Lovable)                 Edge Function: extract-invoice          Azure Doc Intelligence
  |  file (multipart or base64)         |                                       |
  |------------------------------------>|  POST bytes (in memory)               |
  |                                     |-------------------------------------->|
  |                                     |  202 + Operation-Location header      |
  |                                     |<--------------------------------------|
  |                                     |  poll GET (every ~1.5s, capped)       |
  |                                     |-------------------------------------->|
  |                                     |  succeeded + analyzeResult JSON       |
  |                                     |<--------------------------------------|
  |  { rows:[...], meta:{...}, warnings }|  map → validator row schema           |
  |<------------------------------------|  (bytes go out of scope → GC'd)       |
```

### Key design points

- **No persistence.** The uploaded bytes live only in a local variable for the duration of the request. Nothing is written to Supabase Storage, the database, or disk. When the handler returns, the bytes are garbage-collected. This satisfies the hard constraint by construction — the function has no storage code path at all.
- **Auth to the function.** Require the caller's Supabase JWT (verify `Authorization` header / use `SUPABASE_ANON_KEY` + RLS context) so only signed-in users can invoke it. Rate-limit per user if you're worried about cost abuse.
- **Secrets.** `AZURE_DI_ENDPOINT` and `AZURE_DI_KEY` stored via `supabase secrets set` — never in the client.
- **Payload size.** Edge Functions and Azure both accept several MB. Reject oversized files early (e.g. > 20 MB) with a clear error rather than timing out.
- **Timeout / poll cap.** Cap polling (e.g. 20 attempts × 1.5s ≈ 30s). If Azure hasn't finished, return a `504`-style error the UI can show as "extraction timed out, try again or use CSV."

### Skeleton (Deno / TypeScript)

```ts
// supabase/functions/extract-invoice/index.ts
import { corsHeaders } from "../_shared/cors.ts";

const ENDPOINT = Deno.env.get("AZURE_DI_ENDPOINT")!; // https://<res>.cognitiveservices.azure.com
const KEY = Deno.env.get("AZURE_DI_KEY")!;
const MODEL = "prebuilt-invoice";
const API_VERSION = "2024-11-30"; // pin the version you validate against

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Receive file in memory (multipart form field "file")
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return json({ error: "No file provided" }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: "File too large (max 20MB)" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());

    // 2. Submit to Azure (async analyze)
    const submit = await fetch(
      `${ENDPOINT}/documentintelligence/documentModels/${MODEL}:analyze?api-version=${API_VERSION}`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": KEY,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: bytes,
      },
    );
    if (!submit.ok) return json({ error: "Extraction service rejected the document" }, 502);

    const opLocation = submit.headers.get("Operation-Location");
    if (!opLocation) return json({ error: "No operation location returned" }, 502);

    // 3. Poll for result (capped)
    let result: any = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(opLocation, { headers: { "Ocp-Apim-Subscription-Key": KEY } });
      const body = await poll.json();
      if (body.status === "succeeded") { result = body.analyzeResult; break; }
      if (body.status === "failed") return json({ error: "Extraction failed" }, 502);
    }
    if (!result) return json({ error: "Extraction timed out" }, 504);

    // 4. Map → validator row schema (see Section 3)
    const mapped = mapAzureInvoiceToRows(result);

    // 5. Return. `bytes` goes out of scope here — nothing persisted.
    return json(mapped, 200);
  } catch (e) {
    return json({ error: "Unexpected error", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### The mapper (the part that matters most)

```ts
// Azure prebuilt-invoice returns documents[0].fields with an "Items" array.
// Each item has ProductCode, Description, Quantity, UnitPrice, Amount, etc.,
// each with a `.confidence` (0..1) and a typed value.

const CONF_THRESHOLD = 0.75; // flag anything below for user attention

function mapAzureInvoiceToRows(analyzeResult: any) {
  const doc = analyzeResult?.documents?.[0];
  const f = doc?.fields ?? {};

  // Document-level (header) context — applied to every row or shown once in the UI
  const vendor = f.VendorName?.valueString ?? null;
  const currency = detectCurrency(f); // see Section 4
  const invoiceId = f.InvoiceId?.valueString ?? null;

  const items = f.Items?.valueArray ?? [];
  const warnings: string[] = [];

  const rows = items.map((item: any, idx: number) => {
    const p = item.valueObject ?? {};

    const productCode = p.ProductCode?.valueString ?? null;
    const description = p.Description?.valueString ?? null;
    const quantity    = p.Quantity?.valueNumber ?? null;
    const unitPrice   = p.UnitPrice?.valueCurrency?.amount ?? p.UnitPrice?.valueNumber ?? null;
    const amount      = p.Amount?.valueCurrency?.amount ?? p.Amount?.valueNumber ?? null;

    // Per-field confidence, surfaced so the UI can highlight low-confidence cells
    const confidence = {
      productCode: p.ProductCode?.confidence ?? null,
      description: p.Description?.confidence ?? null,
      quantity:    p.Quantity?.confidence ?? null,
      unitPrice:   p.UnitPrice?.confidence ?? null,
    };

    const lowConfFields = Object.entries(confidence)
      .filter(([, c]) => c !== null && (c as number) < CONF_THRESHOLD)
      .map(([k]) => k);

    if (!productCode) warnings.push(`Row ${idx + 1}: missing product code`);

    // ---- Shape MUST match your existing CSV validator row interface ----
    return {
      product_code: productCode,
      description,
      quantity,
      unit_price: unitPrice,
      line_total: amount,
      vendor,           // header value denormalized onto the row
      currency,
      _source: "ocr",   // provenance so the grid knows this row came from OCR
      _confidence: confidence,
      _needsReview: lowConfFields.length > 0 || !productCode,
      _lowConfFields: lowConfFields,
    };
  });

  return {
    rows,
    meta: { vendor, invoiceId, currency, pageCount: analyzeResult?.pages?.length ?? 1 },
    warnings,
  };
}
```

> The row object shape above is a **template** — the one edit you must make when we build is to align these keys (`product_code`, `unit_price`, etc.) with your validator's actual row/column names. Send me the CSV validator's row type/interface and I'll lock the mapper to it exactly.

---

## 3. Changes to the existing CSV validator UI

The goal is to make OCR a **second data source into the same grid**, not a second grid. Most of your validation logic stays untouched. Concretely:

1. **New entry point (UI).** Add an "Upload PO / Invoice" button/tab alongside the existing "Upload CSV" and "Manual entry" options. It opens a file picker accepting `application/pdf` and images.

2. **Normalize the data source.** Right now your validator presumably takes an array of parsed CSV rows. Refactor the point where it receives data so it accepts a **normalized row array** regardless of origin. The OCR path calls `extract-invoice`, gets back `{ rows, meta, warnings }`, and hands `rows` into the *same* setter the CSV parser already uses. If the CSV parser currently produces rows inline, extract a small `loadRows(rows, source)` function both paths call.

3. **Confidence highlighting (small, high-value addition).** OCR rows carry `_confidence` and `_needsReview`. Add optional cell styling: if a field is low-confidence, highlight it (e.g. amber border) and sort/scroll flagged rows to the top. CSV rows simply won't have these flags, so the styling is a no-op for them — no branching needed in the core grid. This is the single most useful UI change because it turns OCR error rates into a guided review instead of a silent risk.

4. **Header banner.** Show `meta.vendor`, `meta.invoiceId`, and `meta.currency` above the grid so the user has context and can confirm the vendor once rather than per row.

5. **Validation rules — mostly reused, a couple added.** Your existing rules (required fields, numeric quantity/price, product-code lookup against the catalog) apply unchanged. Add: currency normalization before numeric validation, and treat a missing product code as a warning rather than a hard block (see edge cases).

What does **not** change: the editable grid component, the confirm/import action, the write-to-Supabase step, and existing CSV parsing. OCR plugs in upstream of all of it.

---

## 4. Edge cases to handle

**Multi-page invoices.** Azure returns line items across all pages in one `Items` array, so pagination is handled for you — but a single logical line can wrap across a page break and be split into two item rows. Detect rows with a description but null quantity/price immediately following a complete row, and either merge or flag them. Also expose `meta.pageCount` so the UI can warn "24 line items across 3 pages — please scroll and review all."

**Low-confidence OCR fields.** Already wired via `_confidence` / `_needsReview` in the mapper. Set `CONF_THRESHOLD` conservatively (start at 0.75, tune against real invoices). Never auto-import — the whole point of routing through the validator is human confirmation. Highlight low-confidence cells; don't silently accept them.

**Missing product codes.** Common — many suppliers list only a description. Do **not** hard-block. Instead: (a) flag the row for review, (b) attempt a fuzzy match of the description against your existing product catalog and suggest a code, (c) let the user pick "map to existing product" or "create new SKU." This is where OCR import earns its keep, so it deserves real UX rather than a validation error.

**Currency formatting across Caribbean suppliers.** The biggest data-quality risk. Expect mixed symbols and conventions: TT$ (Trinidad & Tobago), J$ / JMD (Jamaica), Bds$ (Barbados), XCD/EC$ (Eastern Caribbean), plus USD invoices from regional distributors. Handle:
- **Thousands/decimal separators** — most Caribbean suppliers use `1,234.56` (US-style), but verify; strip thousands separators before `parseFloat`.
- **Currency detection** — read Azure's `valueCurrency.currencyCode`/symbol where present; fall back to a symbol regex on the raw text, and if ambiguous, surface a currency dropdown in the header banner defaulting to the supplier's known currency.
- **Symbol collisions** — `$` alone is ambiguous (USD vs TT$ vs J$). Resolve by vendor (store each supplier's default currency) rather than guessing per invoice.
- **Store currency on the row** so downstream inventory costing isn't corrupted by a JMD price treated as USD.

**Other worth flagging:**
- **Non-invoice / unreadable uploads** — user uploads a photo of the wrong document or a blurry scan. Return zero rows with a clear "couldn't read line items — check the file or enter manually" message; don't dump an empty grid.
- **Duplicate submission / cost control** — each call costs money and hits Azure. Debounce the upload button and rate-limit the function per user.
- **PDF vs image** — Azure handles both, but very large or high-DPI images may need the size guard; downscale client-side if you hit limits.
- **Totals reconciliation** — optionally sum the line `amount`s and compare to the invoice `InvoiceTotal` field; a mismatch is a strong signal that a line was mis-extracted, and makes a great automatic review flag.

---

## 5. Build sequence (once you approve)

1. Provision Azure Document Intelligence resource; capture endpoint + key; run 15–20 of your real supplier invoices through the free tier to confirm accuracy on your document mix.
2. You send me the CSV validator's row type/interface so the mapper matches exactly.
3. Build `extract-invoice` Edge Function (skeleton + mapper above), set secrets, deploy.
4. Add the "Upload PO / Invoice" entry point in Lovable; wire the response into the existing `loadRows` path.
5. Add confidence highlighting, header banner, and the missing-product-code fuzzy match.
6. Test: multi-page, low-confidence, missing codes, each currency; confirm no file is ever written to Storage (verify the bucket stays empty after runs).

---

### Sources

- [AWS Textract pricing](https://aws.amazon.com/textract/pricing/)
- [Google Document AI pricing](https://cloud.google.com/document-ai/pricing) · [block-pricing analysis](https://invoicedataextraction.com/blog/google-document-ai-invoice-parser-pricing)
- [Azure Document Intelligence pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/) · [Azure invoice model docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice)
- [Textract vs Google vs Azure invoice benchmark](https://www.businesswaretech.com/blog/research-best-ai-services-for-automatic-invoice-processing) · [line-item accuracy comparison](https://invoicedataextraction.com/blog/aws-textract-vs-google-document-ai-vs-azure-document-intelligence)
- [Supabase Edge Functions docs](https://supabase.com/docs/guides/functions)
