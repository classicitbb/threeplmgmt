## Problem

`importCsvToResource` in `src/lib/wms-core.ts` silently fails:

1. `await db(table).upsert(row)` returns `{ error }` — it does NOT throw — so the `try/catch` never sees a failure and the function returns `[]`. The UI then shows "Products imported" even when 0 rows landed.
2. Rows are upserted verbatim. CSV exports include `id`, `created_at`, `updated_at`, and FK columns like `client_owner_id` as raw UUIDs that don't exist in this environment — every insert is rejected by Postgres but the error is dropped.
3. No preview — user can't see what's about to be imported or why rows would fail.

## Fix

### 1. Rewrite `importCsvToResource` (src/lib/wms-core.ts)

Split into two functions so the UI can preview before committing:

- `parseCsvForResource(resource, file): Promise<ImportPreview>` — parses CSV, normalizes each row, runs validation, returns:
  ```ts
  {
    headers: string[],
    rows: Array<{
      rowNumber: number,
      raw: Record<string,string>,
      normalized: Record<string, unknown> | null,
      errors: string[],
      warnings: string[],
    }>,
    summary: { total, valid, invalid, willCreate, willSkip }
  }
  ```
- `commitImportRows(resource, rows): Promise<{inserted, failed, errors}>` — inserts only the valid rows and **captures `result.error`** from each Supabase call.

Per-resource normalization rules:
- **Always strip**: `id`, `created_at`, `updated_at` (server generates fresh UUIDs).
- **Booleans**: accept `true/false/1/0/yes/no/y/n` (case-insensitive).
- **Numbers**: parse, blank → null.
- **Enums** (e.g. `temperature_requirement`, `rotation_method`): validate against the field's `options`.
- **FK lookups for products**: if `client_owner_id` is not a UUID, resolve by `clients.code` then `clients.name`; record an error if no match.
- **Required fields**: enforced from `resource.fields[].required` after stripping `id`.
- **Duplicate detection**: for products, check `sku` uniqueness against existing rows and within the file; flag as a warning ("will update existing") or error if we prefer insert-only. Default: insert-only — error on existing SKU.

### 2. New preview dialog `ImportPreviewDialog` (src/components/wms-ui.tsx)

Replaces the silent `handleImport` flow:

1. User picks a CSV → call `parseCsvForResource`.
2. Open a `Dialog` showing:
   - Summary chips: Total / Valid / Invalid / Will create.
   - A scrollable `Table` of every row: row #, key columns, status badge (OK / Error / Warning), error/warning messages inline.
   - "Download errors CSV" button.
   - Footer: **Cancel** and **Import N valid rows** (disabled when valid=0).
3. On confirm → call `commitImportRows`, show progress, then a final toast with `inserted / failed` counts and an errors CSV download if any failed.

Keep the existing `Template` button untouched, but update the template generator to **omit** `id`, `created_at`, `updated_at` so users don't paste server-managed columns back in.

### 3. Scope

- Wire `ImportPreviewDialog` into the existing `ImportButton` only (used by every resource). Behavior is identical for other resources because the normalization rules are field-type driven; product-specific FK resolution is gated on `resource.table === "products"`.
- No DB migrations.
- No changes to other workflows.

### 4. Verification

- Run `bunx tsc --noEmit`.
- Add a unit test in `src/test/wms-core.test.ts` covering: row with `id` stripped, boolean coercion, enum rejection, FK resolution by client code, missing-required-field error.

## Out of scope

- Updating existing products from CSV (insert-only for now; can be added later behind a checkbox).
- Bulk import for receipts / orders / pallets.
