import { supabase } from "@/integrations/supabase/client";
import {
  db,
  formatSupabaseError,
  parseCsv,
  type ResourceDefinition,
  type ImportRowPreview,
  type ImportPreview,
} from "@/features/shared/core-types";
import { writeSystemLog } from "@/features/system/system-core";

export async function getReportData() {
  const [balances, occupancy, audits, clients, warehouses, cycleCounts, stagingLoads, dockAppointments, printerStations, labelTemplates, printJobs, replenishments, aiRecommendations] = await Promise.all([
    db("inventory_search_view").select("*"),
    db("location_occupancy_view").select("*"),
    db("audit_events").select("*").order("created_at", { ascending: false }).limit(12),
    db("clients").select("*"),
    db("warehouses").select("*"),
    db("cycle_count_lines").select("*").order("updated_at", { ascending: false }).limit(12),
    db("staging_loads").select("*, pick_lists(pick_list_number, warehouse_id, clients(code, name))").order("created_at", { ascending: false }),
    db("dock_appointments").select("*").order("scheduled_at", { ascending: true }),
    db("printer_stations").select("*"),
    db("label_templates").select("*"),
    db("print_jobs").select("*").order("created_at", { ascending: false }).limit(20),
    db("replenishment_tasks").select("*").order("created_at", { ascending: false }).limit(20),
    db("ai_recommendations").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(10),
  ]);

  if (balances.error) throw balances.error;
  if (occupancy.error) throw occupancy.error;
  if (audits.error) throw audits.error;
  if (clients.error) throw clients.error;
  if (warehouses.error) throw warehouses.error;
  if (cycleCounts.error) throw cycleCounts.error;
  if (stagingLoads.error) throw stagingLoads.error;
  if (dockAppointments.error) throw dockAppointments.error;
  if (printerStations.error) throw printerStations.error;
  if (labelTemplates.error) throw labelTemplates.error;
  if (printJobs.error) throw printJobs.error;
  if (replenishments.error) throw replenishments.error;
  if (aiRecommendations.error) throw aiRecommendations.error;

  return {
    inventory: balances.data ?? [],
    occupancy: occupancy.data ?? [],
    audits: audits.data ?? [],
    clients: clients.data ?? [],
    warehouses: warehouses.data ?? [],
    cycleCounts: cycleCounts.data ?? [],
    stagingLoads: stagingLoads.data ?? [],
    dockAppointments: dockAppointments.data ?? [],
    printerStations: printerStations.data ?? [],
    labelTemplates: labelTemplates.data ?? [],
    printJobs: printJobs.data ?? [],
    replenishments: replenishments.data ?? [],
    aiRecommendations: aiRecommendations.data ?? [],
  };
}

export async function importCsvToResource(resource: ResourceDefinition, file: File) {
  const text = await file.text();
  const rows = parseCsv(text);
  const errors: Array<Record<string, string | number>> = [];

  for (const [index, row] of rows.entries()) {
    const missingFields = resource.fields
      .filter((field) => field.required && !row[field.name])
      .map((field) => field.name);

    if (missingFields.length > 0) {
      errors.push({ row: index + 2, error: `Missing: ${missingFields.join(", ")}` });
      continue;
    }

    try {
      await db(resource.table).upsert(row as never);
    } catch (error) {
      errors.push({ row: index + 2, error: error instanceof Error ? error.message : "Import failed" });
    }
  }

  await supabase.storage.from("imports").upload(`${resource.table}/${Date.now()}-${file.name}`, file, {
    cacheControl: "3600",
    upsert: true,
  });

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Import (preview + commit)
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIP_FIELDS = new Set(["id", "created_at", "updated_at"]);

export type ImportRowPreview = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown> | null;
  errors: string[];
  warnings: string[];
};

export type ImportPreview = {
  resourceTable: string;
  headers: string[];
  rows: ImportRowPreview[];
  summary: { total: number; valid: number; invalid: number };
  file: File;
};

function parseCsvRobust(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((v) => v !== "")) records.push(cur);
        cur = [];
      } else { field += c; }
    }
  }
  if (field !== "" || cur.length > 0) { cur.push(field); if (cur.some((v) => v !== "")) records.push(cur); }
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((vals) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (vals[i] ?? "").trim(); });
    return o;
  });
  return { headers, rows };
}

function coerceBoolean(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (s === "") return null;
  if (["true", "1", "yes", "y", "t"].includes(s)) return true;
  if (["false", "0", "no", "n", "f"].includes(s)) return false;
  return null;
}

export async function parseCsvForResource(resource: ResourceDefinition, file: File): Promise<ImportPreview> {
  const text = await file.text();
  const { headers, rows } = parseCsvRobust(text);

  // Build field lookup for normalization
  const fieldByName = new Map(resource.fields.map((f) => [f.name, f]));

  // For products: preload clients to resolve client_owner_id by code/name
  let clientLookup: Map<string, string> | null = null;
  if (resource.table === "products") {
    const { data } = await db("clients").select("id, code, name");
    clientLookup = new Map();
    (data ?? []).forEach((c: any) => {
      if (c.code) clientLookup!.set(`code:${String(c.code).toLowerCase()}`, c.id);
      if (c.name) clientLookup!.set(`name:${String(c.name).toLowerCase()}`, c.id);
      clientLookup!.set(`id:${c.id}`, c.id);
    });
  }

  // For products: preload existing SKUs to flag duplicates
  let existingSkus: Set<string> | null = null;
  if (resource.table === "products") {
    const { data } = await db("products").select("sku");
    existingSkus = new Set((data ?? []).map((r: any) => String(r.sku).toLowerCase()));
  }
  const seenInFile = new Set<string>();

  const preview: ImportRowPreview[] = rows.map((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: Record<string, unknown> = {};

    // Skip template metadata rows (label row "required/optional" pattern, all "required"/"optional" tokens)
    const allValues = Object.values(raw);
    if (allValues.length > 0 && allValues.every((v) => v === "required" || v === "optional" || v === "")) {
      return { rowNumber: idx + 2, raw, normalized: null, errors: ["Skipped template marker row"], warnings: [] };
    }

    for (const [key, valueRaw] of Object.entries(raw)) {
      if (STRIP_FIELDS.has(key)) continue; // ignore server-managed fields
      const field = fieldByName.get(key);
      if (!field) {
        warnings.push(`Unknown column "${key}" (ignored)`);
        continue;
      }
      const value = valueRaw;
      if (value === "" || value == null) {
        if (field.required) errors.push(`Missing required: ${field.name}`);
        continue;
      }
      if (field.type === "boolean") {
        const b = coerceBoolean(value);
        if (b == null) { errors.push(`${field.name}: invalid boolean "${value}"`); continue; }
        normalized[key] = b;
      } else if (field.type === "number") {
        const n = Number(value);
        if (!Number.isFinite(n)) { errors.push(`${field.name}: invalid number "${value}"`); continue; }
        normalized[key] = n;
      } else if (field.type === "select" && field.options?.length) {
        const match = field.options.find((o) => o.value.toLowerCase() === value.toLowerCase());
        if (!match) {
          errors.push(`${field.name}: "${value}" not one of ${field.options.map((o) => o.value).join("/")}`);
          continue;
        }
        normalized[key] = match.value;
      } else if (key.endsWith("_id")) {
        // FK resolution
        if (UUID_RE.test(value)) {
          if (key === "client_owner_id" && clientLookup && !clientLookup.has(`id:${value}`)) {
            warnings.push(`client_owner_id: UUID ${value} not found — left blank, assign after import`);
            normalized[key] = null;
            continue;
          }
          normalized[key] = value;
        } else if (key === "client_owner_id" && clientLookup) {
          const resolved = clientLookup.get(`code:${value.toLowerCase()}`) ?? clientLookup.get(`name:${value.toLowerCase()}`);
          if (!resolved) {
            warnings.push(`client_owner_id: "${value}" not found — left blank, assign after import`);
            normalized[key] = null;
            continue;
          }
          normalized[key] = resolved;
        } else {
          errors.push(`${key}: expected UUID, got "${value}"`);
          continue;
        }
      } else {
        normalized[key] = value;
      }
    }

    // Required field check for columns missing entirely.
    // Skip nullable-in-DB FKs (e.g. client_owner_id) — users can fill them in after import.
    const skipRequired = new Set(["client_owner_id"]);
    for (const f of resource.fields) {
      if (skipRequired.has(f.name)) continue;
      if (f.required && !(f.name in normalized) && !errors.some((e) => e.includes(f.name))) {
        errors.push(`Missing required: ${f.name}`);
      }
    }

    // Products: dedupe by SKU (insert-only)
    if (resource.table === "products" && normalized.sku) {
      const sku = String(normalized.sku).toLowerCase();
      if (seenInFile.has(sku)) errors.push(`Duplicate SKU "${normalized.sku}" within file`);
      else seenInFile.add(sku);
      if (existingSkus?.has(sku)) errors.push(`SKU "${normalized.sku}" already exists`);
    }

    return {
      rowNumber: idx + 2,
      raw,
      normalized: errors.length === 0 ? normalized : null,
      errors,
      warnings,
    };
  });

  const valid = preview.filter((r) => r.normalized).length;
  return {
    resourceTable: resource.table,
    headers,
    rows: preview,
    summary: { total: preview.length, valid, invalid: preview.length - valid },
    file,
  };
}

export async function commitImportRows(
  resource: ResourceDefinition,
  preview: ImportPreview,
): Promise<{ inserted: number; failed: number; errors: Array<{ row: number; error: string }> }> {
  const errors: Array<{ row: number; error: string }> = [];
  let inserted = 0;
  for (const row of preview.rows) {
    if (!row.normalized) continue;
    const { error } = await db(resource.table).insert(row.normalized as never).select();
    if (error) {
      errors.push({ row: row.rowNumber, error: formatSupabaseError(error, "Insert failed") });
    } else {
      inserted++;
    }
  }
  // Best-effort archive of the original file
  try {
    await supabase.storage.from("imports").upload(
      `${resource.table}/${Date.now()}-${preview.file.name}`,
      preview.file,
      { cacheControl: "3600", upsert: true },
    );
  } catch { /* ignore */ }
  return { inserted, failed: errors.length, errors };
}

export async function snapshotRecordCounts() {
  const tables = [
    "warehouses", "zones", "locations", "clients", "products",
    "pallets", "inventory_balances", "receipts", "putaway_tasks",
    "pick_lists", "transfers", "cycle_counts", "audit_events",
  ];

  const counts = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await db(table).select("*", { count: "exact", head: true });
      return { table, count: error ? null : (count ?? 0) };
    }),
  );

  await Promise.all(
    counts.map(({ table, count }) =>
      count !== null
        ? writeSystemLog({
            log_type: "record_count",
            severity: "info",
            title: `Record count snapshot: ${table}`,
            table_name: table,
            record_count: count,
            source: "snapshot",
          })
        : Promise.resolve(),
    ),
  );

  return counts;
}
