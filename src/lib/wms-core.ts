import { z } from "zod";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";

// Helper to bypass strict Supabase typing for tables not yet in the schema.
// Once all WMS tables are migrated, this can be replaced with direct supabase.from() calls.
const db = supabase.from.bind(supabase) as (table: string) => ReturnType<typeof supabase.from>;
// These types will come from the DB once all WMS tables are created.
// For now we define them locally so the code compiles.
export type RoleCode =
  | "admin"
  | "warehouse_manager"
  | "inventory_clerk"
  | "warehouse_operator"
  | "dispatch_driver";

export type InventoryStatus = string;
export type TaskStatus = string;
export type TemperatureClass = string;

export type AppRoute =
  | "/"
  | "/dashboard"
  | "/warehouses"
  | "/zones"
  | "/locations"
  | "/products"
  | "/packaging-profiles"
  | "/receiving"
  | "/putaway-tasks"
  | "/inventory-search"
  | "/inventory/:balanceId"
  | "/pick-lists"
  | "/pick-lists/:pickListId"
  | "/transfers"
  | "/cycle-counts"
  | "/status"
  | "/reports"
  | "/users"
  | "/settings";

type FieldType = "text" | "textarea" | "number" | "select" | "boolean" | "date";

export type FieldDefinition = {
  name: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  description?: string;
  required?: boolean;
};

export type ResourceDefinition<T extends string = string> = {
  table: T;
  title: string;
  description: string;
  singular: string;
  fields: FieldDefinition[];
  orderBy?: { column: string; ascending?: boolean };
  select?: string;
  roles: RoleCode[];
  importable?: boolean;
  exportable?: boolean;
};

export type DashboardMetrics = {
  totalPallets: number;
  availablePallets: number;
  coolZoneOccupancy: number;
  openReceipts: number;
  openPutawayTasks: number;
  openPickLists: number;
  holdStock: number;
  quarantineStock: number;
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  admin: "Admin",
  warehouse_manager: "Warehouse Manager",
  inventory_clerk: "Inventory Clerk",
  warehouse_operator: "Warehouse Operator",
  dispatch_driver: "Dispatch Driver",
};

export const NAVIGATION: Array<{ label: string; to: AppRoute; roles: RoleCode[] }> = [
  { label: "Dashboard", to: "/dashboard", roles: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"] },
  { label: "Warehouses", to: "/warehouses", roles: ["admin", "warehouse_manager"] },
  { label: "Zones", to: "/zones", roles: ["admin", "warehouse_manager"] },
  { label: "Locations", to: "/locations", roles: ["admin", "warehouse_manager"] },
  { label: "Products", to: "/products", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Packaging", to: "/packaging-profiles", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Receiving", to: "/receiving", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Putaway", to: "/putaway-tasks", roles: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"] },
  { label: "Inventory", to: "/inventory-search", roles: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"] },
  { label: "Pick Lists", to: "/pick-lists", roles: ["admin", "warehouse_manager", "warehouse_operator"] },
  { label: "Transfers", to: "/transfers", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Cycle Counts", to: "/cycle-counts", roles: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"] },
  { label: "Statuses", to: "/status", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Reports", to: "/reports", roles: ["admin", "warehouse_manager", "inventory_clerk"] },
  { label: "Users", to: "/users", roles: ["admin"] },
  { label: "Settings", to: "/settings", roles: ["admin", "warehouse_manager"] },
];

const tempOptions: FieldDefinition["options"] = [
  { label: "Ambient", value: "ambient" },
  { label: "Cool", value: "cool" },
  { label: "Frozen", value: "frozen" },
];

const taskStatusOptions: FieldDefinition["options"] = [
  { label: "Draft", value: "draft" },
  { label: "Queued", value: "queued" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Exception", value: "exception" },
];

export const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  warehouses: {
    table: "warehouses",
    title: "Warehouses",
    description: "Maintain the physical warehouse network and warehouse-level flags.",
    singular: "warehouse",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: false,
    exportable: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "city", label: "City", type: "text" },
      { name: "country", label: "Country", type: "text" },
      { name: "has_cool_zone", label: "Has cool zone", type: "boolean" },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  zones: {
    table: "zones",
    title: "Zones",
    description: "Ambient, cool, staging, and quarantine zones inside each warehouse.",
    singular: "zone",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: false,
    exportable: true,
    fields: [
      { name: "warehouse_id", label: "Warehouse ID", type: "text", required: true },
      { name: "code", label: "Code", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "temperature_class", label: "Temperature", type: "select", options: tempOptions, required: true },
      { name: "is_staging", label: "Staging zone", type: "boolean" },
      { name: "is_dispatch", label: "Dispatch zone", type: "boolean" },
      { name: "is_quarantine", label: "Quarantine zone", type: "boolean" },
    ],
  },
  locations: {
    table: "locations",
    title: "Locations",
    description: "Rack, staging, and quarantine locations with capacity and sequencing.",
    singular: "location",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: true,
    exportable: true,
    fields: [
      { name: "warehouse_id", label: "Warehouse ID", type: "text", required: true },
      { name: "zone_id", label: "Zone ID", type: "text", required: true },
      { name: "code", label: "Code", type: "text", required: true },
      { name: "aisle", label: "Aisle", type: "text" },
      { name: "bay", label: "Bay", type: "text" },
      { name: "level", label: "Level", type: "number" },
      { name: "depth", label: "Depth", type: "number", required: true },
      { name: "location_type", label: "Type", type: "select", options: [
        { label: "Rack", value: "rack" },
        { label: "Staging", value: "staging" },
        { label: "Quarantine", value: "quarantine" },
        { label: "Dispatch", value: "dispatch" },
        { label: "Receiving", value: "receiving" },
        { label: "Floor", value: "floor" },
        { label: "Returns", value: "returns" },
      ], required: true },
      { name: "temperature_class", label: "Temperature", type: "select", options: tempOptions, required: true },
      { name: "max_pallets", label: "Max pallets", type: "number", required: true },
      { name: "pick_sequence", label: "Pick sequence", type: "number" },
      { name: "putaway_sequence", label: "Putaway sequence", type: "number" },
      { name: "mixed_sku_allowed", label: "Mixed SKU allowed", type: "boolean" },
      { name: "mixed_lot_allowed", label: "Mixed lot allowed", type: "boolean" },
      { name: "status", label: "Status", type: "select", options: [
        { label: "Active", value: "active" },
        { label: "Blocked", value: "blocked" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Disabled", value: "disabled" },
      ], required: true },
    ],
  },
  products: {
    table: "products",
    title: "Products",
    description: "Manage owner-specific SKUs, barcodes, dimensions, and rotation policy.",
    singular: "product",
    roles: ["admin", "warehouse_manager", "inventory_clerk"],
    orderBy: { column: "sku" },
    importable: true,
    exportable: true,
    fields: [
      { name: "sku", label: "SKU", type: "text", required: true },
      { name: "barcode", label: "Barcode", type: "text" },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "client_owner_id", label: "Client ID", type: "text", required: true },
      { name: "product_family", label: "Family", type: "text" },
      { name: "temperature_requirement", label: "Temperature", type: "select", options: tempOptions, required: true },
      { name: "lot_tracked", label: "Lot tracked", type: "boolean" },
      { name: "batch_tracked", label: "Batch tracked", type: "boolean" },
      { name: "expiry_tracked", label: "Expiry tracked", type: "boolean" },
      { name: "rotation_method", label: "Rotation", type: "select", options: [
        { label: "FIFO", value: "fifo" },
        { label: "FEFO", value: "fefo" },
      ], required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  packagingProfiles: {
    table: "product_packaging_profiles",
    title: "Packaging Profiles",
    description: "Unit, carton, pallet, and custom packed forms for each product.",
    singular: "packaging profile",
    roles: ["admin", "warehouse_manager", "inventory_clerk"],
    orderBy: { column: "profile_name" },
    importable: true,
    exportable: true,
    fields: [
      { name: "product_id", label: "Product ID", type: "text", required: true },
      { name: "profile_name", label: "Profile name", type: "text", required: true },
      { name: "package_type", label: "Package type", type: "text", required: true },
      { name: "units_per_package", label: "Units per package", type: "number", required: true },
      { name: "length", label: "Length", type: "number" },
      { name: "width", label: "Width", type: "number" },
      { name: "height", label: "Height", type: "number" },
      { name: "weight", label: "Weight", type: "number" },
      { name: "barcode", label: "Barcode", type: "text" },
      { name: "is_default", label: "Default", type: "boolean" },
    ],
  },
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const receivingSchema = z.object({
  receipt_type: z.enum(["po", "transfer", "manual"]),
  reference_number: z.string().min(2),
  warehouse_id: z.string().uuid(),
  client_id: z.string().uuid(),
  product_id: z.string().uuid(),
  packaging_profile_id: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive(),
  lot_number: z.string().optional(),
  batch_number: z.string().optional(),
  manufacture_date: z.string().optional(),
  expiry_date: z.string().optional(),
  loading_date: z.string().optional(),
  rotation_date: z.string().optional(),
  override_length: z.coerce.number().optional(),
  override_width: z.coerce.number().optional(),
  override_height: z.coerce.number().optional(),
  override_weight: z.coerce.number().optional(),
});

export const pickListSchema = z.object({
  warehouse_id: z.string().uuid(),
  client_id: z.string().uuid(),
  order_number: z.string().min(2),
  requested_ship_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export const transferSchema = z.object({
  transfer_type: z.enum(["inter_warehouse", "intra_warehouse"]),
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  pallet_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export const cycleCountSchema = z.object({
  warehouse_id: z.string().uuid(),
  scope: z.enum(["location", "zone", "sku", "spot"]),
  location_id: z.string().uuid().optional().or(z.literal("")),
  zone_id: z.string().uuid().optional().or(z.literal("")),
  product_id: z.string().uuid().optional().or(z.literal("")),
  variance_threshold_percent: z.coerce.number().min(0).max(100).default(5),
});

export const statusChangeSchema = z.object({
  pallet_id: z.string().uuid(),
  new_status: z.enum(["hold", "quarantine", "damaged", "available", "missing"]),
  reason: z.string().min(3),
});

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
  locationStatus: Enums<"location_status">;
  locationMaxPallets: number;
  occupiedPallets: number;
  mixedSkuAllowed: boolean;
  hasOtherSku: boolean;
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
  return { valid: true, reason: "Assignment valid" };
}

export async function listRecords(
  table: string,
  select = "*",
  orderBy?: { column: string; ascending?: boolean },
) {
  let query = (supabase.from as any)(table).select(select);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertRecord(
  table: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (supabase.from as any)(table).upsert(payload as never).select().single();
  if (error) throw error;
  return data as any;
}

export async function deleteRecord(table: string, id: string) {
  const { error } = await (supabase.from as any)(table).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchOptions() {
  const [warehouses, zones, locations, clients, products, packagingProfiles, pallets, profiles, roles, userRoles] = await Promise.all([
    listRecords("warehouses"),
    listRecords("zones"),
    listRecords("locations"),
    listRecords("clients"),
    listRecords("products"),
    listRecords("product_packaging_profiles"),
    listRecords("pallets"),
    listRecords("profiles"),
    listRecords("roles"),
    supabase.from("user_roles").select("*, roles(code, name)").then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    }),
  ]);

  return { warehouses, zones, locations, clients, products, packagingProfiles, pallets, profiles, roles, userRoles };
}

function buildPalletCode(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}

async function resolveInventoryLot(payload: z.infer<typeof receivingSchema>) {
  const lotMatch = await supabase
    .from("inventory_lots")
    .select("*")
    .eq("product_id", payload.product_id)
    .eq("client_id", payload.client_id)
    .eq("lot_number", payload.lot_number ?? null)
    .eq("batch_number", payload.batch_number ?? null)
    .maybeSingle();

  if (lotMatch.data) {
    return lotMatch.data;
  }

  const { data, error } = await supabase
    .from("inventory_lots")
    .insert({
      product_id: payload.product_id,
      client_id: payload.client_id,
      lot_number: payload.lot_number ?? null,
      batch_number: payload.batch_number ?? null,
      manufacture_date: payload.manufacture_date || null,
      expiry_date: payload.expiry_date || null,
      loading_date: payload.loading_date || null,
      rotation_date: payload.rotation_date || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createLabelRecord(label_type: Enums<"label_type">, entityId: string, labelCode: string) {
  const { error } = await supabase.from("barcode_labels").insert({
    label_type,
    entity_id: entityId,
    label_code: labelCode,
    last_printed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function createReceiptFlow(input: z.infer<typeof receivingSchema>) {
  const payload = receivingSchema.parse(input);
  const lot = await resolveInventoryLot(payload);
  const receiptNumber = buildPalletCode("RCT");
  const palletCode = buildPalletCode("PLT");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", payload.product_id)
    .single();

  if (productError) throw productError;

  const { data: packagingProfile } = payload.packaging_profile_id
    ? await supabase.from("product_packaging_profiles").select("*").eq("id", payload.packaging_profile_id).single()
    : { data: null };

  const receipt = await upsertRecord("receipts", {
    receipt_number: receiptNumber,
    receipt_type: payload.receipt_type,
    reference_number: payload.reference_number,
    warehouse_id: payload.warehouse_id,
    client_id: payload.client_id,
    status: "completed",
  });

  const receiptLine = await upsertRecord("receipt_lines", {
    receipt_id: receipt.id,
    product_id: payload.product_id,
    packaging_profile_id: payload.packaging_profile_id || null,
    client_id: payload.client_id,
    quantity: payload.quantity,
    received_quantity: payload.quantity,
    inventory_lot_id: lot.id,
    override_length: payload.override_length ?? null,
    override_width: payload.override_width ?? null,
    override_height: payload.override_height ?? null,
    override_weight: payload.override_weight ?? null,
  });

  const pallet = await upsertRecord("pallets", {
    pallet_code: palletCode,
    pallet_barcode: palletCode,
    product_id: payload.product_id,
    client_id: payload.client_id,
    receipt_line_id: receiptLine.id,
    current_warehouse_id: payload.warehouse_id,
    inventory_lot_id: lot.id,
    packaging_profile_id: payload.packaging_profile_id || null,
    quantity: payload.quantity,
    available_quantity: 0,
    status: "receiving",
    is_stored: false,
    length: payload.override_length ?? packagingProfile?.length ?? product.length,
    width: payload.override_width ?? packagingProfile?.width ?? product.width,
    height: payload.override_height ?? packagingProfile?.height ?? product.height,
    weight: payload.override_weight ?? packagingProfile?.weight ?? product.weight,
  });

  await upsertRecord("inventory_balances", {
    pallet_id: pallet.id,
    product_id: payload.product_id,
    client_id: payload.client_id,
    warehouse_id: payload.warehouse_id,
    inventory_lot_id: lot.id,
    status: "receiving",
    quantity: payload.quantity,
    available_quantity: 0,
    expiry_date: lot.expiry_date,
  });

  const suggestions = await supabase.rpc("directed_putaway_candidates", { in_pallet_id: pallet.id });
  if (suggestions.error) throw suggestions.error;
  const topSuggestion = suggestions.data?.[0] ?? null;

  const putawayTask = await upsertRecord("putaway_tasks", {
    task_number: buildPalletCode("PTA"),
    pallet_id: pallet.id,
    warehouse_id: payload.warehouse_id,
    suggested_location_id: topSuggestion?.location_id ?? null,
    status: "queued",
  });

  await supabase.rpc("log_audit_event", {
    in_event_type: "receipt",
    in_entity_table: "pallets",
    in_entity_id: pallet.id,
    in_pallet_id: pallet.id,
    in_warehouse_id: payload.warehouse_id,
    in_metadata: {
      receipt_id: receipt.id,
      receipt_line_id: receiptLine.id,
      quantity: payload.quantity,
    } satisfies Json,
  });

  await createLabelRecord("pallet", pallet.id, palletCode);

  return { receipt, receiptLine, pallet, putawayTask, topSuggestion };
}

export async function searchInventory(filters: {
  search?: string;
  warehouseId?: string;
  status?: InventoryStatus | "all";
}) {
  let query = supabase.from("inventory_search_view").select("*");

  if (filters.search) {
    query = query.or(
      [
        `sku.ilike.%${filters.search}%`,
        `product_name.ilike.%${filters.search}%`,
        `product_barcode.ilike.%${filters.search}%`,
        `pallet_code.ilike.%${filters.search}%`,
        `pallet_barcode.ilike.%${filters.search}%`,
        `lot_number.ilike.%${filters.search}%`,
        `batch_number.ilike.%${filters.search}%`,
        `location_code.ilike.%${filters.search}%`,
      ].join(","),
    );
  }

  if (filters.warehouseId) {
    query = query.eq("warehouse_id", filters.warehouseId);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Views<"inventory_search_view">[];
}

export async function getInventoryDetail(balanceId: string) {
  const { data: balance, error: balanceError } = await supabase
    .from("inventory_balances")
    .select("*")
    .eq("id", balanceId)
    .single();
  if (balanceError) throw balanceError;

  const [{ data: pallet }, { data: audit }, { data: lot }] = await Promise.all([
    supabase.from("pallets").select("*").eq("id", balance.pallet_id).single(),
    supabase.from("audit_events").select("*").eq("pallet_id", balance.pallet_id).order("created_at", { ascending: false }),
    balance.inventory_lot_id
      ? supabase.from("inventory_lots").select("*").eq("id", balance.inventory_lot_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    balance,
    pallet: pallet.data ?? null,
    lot: lot.data ?? null,
    audit: audit ?? [],
  };
}

export async function getPutawayTasks(userId?: string) {
  let query = supabase
    .from("putaway_tasks")
    .select("*, pallets(*), locations: suggested_location_id(*)")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("assigned_user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function confirmPutaway(taskId: string, scannedPalletBarcode: string, scannedLocationCode: string) {
  const { data: task, error: taskError } = await supabase
    .from("putaway_tasks")
    .select("*, pallets(*), locations: suggested_location_id(*), products: pallets(product_id)")
    .eq("id", taskId)
    .single();

  if (taskError) throw taskError;

  const pallet = task.pallets as any;
  if (!pallet || pallet.pallet_barcode !== scannedPalletBarcode) {
    throw new Error("Scanned pallet barcode does not match the task pallet.");
  }

  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("*")
    .eq("code", scannedLocationCode)
    .single();
  if (locationError) throw locationError;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", pallet.product_id)
    .single();
  if (productError) throw productError;

  const ruleCheck = validatePutawayAssignment({
    productTemperature: product.temperature_requirement,
    locationTemperature: location.temperature_class,
    locationStatus: location.status,
    locationMaxPallets: location.max_pallets,
    occupiedPallets: 0,
    mixedSkuAllowed: location.mixed_sku_allowed,
    hasOtherSku: false,
  });

  if (!ruleCheck.valid) {
    throw new Error(ruleCheck.reason);
  }

  await Promise.all([
    supabase
      .from("pallets")
      .update({
        current_location_id: location.id,
        current_warehouse_id: location.warehouse_id,
        status: "available",
        is_stored: true,
        available_quantity: pallet.quantity,
      })
      .eq("id", pallet.id),
    supabase
      .from("inventory_balances")
      .update({
        warehouse_id: location.warehouse_id,
        zone_id: location.zone_id,
        location_id: location.id,
        status: "available",
        available_quantity: pallet.quantity,
      })
      .eq("pallet_id", pallet.id),
    supabase
      .from("putaway_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId),
  ]);

  await supabase.rpc("log_audit_event", {
    in_event_type: "putaway",
    in_entity_table: "putaway_tasks",
    in_entity_id: taskId,
    in_pallet_id: pallet.id,
    in_warehouse_id: location.warehouse_id,
    in_to_location_id: location.id,
    in_metadata: {
      location_code: location.code,
      pallet_barcode: pallet.pallet_barcode,
    } satisfies Json,
  });
}

async function selectPickCandidates(productId: string, warehouseId: string, quantity: number) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();

  const { data, error } = await supabase
    .from("inventory_search_view")
    .select("*")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .eq("status", "available")
    .gt("available_quantity", 0);
  if (error) throw error;

  const candidates = [...(data ?? [])].sort((left, right) => {
    if (product?.rotation_method === "fefo") {
      return (left.expiry_date ?? "9999-12-31").localeCompare(right.expiry_date ?? "9999-12-31");
    }
    return left.received_at.localeCompare(right.received_at);
  });

  const chosen: Views<"inventory_search_view">[] = [];
  let remaining = quantity;
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    chosen.push(candidate);
    remaining -= candidate.available_quantity;
  }

  return { candidates: chosen, short: remaining > 0 ? remaining : 0 };
}

export async function createPickListFlow(input: z.infer<typeof pickListSchema>) {
  const payload = pickListSchema.parse(input);
  const orderNumber = payload.order_number;

  const order = await upsertRecord("orders", {
    order_number: orderNumber,
    client_id: payload.client_id,
    warehouse_id: payload.warehouse_id,
    requested_ship_date: payload.requested_ship_date || null,
    status: "queued",
    notes: payload.notes || null,
  });

  const pickList = await upsertRecord("pick_lists", {
    pick_list_number: buildPalletCode("PKL"),
    warehouse_id: payload.warehouse_id,
    client_id: payload.client_id,
    order_id: order.id,
    consolidated: payload.lines.length > 1,
    status: "queued",
    released_at: new Date().toISOString(),
    notes: payload.notes || null,
  });

  for (const line of payload.lines) {
    const orderLine = await upsertRecord("order_lines", {
      order_id: order.id,
      product_id: line.product_id,
      quantity: line.quantity,
    });

    const selection = await selectPickCandidates(line.product_id, payload.warehouse_id, line.quantity);
    for (const candidate of selection.candidates) {
      await upsertRecord("pick_tasks", {
        task_number: buildPalletCode("PKT"),
        pick_list_id: pickList.id,
        order_line_id: orderLine.id,
        pallet_id: candidate.pallet_id,
        location_id: candidate.location_code ? undefined : null,
        requested_quantity: Math.min(candidate.available_quantity, line.quantity),
        status: selection.short > 0 ? "exception" : "queued",
        short_reason: selection.short > 0 ? `Short by ${selection.short}` : null,
      });
    }
  }

  await createLabelRecord("pick_list", pickList.id, pickList.pick_list_number);
  return pickList;
}

export async function listPickLists() {
  const { data, error } = await supabase
    .from("pick_lists")
    .select("*, pick_tasks(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPickExecution(pickListId: string) {
  const [pickList, pickTasks] = await Promise.all([
    supabase.from("pick_lists").select("*").eq("id", pickListId).single(),
    supabase
      .from("pick_tasks")
      .select("*")
      .eq("pick_list_id", pickListId)
      .order("created_at", { ascending: true }),
  ]);

  if (pickList.error) throw pickList.error;
  if (pickTasks.error) throw pickTasks.error;

  return {
    pickList: pickList.data,
    pickTasks: pickTasks.data ?? [],
  };
}

export async function confirmPickTask(taskId: string, scannedLocation: string, scannedPallet: string, confirmedQuantity: number, shortReason?: string) {
  const { data: task, error: taskError } = await supabase
    .from("pick_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (taskError) throw taskError;

  if (!task.pallet_id) {
    throw new Error("Task is not linked to a pallet.");
  }

  const [{ data: pallet, error: palletError }, { data: balance, error: balanceError }] = await Promise.all([
    supabase.from("pallets").select("*").eq("id", task.pallet_id).single(),
    supabase.from("inventory_balances").select("*").eq("pallet_id", task.pallet_id).single(),
  ]);

  if (palletError) throw palletError;
  if (balanceError) throw balanceError;
  if (pallet.pallet_barcode !== scannedPallet) {
    throw new Error("Scanned pallet does not match the task.");
  }

  const location = balance.location_id
    ? await supabase.from("locations").select("*").eq("id", balance.location_id).single()
    : { data: null, error: null };
  if (location.error) throw location.error;
  if (location.data && location.data.code !== scannedLocation) {
    throw new Error("Scanned location does not match the suggested pick location.");
  }

  const nextAvailable = Math.max(balance.available_quantity - confirmedQuantity, 0);
  const nextStatus: InventoryStatus = nextAvailable === 0 ? "picked" : "available";

  await Promise.all([
    supabase
      .from("pick_tasks")
      .update({
        confirmed_quantity: confirmedQuantity,
        short_reason: shortReason ?? null,
        status: shortReason ? "exception" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId),
    supabase
      .from("pallets")
      .update({
        available_quantity: nextAvailable,
        status: nextStatus,
      })
      .eq("id", pallet.id),
    supabase
      .from("inventory_balances")
      .update({
        available_quantity: nextAvailable,
        status: nextStatus,
      })
      .eq("id", balance.id),
  ]);

  await supabase.rpc("log_audit_event", {
    in_event_type: "pick",
    in_entity_table: "pick_tasks",
    in_entity_id: taskId,
    in_pallet_id: pallet.id,
    in_warehouse_id: balance.warehouse_id,
    in_from_location_id: balance.location_id,
    in_metadata: {
      confirmed_quantity: confirmedQuantity,
      short_reason: shortReason ?? null,
    } satisfies Json,
  });
}

export async function createTransferFlow(input: z.infer<typeof transferSchema>) {
  const payload = transferSchema.parse(input);
  const transfer = await upsertRecord("transfers", {
    transfer_number: buildPalletCode("TRF"),
    transfer_type: payload.transfer_type,
    source_warehouse_id: payload.source_warehouse_id,
    destination_warehouse_id: payload.destination_warehouse_id,
    status: "queued",
    notes: payload.notes || null,
  });

  const { data: pallet, error: palletError } = await supabase.from("pallets").select("*").eq("id", payload.pallet_id).single();
  if (palletError) throw palletError;

  await upsertRecord("transfer_lines", {
    transfer_id: transfer.id,
    pallet_id: payload.pallet_id,
    product_id: pallet.product_id,
    client_id: pallet.client_id,
    quantity: payload.quantity,
    inventory_lot_id: pallet.inventory_lot_id,
  });

  await upsertRecord("move_tasks", {
    task_number: buildPalletCode("MOV"),
    pallet_id: payload.pallet_id,
    warehouse_id: payload.source_warehouse_id,
    transfer_id: transfer.id,
    from_location_id: pallet.current_location_id,
    status: "queued",
    reason: "Transfer dispatch",
  });

  await createLabelRecord("transfer_document", transfer.id, transfer.transfer_number);
  return transfer;
}

export async function dispatchTransfer(transferId: string) {
  const { data: lines, error: linesError } = await supabase.from("transfer_lines").select("*").eq("transfer_id", transferId);
  if (linesError) throw linesError;

  for (const line of lines ?? []) {
    if (!line.pallet_id) continue;
    await Promise.all([
      supabase.from("pallets").update({ status: "in_transit", current_location_id: null }).eq("id", line.pallet_id),
      supabase.from("inventory_balances").update({ status: "in_transit", location_id: null, zone_id: null }).eq("pallet_id", line.pallet_id),
    ]);
  }

  await supabase.from("transfers").update({ status: "in_progress", dispatched_at: new Date().toISOString() }).eq("id", transferId);
}

export async function receiveTransfer(transferId: string) {
  const { data: transfer, error: transferError } = await supabase.from("transfers").select("*").eq("id", transferId).single();
  if (transferError) throw transferError;
  const { data: lines, error: linesError } = await supabase.from("transfer_lines").select("*").eq("transfer_id", transferId);
  if (linesError) throw linesError;

  for (const line of lines ?? []) {
    if (!line.pallet_id) continue;
    await Promise.all([
      supabase
        .from("pallets")
        .update({ current_warehouse_id: transfer.destination_warehouse_id, status: "receiving", current_location_id: null, is_stored: false })
        .eq("id", line.pallet_id),
      supabase
        .from("inventory_balances")
        .update({ warehouse_id: transfer.destination_warehouse_id, status: "receiving", location_id: null, zone_id: null })
        .eq("pallet_id", line.pallet_id),
      upsertRecord("putaway_tasks", {
        task_number: buildPalletCode("PTA"),
        pallet_id: line.pallet_id,
        warehouse_id: transfer.destination_warehouse_id,
        status: "queued",
      }),
    ]);
  }

  await supabase.from("transfers").update({ status: "completed", received_at: new Date().toISOString() }).eq("id", transferId);
}

export async function listTransfers() {
  const { data, error } = await supabase.from("transfers").select("*, transfer_lines(*)").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCycleCountFlow(input: z.infer<typeof cycleCountSchema>) {
  const payload = cycleCountSchema.parse(input);
  const count = await upsertRecord("cycle_counts", {
    count_number: buildPalletCode("CNT"),
    warehouse_id: payload.warehouse_id,
    zone_id: payload.zone_id || null,
    location_id: payload.location_id || null,
    scope: payload.scope,
    status: "queued",
    variance_threshold_percent: payload.variance_threshold_percent,
  });

  let balanceQuery = supabase.from("inventory_balances").select("*").eq("warehouse_id", payload.warehouse_id);
  if (payload.location_id) balanceQuery = balanceQuery.eq("location_id", payload.location_id);
  if (payload.zone_id) balanceQuery = balanceQuery.eq("zone_id", payload.zone_id);
  if (payload.product_id) balanceQuery = balanceQuery.eq("product_id", payload.product_id);

  const { data: balances, error } = await balanceQuery;
  if (error) throw error;

  for (const balance of balances ?? []) {
    await upsertRecord("cycle_count_lines", {
      cycle_count_id: count.id,
      location_id: balance.location_id,
      product_id: balance.product_id,
      pallet_id: balance.pallet_id,
      expected_quantity: balance.quantity,
      counted_quantity: balance.quantity,
      variance_quantity: 0,
      variance_percent: 0,
      status: "queued",
    });
  }

  await createLabelRecord("count_sheet", count.id, count.count_number);
  return count;
}

export async function listCycleCounts() {
  const { data, error } = await supabase.from("cycle_counts").select("*, cycle_count_lines(*)").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitCycleCountLine(lineId: string, countedQuantity: number) {
  const { data: line, error: lineError } = await supabase.from("cycle_count_lines").select("*").eq("id", lineId).single();
  if (lineError) throw lineError;

  const varianceQuantity = countedQuantity - line.expected_quantity;
  const variancePercent = line.expected_quantity === 0 ? 0 : Math.abs((varianceQuantity / line.expected_quantity) * 100);

  await supabase
    .from("cycle_count_lines")
    .update({
      counted_quantity: countedQuantity,
      variance_quantity: varianceQuantity,
      variance_percent: variancePercent,
      status: varianceQuantity === 0 ? "completed" : "exception",
    })
    .eq("id", lineId);

  if (line.pallet_id) {
    await Promise.all([
      supabase.from("pallets").update({ quantity: countedQuantity, available_quantity: countedQuantity }).eq("id", line.pallet_id),
      supabase.from("inventory_balances").update({ quantity: countedQuantity, available_quantity: countedQuantity }).eq("pallet_id", line.pallet_id),
      upsertRecord("stock_adjustments", {
        adjustment_number: buildPalletCode("ADJ"),
        pallet_id: line.pallet_id,
        adjustment_type: "cycle_count",
        quantity_delta: varianceQuantity,
        reason: `Cycle count variance ${varianceQuantity}`,
      }),
    ]);
  }
}

export async function listStatusPallets() {
  const { data, error } = await supabase
    .from("inventory_search_view")
    .select("*")
    .in("status", ["hold", "quarantine", "damaged", "missing"])
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function changePalletStatus(input: z.infer<typeof statusChangeSchema>) {
  const payload = statusChangeSchema.parse(input);
  const { data: balance, error: balanceError } = await supabase.from("inventory_balances").select("*").eq("pallet_id", payload.pallet_id).single();
  if (balanceError) throw balanceError;

  await Promise.all([
    supabase.from("pallets").update({ status: payload.new_status }).eq("id", payload.pallet_id),
    supabase.from("inventory_balances").update({ status: payload.new_status }).eq("id", balance.id),
    upsertRecord("stock_adjustments", {
      adjustment_number: buildPalletCode("STS"),
      pallet_id: payload.pallet_id,
      inventory_balance_id: balance.id,
      adjustment_type: "status_change",
      quantity_delta: 0,
      old_status: balance.status,
      new_status: payload.new_status,
      reason: payload.reason,
    }),
  ]);

  await supabase.rpc("log_audit_event", {
    in_event_type: "status_change",
    in_entity_table: "pallets",
    in_entity_id: payload.pallet_id,
    in_pallet_id: payload.pallet_id,
    in_warehouse_id: balance.warehouse_id,
    in_metadata: {
      old_status: balance.status,
      new_status: payload.new_status,
      reason: payload.reason,
    } satisfies Json,
  });
}

export async function getDashboardMetrics() {
  const [balances, receipts, putawayTasks, pickLists] = await Promise.all([
    supabase.from("inventory_balances").select("*"),
    supabase.from("receipts").select("*").in("status", ["draft", "queued", "assigned", "in_progress"]),
    supabase.from("putaway_tasks").select("*").in("status", ["queued", "assigned", "in_progress", "exception"]),
    supabase.from("pick_lists").select("*").in("status", ["draft", "queued", "assigned", "in_progress", "exception"]),
  ]);

  if (balances.error) throw balances.error;
  if (receipts.error) throw receipts.error;
  if (putawayTasks.error) throw putawayTasks.error;
  if (pickLists.error) throw pickLists.error;

  const balanceRows = balances.data ?? [];
  const coolRows = balanceRows.filter((row) => row.zone_id);

  return {
    totalPallets: balanceRows.length,
    availablePallets: balanceRows.filter((row) => row.status === "available").length,
    coolZoneOccupancy: coolRows.length,
    openReceipts: receipts.data?.length ?? 0,
    openPutawayTasks: putawayTasks.data?.length ?? 0,
    openPickLists: pickLists.data?.length ?? 0,
    holdStock: balanceRows.filter((row) => row.status === "hold").length,
    quarantineStock: balanceRows.filter((row) => row.status === "quarantine").length,
  } satisfies DashboardMetrics;
}

export async function getReportData() {
  const [balances, occupancy, audits, clients, warehouses, cycleCounts] = await Promise.all([
    supabase.from("inventory_search_view").select("*"),
    supabase.from("location_occupancy_view").select("*"),
    supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("clients").select("*"),
    supabase.from("warehouses").select("*"),
    supabase.from("cycle_count_lines").select("*").order("updated_at", { ascending: false }).limit(12),
  ]);

  if (balances.error) throw balances.error;
  if (occupancy.error) throw occupancy.error;
  if (audits.error) throw audits.error;
  if (clients.error) throw clients.error;
  if (warehouses.error) throw warehouses.error;
  if (cycleCounts.error) throw cycleCounts.error;

  return {
    inventory: balances.data ?? [],
    occupancy: occupancy.data ?? [],
    audits: audits.data ?? [],
    clients: clients.data ?? [],
    warehouses: warehouses.data ?? [],
    cycleCounts: cycleCounts.data ?? [],
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
      await supabase.from(resource.table).upsert(row as never);
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
