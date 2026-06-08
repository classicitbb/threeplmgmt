import { db } from "@/features/shared/core-types";

export type ClientVariable = {
  id: string;
  client_id: string;
  key: string;
  value: string;
  variable_type: "text" | "number" | "boolean" | "date" | "json";
  description: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export async function listClientVariables(clientId?: string) {
  let query = db("client_variables")
    .select("*, clients(code, name)")
    .eq("is_hidden", false)
    .order("client_id")
    .order("key");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertClientVariable(payload: {
  id?: string;
  client_id: string;
  key: string;
  value: string;
  variable_type?: string;
  description?: string;
}) {
  const record = {
    ...(payload.id ? { id: payload.id } : {}),
    client_id: payload.client_id,
    key: payload.key.trim(),
    value: payload.value,
    variable_type: payload.variable_type ?? "text",
    description: payload.description ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db("client_variables").upsert(record as never).select().single();
  if (error) throw error;
  return data as ClientVariable;
}

export async function deleteClientVariable(id: string) {
  const { error } = await db("client_variables").update({ is_hidden: true }).eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Logs
// ─────────────────────────────────────────────────────────────────────────────

export type SystemLogEntry = {
  id: string;
  log_type: "error" | "bug" | "system_change" | "infrastructure" | "record_count" | "info";
  severity: "debug" | "info" | "warning" | "error" | "critical";
  title: string;
  message: string | null;
  details: Record<string, unknown> | null;
  source: string | null;
  table_name: string | null;
  record_count: number | null;
  resolved: boolean;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
};

export async function listSystemLogs(filters?: {
  log_type?: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
}) {
  let query = db("system_logs")
    .select("*, profiles:created_by(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 200);

  if (filters?.log_type && filters.log_type !== "all") {
    query = query.eq("log_type", filters.log_type);
  }
  if (filters?.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters?.resolved !== undefined) {
    query = query.eq("resolved", filters.resolved);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function writeSystemLog(payload: {
  log_type: SystemLogEntry["log_type"];
  severity: SystemLogEntry["severity"];
  title: string;
  message?: string;
  details?: Record<string, unknown>;
  source?: string;
  table_name?: string;
  record_count?: number;
}) {
  const { data, error } = await (supabase.rpc as any)("write_system_log", {
    in_log_type: payload.log_type,
    in_severity: payload.severity,
    in_title: payload.title,
    in_message: payload.message ?? null,
    in_details: payload.details ?? null,
    in_source: payload.source ?? null,
    in_table_name: payload.table_name ?? null,
    in_record_count: payload.record_count ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function resolveSystemLog(id: string) {
  const { error } = await db("system_logs")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
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

// ── Draft receipts ────────────────────────────────────────────────────────────
