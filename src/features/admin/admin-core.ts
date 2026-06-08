import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import {
  db,
  formatSupabaseError,
  throwIfSupabaseError,
  type FieldDefinition,
  type ResourceDefinition,
  type WarehouseVisibilityScope,
  type ArchiveField,
  type RoleCode,
} from "@/features/shared/core-types";

// Re-export ArchiveField for local use (it's not exported from core-types directly)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ArchiveField = ArchiveField;

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return "0";
  return new Intl.NumberFormat().format(value);
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => JSON.stringify(row[header] ?? ""))
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadCsvTemplate(resource: ResourceDefinition) {
  const rows = [
    resource.fields.map((field) => field.name),
    resource.fields.map((field) => field.label),
    resource.fields.map((field) => templateExampleValue(resource.table, field)),
    resource.fields.map((field) => (field.required ? "required" : "optional")),
  ];
  const csv = rows.map((row) => row.map((value) => JSON.stringify(value ?? "")).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${resource.table}-import-template.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function templateExampleValue(resourceTable: string, field: FieldDefinition) {
  if (field.name.endsWith("_id")) return `replace-with-${field.name}`;
  if (field.type === "boolean") return "true";
  if (field.type === "number") return field.name.includes("sequence") ? "10" : "1";
  if (field.type === "select") return field.options?.[0]?.value ?? "";

  const examples: Record<string, Record<string, string>> = {
    locations: {
      code: "MAIN-STG-A-01-L01",
      aisle: "A",
      bay: "01",
      status: "active",
    },
    products: {
      sku: "SKU-EXAMPLE-001",
      barcode: "0123456789012",
      name: "Example Product",
      description: "Imported product master record",
      product_family: "Ambient",
      rotation_method: "fifo",
    },
  };

  return examples[resourceTable]?.[field.name] ?? "";
}

export function parseCsv(text: string) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",").map((value) => value.trim());

  return lines.map((line) => {
    const values = line.split(",").map((value) => value.replace(/^"|"$/g, "").trim());
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});
  });
}

export function validatePutawayAssignment(input: {
  productTemperature: TemperatureClass;
  locationTemperature: TemperatureClass;
  locationStatus: string;
  locationMaxPallets: number;
  occupiedPallets: number;
  mixedSkuAllowed: boolean;
  hasOtherSku: boolean;
  palletHeightCm?: number | null;
  locationMaxPalletHeightCm?: number | null;
}) {
  if (input.locationStatus !== "active") {
    return { valid: false, reason: "Location is not active" };
  }
  if (input.productTemperature === "cool" && input.locationTemperature !== "cool") {
    return { valid: false, reason: "Cool-chain pallet cannot be placed in a non-cool location" };
  }
  if (input.occupiedPallets >= input.locationMaxPallets) {
    return { valid: false, reason: "Location is full" };
  }
  if (input.hasOtherSku && !input.mixedSkuAllowed) {
    return { valid: false, reason: "Location blocks mixed SKU storage" };
  }
  if (
    input.locationMaxPalletHeightCm != null &&
    input.palletHeightCm != null &&
    input.palletHeightCm > input.locationMaxPalletHeightCm
  ) {
    return {
      valid: false,
      reason: `Pallet height ${input.palletHeightCm} cm exceeds location ceiling of ${input.locationMaxPalletHeightCm} cm`,
    };
  }
  return { valid: true, reason: "Assignment valid" };
}

export function applyArchiveFilter(
  query: any,
  archiveField?: ArchiveField,
  includeHidden = false,
) {
  if (includeHidden || !archiveField) {
    return query;
  }

  if (archiveField === "active") {
    return query.eq("active", true);
  }

  return query.eq("is_hidden", false);
}

export async function listRecords(
  table: string,
  select = "*",
  orderBy?: { column: string; ascending?: boolean },
  options?: { includeHidden?: boolean; archiveField?: ArchiveField },
) {
  let query = (supabase.from as any)(table).select(select);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
  }

  query = applyArchiveFilter(query, options?.archiveField, options?.includeHidden);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertRecord(
  table: string,
  payload: Record<string, unknown>,
) {
  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]),
  );
  const { data, error } = await (supabase.from as any)(table).upsert(cleanedPayload as never).select().single();
  if (error) throw error;
  return data as any;
}

export async function updateRecord(
  table: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]),
  );
  const { data, error } = await (supabase.from as any)(table)
    .update(cleanedPayload as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteRecord(table: string, id: string) {
  const { error } = await (supabase.from as any)(table).delete().eq("id", id);
  if (error) throw error;
}

export async function setResourceVisibility(
  table: string,
  id: string,
  archiveField: ArchiveField,
  hidden: boolean,
  reason?: string,
) {
  const payload =
    archiveField === "active"
      ? { active: !hidden }
      : {
          is_hidden: hidden,
          hidden_at: hidden ? new Date().toISOString() : null,
          hidden_reason: hidden ? reason ?? null : null,
        };

  const { error } = await (supabase.from as any)(table).update(payload).eq("id", id);
  if (error) throw error;
}

export async function setProfileActive(profileId: string, active: boolean) {
  const { error } = await (supabase.from as any)("profiles").update({ active }).eq("id", profileId);
  if (error) throw error;
  await logUserActivity("user_access_change", "profiles", profileId, { active });
}

export async function updateProfileDetails(input: ProfileUpdateInput) {
  const payload = {
    full_name: input.full_name,
    phone: input.phone || null,
    default_warehouse_id: input.default_warehouse_id || null,
    active: input.active,
    approved: input.approved,
    user_code: input.user_code || null,
    badge_code: input.badge_code || null,
  };

  const { error } = await (supabase.from as any)("profiles").update(payload).eq("id", input.profileId);
  if (error) {
    throw new Error(formatSupabaseError(error, "Update failed"));
  }
  await logUserActivity("user_access_change", "profiles", input.profileId, {
    fields: Object.keys(payload),
    approved: input.approved,
    active: input.active,
  });
}

export async function updateProfileDefaultWarehouse(profileId: string, warehouseId: string | null) {
  const { error } = await (supabase.from as any)("profiles")
    .update({ default_warehouse_id: warehouseId })
    .eq("id", profileId);
  if (error) throw error;
  await logUserActivity("user_access_change", "profiles", profileId, {
    fields: ["default_warehouse_id"],
    default_warehouse_id: warehouseId,
  });
}

export type AdminInviteUserInput = {
  email: string;
  full_name: string;
  password: string;
  role_code?: string;
  warehouse_id?: string;
};

export async function adminInviteUser(input: AdminInviteUserInput): Promise<string> {
  // Use the invite-user edge function which calls auth.admin.createUser().
  // Unlike the admin_invite_user RPC (which inserts directly into auth.users),
  // the admin API properly creates auth.identities — required by GoTrue for
  // email/password sign-in.
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: {
      email: input.email,
      fullName: input.full_name,
      password: input.password,
      roleCode: input.role_code ?? null,
      warehouseId: input.warehouse_id ?? null,
    },
  });

  if (error) throw error;

  const result = data as { id?: string; error?: string } | null;
  if (result?.error) throw new Error(result.error);
  if (!result?.id) throw new Error("User creation failed");

  await logUserActivity("user_invited", "profiles", result.id, {
    email: input.email,
    role: input.role_code ?? null,
  });
  return result.id;
}

export async function updateOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message ?? "Password update failed");
}

export async function adminUpdateUserPassword(profileId: string, password: string) {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { error } = await client.rpc("admin_update_user_password", {
    in_user_id: profileId,
    in_password: password,
  });
  if (error) throw new Error((error as any).message ?? "Password update failed");
  await logUserActivity("user_access_change", "profiles", profileId, {
    fields: ["password"],
  });
}

export async function adminDeleteUser(profileId: string) {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { error } = await client.rpc("admin_delete_user", {
    in_user_id: profileId,
  });
  if (error) throw new Error(formatSupabaseError(error, "User delete failed"));
  await logUserActivity("user_deleted", "profiles", profileId, {
    deleted: true,
  });
}

export async function adminUpdateUserPin(profileId: string, pin: string) {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { error } = await client.rpc("admin_update_user_pin", {
    in_user_id: profileId,
    in_pin: pin,
  });
  if (error) throw new Error((error as any).message ?? "Badge PIN update failed");
  await logUserActivity("user_access_change", "profiles", profileId, {
    fields: ["badge_pin"],
  });
}

export async function refreshUserDeviceTrust(deviceId: string) {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { error } = await client.rpc("refresh_user_device_trust", {
    in_device_id: deviceId,
    in_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
  });
  if (error) throw new Error((error as any).message ?? "Device trust update failed");
}

export async function setUserRoleVisibility(userRoleId: string, hidden: boolean, reason?: string) {
  const { error } = await (supabase.from as any)("user_roles")
    .update({ is_hidden: hidden })
    .eq("id", userRoleId);
  if (error) throw new Error(formatSupabaseError(error, "Role update failed"));
  await logUserActivity("user_access_change", "user_roles", userRoleId, { hidden, reason: reason ?? null });
}

export async function removeUserRoleAssignment(userRoleId: string) {
  const { error } = await (supabase.from as any)("user_roles").delete().eq("id", userRoleId);
  if (error) throw new Error(formatSupabaseError(error, "Role unassign failed"));
  await logUserActivity("user_access_change", "user_roles", userRoleId, {
    removed: true,
  });
}

export async function fetchOptions(includeHidden = false, scope?: WarehouseVisibilityScope) {
  const [warehouses, zones, locations, clients, products, packagingProfiles, pallets, profiles, roles, userRoles] = await Promise.all([
    listRecords("warehouses", "*", undefined, { includeHidden, archiveField: "active" }),
    listRecords("zones", "*", undefined, { includeHidden, archiveField: "is_hidden" }),
    listRecords("locations", "*", undefined, { includeHidden, archiveField: "is_hidden" }),
    listRecords("clients"),
    listRecords("products", "*", undefined, { includeHidden, archiveField: "active" }),
    listRecords("product_packaging_profiles", "*", undefined, { includeHidden, archiveField: "is_hidden" }),
    listRecords("pallets"),
    listRecords("profiles", "*", undefined, includeHidden ? undefined : { archiveField: "active" }),
    listRecords("roles"),
    applyArchiveFilter(db("user_roles").select("*, roles(code, name)"), "is_hidden", includeHidden).then(({ data, error }: { data: any; error: any }) => {
      if (error) throw error;
      return data ?? [];
    }),
  ]);

  const scopedWarehouseId = scope?.restrictToWarehouse ? scope.warehouseId : null;

  return {
    warehouses: scopedWarehouseId ? warehouses.filter((warehouse: any) => warehouse.id === scopedWarehouseId) : warehouses,
    zones: scopedWarehouseId ? zones.filter((zone: any) => zone.warehouse_id === scopedWarehouseId) : zones,
    locations: scopedWarehouseId ? locations.filter((location: any) => location.warehouse_id === scopedWarehouseId) : locations,
    clients,
    products,
    packagingProfiles,
    pallets: scopedWarehouseId ? pallets.filter((pallet: any) => pallet.current_warehouse_id === scopedWarehouseId) : pallets,
    profiles,
    roles,
    userRoles,
  };
}

export async function getWarehouseForLocationBarcode(locationCode: string) {
  const normalizedCode = locationCode.trim();
  if (!normalizedCode) throw new Error("Scan a location barcode first.");

  const { data, error } = await db("locations")
    .select("warehouse_id, code, warehouses(id, code, name)")
    .eq("code", normalizedCode)
    .single();
  if (error) throw error;
  return data as any;
}

/** Returns the set of product IDs that have at least 1 available unit in a
 *  known location (location_id IS NOT NULL). Used to gate pick list creation
 *  so operators can't add products that have no pickable stock. */
export async function getPickableProductIds(warehouseId?: string): Promise<Set<string>> {
  let query = db("inventory_balances")
    .select("product_id")
    .eq("status", "available")
    .gt("available_quantity", 0)
    .not("location_id", "is", null);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  const { data, error } = await query;
  if (error) throw error;
  return new Set((data ?? []).map((row: any) => row.product_id as string));
}

export type PickableStockSummary = {
  totalAvailable: number;
  palletCount: number;
  topPallet: {
    pallet_code: string;
    pallet_barcode: string;
    available_quantity: number;
    location_code: string;
    expiry_date: string | null;
  } | null;
};

/** Per-product pickable stock — only counts pallets currently sitting in a
 *  known location with available qty. The `topPallet` is what FEFO/FIFO
 *  selection would pick first, so the UI preview matches what
 *  `selectPickCandidates` will reserve on release. */
export async function getPickableStockSummary(
  warehouseId?: string,
): Promise<Map<string, PickableStockSummary>> {
  let query = db("pallets")
    .select(
      "id, pallet_code, pallet_barcode, product_id, available_quantity, created_at, current_location_id, locations:current_location_id(code), inventory_lots:inventory_lot_id(expiry_date)",
    )
    .eq("status", "available")
    .gt("available_quantity", 0)
    .not("current_location_id", "is", null);
  if (warehouseId) query = query.eq("current_warehouse_id", warehouseId);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as any[];
  rows.sort((a, b) => {
    const ax = a.inventory_lots?.expiry_date ?? null;
    const bx = b.inventory_lots?.expiry_date ?? null;
    if (ax && bx) {
      if (ax < bx) return -1;
      if (ax > bx) return 1;
    } else if (ax && !bx) return -1;
    else if (!ax && bx) return 1;
    const ac = a.created_at ?? "";
    const bc = b.created_at ?? "";
    return ac < bc ? -1 : ac > bc ? 1 : 0;
  });

  const map = new Map<string, PickableStockSummary>();
  for (const row of rows) {
    const productId = row.product_id as string;
    const qty = Number(row.available_quantity ?? 0);
    const existing = map.get(productId);
    if (existing) {
      existing.totalAvailable += qty;
      existing.palletCount += 1;
    } else {
      map.set(productId, {
        totalAvailable: qty,
        palletCount: 1,
        topPallet: {
          pallet_code: row.pallet_code,
          pallet_barcode: row.pallet_barcode,
          available_quantity: qty,
          location_code: row.locations?.code ?? "",
          expiry_date: row.inventory_lots?.expiry_date ?? null,
        },
      });
    }
  }
  return map;
}

export async function listUserActivities(limit = 25) {
  const { data, error } = await db("audit_events")
    .select("*, profiles:actor_user_id(full_name, email)")
    .in("entity_table", ["profiles", "user_roles"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function resolveLoginCode(loginCode: string) {
  const { data, error } = await (supabase.rpc as any)("resolve_login_code", {
    in_login_code: loginCode.trim(),
  });
  if (error) throw error;
  return data as string | null;
}

export async function recordUserSignIn(method: "email" | "code" | "badge") {
  await logUserActivity("user_sign_in", "profiles", undefined, { method });
}

async function logUserActivity(
  eventType: string,
  entityTable: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  const { data: userData } = await supabase.auth.getUser();
  const actorId = userData.user?.id;
  if (!actorId) return;

  const auditR = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: eventType,
    in_entity_table: entityTable,
    in_entity_id: entityId ?? actorId,
    in_metadata: metadata ?? {},
  });
  if (auditR.error) console.error("[logUserActivity] log_audit_event failed:", auditR.error);
}

