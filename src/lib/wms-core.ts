import { z } from "zod";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { validateIso6346ContainerNumber } from "@/lib/container-number";
import { isDesktopClient } from "@/lib/device-identity";

// Helper to bypass strict Supabase typing for tables not yet in the schema.
// Once all WMS tables are migrated, this can be replaced with direct db() calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase.from.bind(supabase) as (table: string) => any;
// These types will come from the DB once all WMS tables are created.
// For now we define them locally so the code compiles.
export type RoleCode =
  | "developer"
  | "admin"
  | "warehouse_manager"
  | "warehouse_supervisor"
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
  | "/clients"
  | "/receiving"
  | "/putaway-tasks"
  | "/inventory-search"
  | "/inventory/:balanceId"
  | "/pick-lists"
  | "/pick-lists/:pickListId"
  | "/transfers"
  | "/location-moves"
  | "/cycle-counts"
  | "/status"
  | "/reports"
  | "/users"
  | "/settings"
  | "/system-log"
  | "/email-log"
  | "/help"
  | "/setup-wizard";

type FieldType = "text" | "textarea" | "number" | "select" | "boolean" | "date";
type ArchiveField = "active" | "is_hidden";

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
  helpId: string;
  supportsHide?: boolean;
  archiveField?: ArchiveField;
};

export type WarehouseVisibilityScope = {
  warehouseId?: string | null;
  restrictToWarehouse?: boolean;
};

export type ProfileUpdateInput = {
  profileId: string;
  full_name: string;
  phone?: string | null;
  default_warehouse_id?: string | null;
  active: boolean;
  approved: boolean;
  user_code?: string | null;
  badge_code?: string | null;
};

function formatSupabaseError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const details = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [details.message, details.details, details.hint, details.code ? `(${details.code})` : null]
      .filter(Boolean)
      .map(String)
      .join(" ");
  }
  return String(error);
}

export type WarehouseSetupWarehouse = {
  code: string;
  name: string;
  city: string;
  country: string;
  hasCoolZone: boolean;
};

export type WarehouseSetupZone = {
  warehouseCode: string;
  code: string;
  name: string;
  temperatureClass: TemperatureClass;
  isStaging: boolean;
  isDispatch: boolean;
  isQuarantine: boolean;
  sortOrder: number;
};

export type WarehouseLocationTemplate = {
  warehouseCode: string;
  zoneCode: string;
  aisleCount: number;
  baysPerAisle: number;
  levels: number;
  maxPallets: number;
  locationType: string;
  temperatureClass: TemperatureClass;
  mixedSkuAllowed: boolean;
  mixedLotAllowed: boolean;
  status: string;
};

export type WarehouseSetupPayload = {
  warehouses: WarehouseSetupWarehouse[];
  zones: WarehouseSetupZone[];
  locationTemplates: WarehouseLocationTemplate[];
};

export type DashboardTaskRow = {
  id: string;
  label: string;
  sublabel: string;
  route: string;
  createdAt: string;
};

export type DashboardMetricKey =
  | "totalPallets"
  | "warehousePallets"
  | "availablePallets"
  | "coolZoneOccupancy"
  | "openReceipts"
  | "openPutawayTasks"
  | "openPickLists"
  | "openMoveTasks"
  | "openTransfers"
  | "openCycleCounts"
  | "openDockLoads"
  | "openReplenishmentTasks"
  | "recentAuditEvents"
  | "holdStock"
  | "quarantineStock"
  | "expiryWarning60"
  | "expiryWarning30"
  | "stockAge3Months"
  | "stockAge6Months"
  | "stockAge12Months";

export type DashboardMetrics = {
  totalPallets: number;
  totalPalletCapacity: number;
  warehousePallets: number;
  warehousePalletCapacity: number;
  availablePallets: number;
  coolZoneOccupancy: number;
  openReceipts: number;
  openPutawayTasks: number;
  openPickLists: number;
  openMoveTasks: number;
  openTransfers: number;
  openCycleCounts: number;
  openDockLoads: number;
  openReplenishmentTasks: number;
  recentAuditEvents: number;
  holdStock: number;
  quarantineStock: number;
  expiryWarning60: number;
  expiryWarning30: number;
  stockAge3Months: number;
  stockAge6Months: number;
  stockAge12Months: number;
  receiptRows: DashboardTaskRow[];
  putawayTaskRows: DashboardTaskRow[];
  pickListRows: DashboardTaskRow[];
  moveTaskRows: DashboardTaskRow[];
  transferRows: DashboardTaskRow[];
  cycleCountRows: DashboardTaskRow[];
  dockLoadRows: DashboardTaskRow[];
  replenishmentRows: DashboardTaskRow[];
  blockedBalanceRows: DashboardTaskRow[];
  dashboardMetricKeys?: DashboardMetricKey[];
};

export function getDashboardMetricKeysForModules(enabledModules?: Partial<Record<string, boolean>>): DashboardMetricKey[] {
  const moduleEnabled = (key: string) => enabledModules?.[key] !== false;
  const metricModules: Array<[string, DashboardMetricKey]> = [
    ["inventory", "totalPallets"],
    ["inventory", "warehousePallets"],
    ["receiving", "openReceipts"],
    ["putaway", "openPutawayTasks"],
    ["pick-lists", "openPickLists"],
    ["location-moves", "openMoveTasks"],
    ["inventory", "expiryWarning30"],
    ["inventory", "expiryWarning60"],
    ["inventory", "stockAge3Months"],
    ["inventory", "stockAge6Months"],
    ["inventory", "stockAge12Months"],
  ];

  return metricModules.flatMap(([moduleKey, metricKey]) => moduleEnabled(moduleKey) ? [metricKey] : []);
}

export type InventoryAgeBucket = "3m" | "6m" | "12m";
export type InventoryExpiryWindow = "30d" | "60d";

export const ROLE_LABELS: Record<RoleCode, string> = {
  developer: "Developer",
  admin: "Admin",
  warehouse_manager: "Warehouse Manager",
  warehouse_supervisor: "Warehouse Supervisor",
  inventory_clerk: "Inventory Clerk",
  warehouse_operator: "Warehouse Operator",
  dispatch_driver: "Dispatch Driver",
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  developer: "Full system capabilities including developer tooling, role management, and all configuration",
  admin: "Full system access including reset, user management, and all configuration",
  warehouse_manager: "Operational control across all warehouse functions and reporting",
  warehouse_supervisor: "Operational oversight with team scheduling, task assignment, and escalation handling",
  inventory_clerk: "Receiving, cycle counts, inventory search, and routine stock moves",
  warehouse_operator: "Assigned task execution and limited inventory search",
  dispatch_driver: "Transfer sign-off and inter-warehouse handoff visibility",
};

export type ModuleKey =
  | "receiving" | "putaway" | "inventory" | "location-moves" | "transfers" | "pick-lists"
  | "products" | "warehouses" | "zones" | "locations" | "users" | "settings"
  | "clients" | "packaging" | "cycle-counts" | "reports" | "status"
  | "system-log" | "email-log";

export const NAVIGATION: Array<{ label: string; to: AppRoute; roles: RoleCode[]; moduleKey?: ModuleKey }> = [
  { label: "Dashboard", to: "/dashboard", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator", "dispatch_driver"] },
  { label: "Receiving", to: "/receiving", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk"], moduleKey: "receiving" },
  { label: "Putaway", to: "/putaway-tasks", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator"], moduleKey: "putaway" },
  { label: "Inventory", to: "/inventory-search", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator"], moduleKey: "inventory" },
  { label: "Pick Lists", to: "/pick-lists", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "warehouse_operator"], moduleKey: "pick-lists" },
  { label: "Location Moves", to: "/location-moves", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator"], moduleKey: "location-moves" },
  { label: "Transfers", to: "/transfers", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "dispatch_driver"], moduleKey: "transfers" },
  { label: "Warehouses", to: "/warehouses", roles: ["developer", "admin", "warehouse_manager"], moduleKey: "warehouses" },
  { label: "Zones", to: "/zones", roles: ["developer", "admin", "warehouse_manager"], moduleKey: "zones" },
  { label: "Locations", to: "/locations", roles: ["developer", "admin", "warehouse_manager"], moduleKey: "locations" },
  { label: "Products", to: "/products", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk"], moduleKey: "products" },
  { label: "Clients", to: "/clients", roles: ["developer", "admin", "warehouse_manager"], moduleKey: "clients" },
  { label: "Settings", to: "/settings", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor"], moduleKey: "settings" },
  { label: "Help", to: "/help", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator", "dispatch_driver"] },
  { label: "Packaging", to: "/packaging-profiles", roles: ["developer", "admin", "warehouse_manager", "inventory_clerk"], moduleKey: "packaging" },
  { label: "Cycle Counts", to: "/cycle-counts", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk", "warehouse_operator"], moduleKey: "cycle-counts" },
  { label: "Statuses", to: "/status", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk"], moduleKey: "status" },
  { label: "Reports", to: "/reports", roles: ["developer", "admin", "warehouse_manager", "warehouse_supervisor", "inventory_clerk"], moduleKey: "reports" },
  { label: "System Log", to: "/system-log", roles: ["developer", "admin", "warehouse_manager"], moduleKey: "system-log" },
  { label: "Email Log", to: "/email-log", roles: ["developer", "admin"], moduleKey: "email-log" },
];

const tempOptions: FieldDefinition["options"] = [
  { label: "Ambient", value: "ambient" },
  { label: "Cool", value: "cool" },
  { label: "Frozen", value: "frozen" },
];

export const taskStatusOptions: FieldDefinition["options"] = [
  { label: "Draft", value: "draft" },
  { label: "Queued", value: "queued" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Exception", value: "exception" },
];

export const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  clients: {
    table: "clients",
    title: "Clients",
    description: "Manage warehouse owners and 3PL clients with their stock-sharing rules.",
    singular: "client",
    helpId: "clients",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: false,
    exportable: true,
    supportsHide: true,
    archiveField: "active",
    fields: [
      { name: "code", label: "Code", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "allow_mixed_stock", label: "Mixed stock", type: "boolean" },
      { name: "allow_mixed_sku_pallet", label: "Mixed SKU pallet", type: "boolean" },
      { name: "allow_mixed_lot_pallet", label: "Mixed lot pallet", type: "boolean" },
      { name: "require_expiry", label: "Require expiry", type: "boolean" },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  warehouses: {
    table: "warehouses",
    title: "Warehouses",
    description: "Maintain the physical warehouse network and warehouse-level flags.",
    singular: "warehouse",
    helpId: "warehouses",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: false,
    exportable: true,
    supportsHide: true,
    archiveField: "active",
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
    helpId: "zones",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: false,
    exportable: true,
    supportsHide: true,
    archiveField: "is_hidden",
    fields: [
      { name: "warehouse_id", label: "Warehouse", type: "select", required: true },
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
    helpId: "locations",
    roles: ["admin", "warehouse_manager"],
    orderBy: { column: "code" },
    importable: true,
    exportable: true,
    supportsHide: true,
    archiveField: "is_hidden",
    fields: [
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
      { name: "pick_sequence", label: "Pick seq", type: "number" },
      { name: "putaway_sequence", label: "Putaway seq", type: "number" },
      { name: "mixed_sku_allowed", label: "Mixed SKU", type: "boolean" },
      { name: "mixed_lot_allowed", label: "Mixed lot", type: "boolean" },
      { name: "max_height", label: "Max height (cm)", type: "number", description: "Leave blank for no height restriction. Set for bays near roof beams." },
      { name: "status", label: "Status", type: "select", options: [
        { label: "Active", value: "active" },
        { label: "Blocked", value: "blocked" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Disabled", value: "disabled" },
      ], required: true },
      { name: "notes", label: "Notes", type: "textarea", description: "Special constraints or beam clearance notes." },
      { name: "warehouse_id", label: "Warehouse", type: "select", required: true },
      { name: "zone_id", label: "Zone", type: "select", required: true },
    ],
  },
  products: {
    table: "products",
    title: "Products",
    description: "Manage owner-specific SKUs, barcodes, dimensions, and rotation policy.",
    singular: "product",
    helpId: "products",
    roles: ["admin", "warehouse_manager", "inventory_clerk"],
    orderBy: { column: "sku" },
    importable: true,
    exportable: true,
    supportsHide: true,
    archiveField: "active",
    fields: [
      { name: "sku", label: "SKU", type: "text", required: true },
      { name: "barcode", label: "Barcode", type: "text" },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "client_owner_id", label: "Client", type: "select", required: true },
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
    helpId: "packaging-profiles",
    roles: ["admin", "warehouse_manager", "inventory_clerk"],
    orderBy: { column: "profile_name" },
    importable: true,
    exportable: true,
    supportsHide: true,
    archiveField: "is_hidden",
    fields: [
      { name: "product_id", label: "Product", type: "select", required: true },
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

export const signUpSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email(),
  phone: z.string().min(6, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const receivingSchema = z.object({
  receipt_type: z.enum(["po", "transfer", "other"]),
  reference_number: z.string().optional().or(z.literal("")),
  container_number: z.string().optional().or(z.literal("")),
  po_number: z.string().optional().or(z.literal("")),
  warehouse_id: z.string().uuid(),
  client_id: z.string().uuid().optional().or(z.literal("")),
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
  reuse_pallet_barcode: z.string().optional(),
  pallet_barcode: z.string().optional(),
  draft_group_id: z.string().uuid().optional(),
  draft_sequence: z.coerce.number().optional(),
  draft_count: z.coerce.number().optional(),
});

export const pickListSchema = z.object({
  warehouse_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
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
  pallet_id: z.string().min(2, "Scan or enter a pallet barcode"),
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

function templateExampleValue(resourceTable: string, field: FieldDefinition) {
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

function applyArchiveFilter(
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
  const { data, error } = await (supabase.rpc as any)("admin_invite_user", {
    in_email: input.email.toLowerCase().trim(),
    in_full_name: input.full_name.trim(),
    in_password: input.password,
    in_role_code: input.role_code ?? null,
    in_warehouse_id: input.warehouse_id ?? null,
  });
  if (error) throw error;
  await logUserActivity("user_invited", "profiles", data, {
    email: input.email,
    role: input.role_code ?? null,
  });
  return data as string;
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
  const desktop = isDesktopClient();
  const functionResult = await supabase.functions.invoke("trust-device", {
    body: {
      deviceId,
      isDesktop: desktop,
    },
  });
  if (!functionResult.error) return;

  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { error } = await client.rpc("refresh_user_device_trust", {
    in_device_id: deviceId,
    in_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    in_last_known_ip: null,
    in_is_desktop: desktop,
  });
  if (error) throw new Error((error as any).message ?? "Device trust update failed");
}

export async function setUserRoleVisibility(userRoleId: string, hidden: boolean, reason?: string) {
  const { error } = await (supabase.from as any)("user_roles")
    .update({
      is_hidden: hidden,
      hidden_at: hidden ? new Date().toISOString() : null,
      hidden_reason: hidden ? reason ?? null : null,
    })
    .eq("id", userRoleId);
  if (error) throw error;
  await logUserActivity("user_access_change", "user_roles", userRoleId, { hidden, reason: reason ?? null });
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

export function createDefaultWarehouseSetupPayload(): WarehouseSetupPayload {
  return { warehouses: [], zones: [], locationTemplates: [] };
}

export function createBlankWarehouse(): WarehouseSetupWarehouse {
  return { code: "", name: "", city: "", country: "", hasCoolZone: false };
}

export function createBlankZone(warehouseCode = ""): WarehouseSetupZone {
  return {
    warehouseCode,
    code: "",
    name: "",
    temperatureClass: "ambient",
    isStaging: false,
    isDispatch: false,
    isQuarantine: false,
    sortOrder: 0,
  };
}

export function createBlankLocationTemplate(
  warehouseCode = "",
  zoneCode = "",
): WarehouseLocationTemplate {
  return {
    warehouseCode,
    zoneCode,
    aisleCount: 0,
    baysPerAisle: 0,
    levels: 0,
    maxPallets: 0,
    locationType: "",
    temperatureClass: "ambient",
    mixedSkuAllowed: false,
    mixedLotAllowed: false,
    status: "active",
  };
}

export async function loadExistingSetupPayload(): Promise<WarehouseSetupPayload> {
  const [whR, zoneR, locR] = await Promise.all([
    db("warehouses").select("code, name, city, country").order("code"),
    db("zones").select("code, name, temperature_class, is_staging, is_dispatch, is_quarantine, sort_order, warehouses:warehouse_id(code)").order("sort_order"),
    db("locations").select("location_type, temperature_class, max_pallets, mixed_sku_allowed, mixed_lot_allowed, status, aisle, bay, level, warehouses:warehouse_id(code), zones:zone_id(code, temperature_class)"),
  ]);
  if (whR.error) throw whR.error;
  if (zoneR.error) throw zoneR.error;
  if (locR.error) throw locR.error;

  const warehouses: WarehouseSetupWarehouse[] = (whR.data ?? []).map((w: any) => ({
    code: w.code,
    name: w.name ?? "",
    city: w.city ?? "",
    country: w.country ?? "",
    hasCoolZone: false,
  }));

  const zones: WarehouseSetupZone[] = (zoneR.data ?? []).map((z: any) => ({
    warehouseCode: z.warehouses?.code ?? "",
    code: z.code,
    name: z.name ?? "",
    temperatureClass: (z.temperature_class ?? "ambient") as TemperatureClass,
    isStaging: !!z.is_staging,
    isDispatch: !!z.is_dispatch,
    isQuarantine: !!z.is_quarantine,
    sortOrder: Number(z.sort_order ?? 0),
  }));

  // Mark warehouses that already have a cool zone
  for (const z of zones) {
    if (z.temperatureClass === "cool") {
      const wh = warehouses.find((w) => w.code === z.warehouseCode);
      if (wh) wh.hasCoolZone = true;
    }
  }

  // Derive one template per (warehouse, zone, location_type) using aggregate counts.
  const groups = new Map<string, WarehouseLocationTemplate & { _aisles: Set<string>; _bays: Set<string>; _levels: Set<string> }>();
  for (const l of (locR.data ?? []) as any[]) {
    const wCode = l.warehouses?.code ?? "";
    const zCode = l.zones?.code ?? "";
    if (!wCode || !zCode) continue;
    const key = `${wCode}|${zCode}|${l.location_type ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        warehouseCode: wCode,
        zoneCode: zCode,
        aisleCount: 0,
        baysPerAisle: 0,
        levels: 0,
        maxPallets: Number(l.max_pallets ?? 1),
        locationType: l.location_type ?? "rack",
        temperatureClass: (l.temperature_class ?? l.zones?.temperature_class ?? "ambient") as TemperatureClass,
        mixedSkuAllowed: !!l.mixed_sku_allowed,
        mixedLotAllowed: !!l.mixed_lot_allowed,
        status: l.status ?? "active",
        _aisles: new Set<string>(),
        _bays: new Set<string>(),
        _levels: new Set<string>(),
      };
      groups.set(key, g);
    }
    if (l.aisle != null) g._aisles.add(String(l.aisle));
    if (l.bay != null) g._bays.add(String(l.bay));
    if (l.level != null) g._levels.add(String(l.level));
  }
  const locationTemplates: WarehouseLocationTemplate[] = Array.from(groups.values()).map((g) => {
    const { _aisles, _bays, _levels, ...rest } = g;
    return {
      ...rest,
      aisleCount: _aisles.size || 1,
      baysPerAisle: Math.max(1, Math.ceil((_bays.size || 1) / Math.max(1, _aisles.size || 1))),
      levels: _levels.size || 1,
    };
  });

  return { warehouses, zones, locationTemplates };
}

export async function resetWmsData() {
  const { data, error } = await (supabase.rpc as any)("reset_wms_data");
  if (error) throw error;
  return data as { status?: string; deleted_users?: number; kept_users?: number; message?: string };
}

export type CascadeDeleteResult =
  | { ok: true }
  | { ok: false; blocked_by: Array<{ table: string; count: number }> };

async function callCascadeDelete(rpc: string, id: string): Promise<CascadeDeleteResult> {
  const { data, error } = await (supabase.rpc as any)(rpc, { in_id: id });
  if (error) throw error;
  return data as CascadeDeleteResult;
}

export const deleteWarehouseCascade = (id: string) => callCascadeDelete("delete_warehouse_cascade", id);
export const deleteZoneCascade = (id: string) => callCascadeDelete("delete_zone_cascade", id);
export const deleteLocationCascade = (id: string) => callCascadeDelete("delete_location_cascade", id);
export const deleteProductCascade = (id: string) => callCascadeDelete("delete_product_cascade", id);
export const deleteClientCascade = (id: string) => callCascadeDelete("delete_client_cascade", id);

export async function deleteResourceCascade(table: string, id: string): Promise<CascadeDeleteResult> {
  switch (table) {
    case "warehouses": return deleteWarehouseCascade(id);
    case "zones": return deleteZoneCascade(id);
    case "locations": return deleteLocationCascade(id);
    case "products": return deleteProductCascade(id);
    case "clients": return deleteClientCascade(id);
    default: throw new Error(`No cascade delete available for ${table}`);
  }
}

export async function runWarehouseSetup(setupPayload: WarehouseSetupPayload, seedMode: "structure_only" | "starter_ops" = "structure_only") {
  const { data, error } = await (supabase.rpc as any)("run_warehouse_setup", {
    setup_payload: setupPayload,
    seed_mode: seedMode,
  });
  if (error) throw error;
  return data;
}

function buildPalletCode(prefix: string) {
  const time = Date.now().toString().slice(-8);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${time}${rand}`;
}

function buildClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function parseReceiptNotes(notes: string | null | undefined): Record<string, any> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isMissingReceiptDraftColumn(error: any) {
  const message = String(error?.message ?? "");
  return (
    message.includes("receipts") &&
    message.includes("column") &&
    (message.includes("Could not find") || message.includes("does not exist"))
  );
}

function withoutReceiptDraftColumns(row: Record<string, any>) {
  const {
    container_number,
    po_number,
    draft_group_id,
    draft_pallet_barcode,
    draft_sequence,
    draft_count,
    ...rest
  } = row;
  return rest;
}

function normalizeReferenceNumber(payload: Pick<z.infer<typeof receivingSchema>, "reference_number" | "po_number">, fallback: string) {
  return payload.reference_number || payload.po_number || fallback;
}

async function resolveInventoryLot(payload: z.infer<typeof receivingSchema>) {
  const clientId = payload.client_id || null;
  let selectQuery = db("inventory_lots")
    .select("*")
    .eq("product_id", payload.product_id)
    .eq("lot_number", payload.lot_number ?? null)
    .eq("batch_number", payload.batch_number ?? null);
  if (clientId) {
    selectQuery = selectQuery.eq("client_id", clientId);
  } else {
    selectQuery = selectQuery.is("client_id", null);
  }
  const lotMatch = await selectQuery.maybeSingle();

  if (lotMatch.data) {
    return lotMatch.data;
  }

  const { data, error } = await db("inventory_lots")
    .insert({
      product_id: payload.product_id,
      client_id: clientId,
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

async function createLabelRecord(label_type: string, entityId: string, labelCode: string) {
  const { error } = await db("barcode_labels").insert({
    label_type,
    entity_id: entityId,
    label_code: labelCode,
    last_printed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function createReceiptFlow(input: z.infer<typeof receivingSchema>) {
  let payload = receivingSchema.parse(input);
  if (payload.container_number) {
    const containerValidation = validateIso6346ContainerNumber(payload.container_number);
    if (!containerValidation.valid) throw new Error(containerValidation.message);
    payload = { ...payload, container_number: containerValidation.normalized };
  }
  const lot = await resolveInventoryLot(payload);
  const receiptNumber = buildPalletCode("RCT");
  const palletCode = payload.pallet_barcode?.trim() || buildPalletCode("PLT");

  const { data: product, error: productError } = await db("products")
    .select("*")
    .eq("id", payload.product_id)
    .single();

  if (productError) throw productError;

  const { data: packagingProfile } = payload.packaging_profile_id
    ? await db("product_packaging_profiles").select("*").eq("id", payload.packaging_profile_id).single()
    : { data: null };

  const receiptPayload = {
    receipt_number: receiptNumber,
    receipt_type: payload.receipt_type,
    reference_number: normalizeReferenceNumber(payload, receiptNumber),
    container_number: payload.container_number || null,
    po_number: payload.po_number || null,
    draft_group_id: payload.draft_group_id || null,
    draft_pallet_barcode: palletCode,
    draft_sequence: payload.draft_sequence ?? null,
    draft_count: payload.draft_count ?? null,
    warehouse_id: payload.warehouse_id,
    client_id: payload.client_id,
    status: "completed",
  };
  let receipt: any;
  try {
    receipt = await upsertRecord("receipts", receiptPayload);
  } catch (error: any) {
    if (!isMissingReceiptDraftColumn(error)) throw error;
    receipt = await upsertRecord("receipts", withoutReceiptDraftColumns(receiptPayload));
  }

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

  // Pallet reuse: if a barcode is provided, look up an empty/blank pallet to reuse
  let reusedPalletId: string | null = null;
  const reusedBarcode = payload.reuse_pallet_barcode?.trim();
  if (reusedBarcode) {
    const { data: existingPallet } = await db("pallets")
      .select("id, pallet_code, pallet_barcode, product_id, quantity")
      .or(`pallet_code.eq.${reusedBarcode},pallet_barcode.eq.${reusedBarcode}`)
      .single();
    if (existingPallet && (!existingPallet.product_id || existingPallet.quantity === 0)) {
      reusedPalletId = existingPallet.id;
    } else if (existingPallet) {
      throw new Error(`Pallet ${reusedBarcode} still has stock (qty: ${existingPallet.quantity}). Only empty pallets can be reused.`);
    } else {
      throw new Error(`Pallet barcode ${reusedBarcode} not found. Check the barcode and try again.`);
    }
  }

  const palletUpsertPayload: Record<string, unknown> = {
    pallet_code: reusedPalletId ? reusedBarcode : palletCode,
    pallet_barcode: reusedPalletId ? reusedBarcode : palletCode,
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
  };
  if (reusedPalletId) {
    palletUpsertPayload.id = reusedPalletId;
  }

  const pallet = await upsertRecord("pallets", palletUpsertPayload);

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

  const suggestions = await (supabase.rpc as any)("directed_putaway_candidates", { in_pallet_id: pallet.id });
  if (suggestions.error) {
    console.error("[createReceiptFlow] directed_putaway_candidates failed:", suggestions.error);
  }
  const topSuggestion = suggestions.data?.[0] ?? null;

  const putawayTask = await upsertRecord("putaway_tasks", {
    task_number: buildPalletCode("PTA"),
    pallet_id: pallet.id,
    warehouse_id: payload.warehouse_id,
    suggested_location_id: topSuggestion?.location_id ?? null,
    status: "queued",
  });

  const auditResult = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "receipt",
    in_entity_table: "pallets",
    in_entity_id: pallet.id,
    in_pallet_id: pallet.id,
    in_warehouse_id: payload.warehouse_id,
    in_metadata: {
      receipt_id: receipt.id,
      receipt_line_id: receiptLine.id,
      quantity: payload.quantity,
      container_number: payload.container_number || null,
      po_number: payload.po_number || null,
      draft_group_id: payload.draft_group_id || null,
    } as any,
  });
  if (auditResult.error) {
    console.error("[createReceiptFlow] log_audit_event failed:", auditResult.error);
  }

  await createLabelRecord("pallet", pallet.id, palletCode);

  return { receipt, receiptLine, pallet, putawayTask, topSuggestion };
}

export async function searchInventory(filters: {
  search?: string;
  warehouseId?: string;
  status?: InventoryStatus | "all";
  ageBucket?: InventoryAgeBucket | "";
  expiryWindow?: InventoryExpiryWindow | "";
}) {
  let query = db("inventory_search_view").select("*");

  if (filters.warehouseId) {
    query = query.eq("warehouse_id", filters.warehouseId);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  } else {
    query = query.not("status", "in", "(picked,shipped,in_transit,missing)");
  }

  const { data, error } = await query.order("received_at", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as any[];
  const searchTokens = (filters.search ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (searchTokens.length > 0) {
    rows = rows.filter((row) => {
      const haystack = [
        row.sku,
        row.product_name,
        row.product_barcode,
        row.pallet_code,
        row.pallet_barcode,
        row.container_number,
        row.po_number,
        row.lot_number,
        row.batch_number,
        row.expiry_date,
        row.client_name,
        row.owner_name,
        row.warehouse_code,
        row.warehouse_name,
        row.zone_code,
        row.location_code,
        row.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchTokens.every((token) => haystack.includes(token));
    });
  }
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (filters.ageBucket) {
    const minimumDays = filters.ageBucket === "12m" ? 365 : filters.ageBucket === "6m" ? 180 : 90;
    rows = rows.filter((row) => {
      const value = row.received_at ?? row.created_at;
      if (!value) return false;
      return Math.floor((nowMs - new Date(value).getTime()) / dayMs) >= minimumDays;
    });
  }

  if (filters.expiryWindow) {
    const maximumDays = filters.expiryWindow === "30d" ? 30 : 60;
    rows = rows.filter((row) => {
      if (!row.expiry_date) return false;
      const days = Math.ceil((new Date(row.expiry_date).getTime() - nowMs) / dayMs);
      return days >= 0 && days <= maximumDays;
    });
  }

  return rows;
}

export async function getInventoryDetail(balanceId: string) {
  const { data: balance, error: balanceError } = await db("inventory_balances")
    .select("*")
    .eq("id", balanceId)
    .single();
  if (balanceError) throw balanceError;

  const { data: pallet, error: palletError } = await db("pallets").select("*").eq("id", balance.pallet_id).single();
  if (palletError) throw palletError;

  const [{ data: audit }, { data: lot }, { data: product }, { data: client }, { data: warehouse }, { data: location }, { data: receiptLine }] = await Promise.all([
    db("audit_events").select("*").eq("pallet_id", balance.pallet_id).order("created_at", { ascending: false }),
    balance.inventory_lot_id
      ? db("inventory_lots").select("*").eq("id", balance.inventory_lot_id).single()
      : Promise.resolve({ data: null, error: null }),
    db("products").select("*").eq("id", balance.product_id).maybeSingle(),
    balance.client_id
      ? db("clients").select("*").eq("id", balance.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db("warehouses").select("*").eq("id", balance.warehouse_id).maybeSingle(),
    balance.location_id
      ? db("locations").select("*").eq("id", balance.location_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    pallet.receipt_line_id
      ? db("receipt_lines").select("*, receipts(*)").eq("id", pallet.receipt_line_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const packagingId = (receiptLine as any)?.packaging_profile_id ?? pallet.packaging_profile_id ?? null;
  const { data: packaging } = packagingId
    ? await db("product_packaging_profiles").select("*").eq("id", packagingId).maybeSingle()
    : { data: null };

  return {
    balance,
    pallet,
    lot: lot ?? null,
    product: product ?? null,
    client: client ?? null,
    warehouse: warehouse ?? null,
    location: location ?? null,
    receiptLine: receiptLine ?? null,
    receipt: (receiptLine as any)?.receipts ?? null,
    packaging: packaging ?? null,
    audit: audit ?? [],
  };
}

export async function getPutawayTasks(userId?: string) {
  let query = db("putaway_tasks")
    .select("*, pallets(*, products(*)), locations: suggested_location_id(*)")
    .in("status", ["queued", "assigned", "in_progress", "exception"])
    .order("created_at", { ascending: false });

  if (userId) {
    // Show tasks assigned to this user OR unassigned (queue) so the
    // operator/manager can see and pick up open work.
    query = query.or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function confirmPutaway(
  taskId: string,
  scannedPalletBarcode: string,
  scannedLocationCode: string,
  options?: { override?: boolean; overrideReason?: string },
) {
  const { data: task, error: taskError } = await db("putaway_tasks")
    .select("*, pallets(*), locations: suggested_location_id(*), products: pallets(product_id)")
    .eq("id", taskId)
    .single();

  if (taskError) throw taskError;
  if (!["queued", "assigned", "in_progress", "exception"].includes(task.status)) {
    throw new Error("Putaway task is already closed or no longer available.");
  }

  const pallet = task.pallets as any;
  if (!pallet || pallet.pallet_barcode !== scannedPalletBarcode) {
    throw new Error("Scanned pallet barcode does not match the task pallet.");
  }
  if (!["receiving", "hold", "quarantine"].includes(pallet.status)) {
    throw new Error(`Pallet is no longer available for putaway (status: ${pallet.status}).`);
  }

  const { data: location, error: locationError } = await db("locations")
    .select("*")
    .eq("code", scannedLocationCode)
    .single();
  if (locationError) throw locationError;

  const { data: product, error: productError } = await db("products")
    .select("*")
    .eq("id", pallet.product_id)
    .single();
  if (productError) throw productError;

  const { count: occupiedCount } = await db("inventory_balances")
    .select("*", { count: "exact", head: true })
    .eq("location_id", location.id)
    .neq("status", "picked");

  const ruleCheck = validatePutawayAssignment({
    productTemperature: product.temperature_requirement,
    locationTemperature: location.temperature_class,
    locationStatus: location.status,
    locationMaxPallets: location.max_pallets,
    occupiedPallets: occupiedCount ?? 0,
    mixedSkuAllowed: location.mixed_sku_allowed,
    hasOtherSku: false,
  });

  const overrideUsed = !ruleCheck.valid && options?.override === true;
  if (!ruleCheck.valid && !overrideUsed) {
    // Prefix lets the UI detect rule violations and offer an override path
    throw new Error(`RULE_VIOLATION: ${ruleCheck.reason}`);
  }

  const { data: claimedTask, error: claimError } = await db("putaway_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .in("status", ["queued", "assigned", "in_progress", "exception"])
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimedTask) throw new Error("Putaway task was completed by another user. Refresh the queue.");

  await Promise.all([
    db("pallets")
      .update({
        current_location_id: location.id,
        current_warehouse_id: location.warehouse_id,
        status: "available",
        is_stored: true,
        available_quantity: pallet.quantity,
      })
      .eq("id", pallet.id),
    db("inventory_balances")
      .update({
        warehouse_id: location.warehouse_id,
        zone_id: location.zone_id,
        location_id: location.id,
        status: "available",
        available_quantity: pallet.quantity,
      })
      .eq("pallet_id", pallet.id),
  ]);

  const putawayAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "putaway",
    in_entity_table: "putaway_tasks",
    in_entity_id: taskId,
    in_pallet_id: pallet.id,
    in_warehouse_id: location.warehouse_id,
    in_to_location_id: location.id,
    in_metadata: {
      location_code: location.code,
      pallet_barcode: pallet.pallet_barcode,
      override: overrideUsed,
      override_reason: overrideUsed ? (options?.overrideReason ?? ruleCheck.reason ?? null) : null,
      suggested_location_id: task.suggested_location_id ?? null,
      suggestion_overridden:
        task.suggested_location_id != null && task.suggested_location_id !== location.id,
    } as any,
  });
  if (putawayAudit.error) console.error("[confirmPutaway] log_audit_event failed:", putawayAudit.error);
}

async function selectPickCandidates(productId: string, warehouseId: string, quantity: number) {
  const { data: product } = await db("products").select("*").eq("id", productId).single();

  const { data, error } = await db("inventory_balances")
    .select("pallet_id, location_id, available_quantity, expiry_date, received_at")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .eq("status", "available")
    .gt("available_quantity", 0);
  if (error) throw error;

  const candidates = [...(data ?? [])].sort((left, right) => {
    if (product?.rotation_method === "fefo") {
      return (left.expiry_date ?? "9999-12-31").localeCompare(right.expiry_date ?? "9999-12-31");
    }
    return String(left.received_at ?? "").localeCompare(String(right.received_at ?? ""));
  });

  const chosen: any[] = [];
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
  // Ensure the order number is unique even if the operator re-uses one they
  // already typed (the orders table has a unique constraint on order_number).
  // We try the supplied number first, then fall back to suffixed retries.
  const baseOrderNumber = payload.order_number;
  let order: any;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidateNumber = attempt === 0
      ? baseOrderNumber
      : `${baseOrderNumber}-${Date.now().toString().slice(-6)}${attempt > 1 ? `-${attempt}` : ""}`;
    const { data: existing } = await db("orders")
      .select("id")
      .eq("order_number", candidateNumber)
      .maybeSingle();
    if (existing) {
      attempt += 1;
      if (attempt > 5) throw new Error("Could not allocate a unique order number — try a different one.");
      continue;
    }
    order = await upsertRecord("orders", {
      order_number: candidateNumber,
      client_id: payload.client_id,
      warehouse_id: payload.warehouse_id,
      requested_ship_date: payload.requested_ship_date || null,
      status: "queued",
      notes: payload.notes || null,
    });
    break;
  }

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
        location_id: candidate.location_id ?? null,
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
  const { data, error } = await db("pick_lists")
    .select("*, pick_tasks(*, pallets(pallet_barcode, pallet_code, quantity, available_quantity, products(*)), locations:location_id(code))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPutawayTaskHistory(userId?: string) {
  let query = db("putaway_tasks")
    .select("*, pallets(*, products(*)), locations: suggested_location_id(*)")
    .in("status", ["completed", "cancelled"])
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (userId) {
    query = query.or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getPickExecution(pickListId: string) {
  const [pickList, pickTasks] = await Promise.all([
    db("pick_lists").select("*").eq("id", pickListId).single(),
    db("pick_tasks")
      .select("*, pallets(pallet_barcode, pallet_code, quantity, available_quantity, products(sku, name)), locations:location_id(code)")
      .eq("pick_list_id", pickListId)
      .order("created_at", { ascending: true }),
  ]);

  if (pickList.error) throw pickList.error;
  if (pickTasks.error) throw pickTasks.error;

  const enrichedTasks = await Promise.all(
    (pickTasks.data ?? []).map(async (task: any) => {
      if (!task.pallet_id || task.locations?.code) return task;
      const { data: balance } = await db("inventory_balances")
        .select("available_quantity, quantity, locations:location_id(code)")
        .eq("pallet_id", task.pallet_id)
        .maybeSingle();
      return { ...task, pick_balance: balance ?? null };
    }),
  );

  return {
    pickList: pickList.data,
    pickTasks: enrichedTasks,
  };
}

export async function confirmPickTask(taskId: string, scannedLocation: string, scannedPallet: string, confirmedQuantity: number, shortReason?: string) {
  const { data: task, error: taskError } = await db("pick_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (taskError) throw taskError;

  if (!task.pallet_id) {
    throw new Error("Task is not linked to a pallet.");
  }
  if (["completed", "cancelled"].includes(task.status)) {
    throw new Error("Pick task is already closed. Refresh the pick list.");
  }
  if (!Number.isFinite(Number(confirmedQuantity)) || Number(confirmedQuantity) <= 0) {
    throw new Error("Confirmed pick quantity must be greater than zero.");
  }

  const [{ data: pallet, error: palletError }, { data: balance, error: balanceError }] = await Promise.all([
    db("pallets").select("*").eq("id", task.pallet_id).single(),
    db("inventory_balances").select("*").eq("pallet_id", task.pallet_id).single(),
  ]);

  if (palletError) throw palletError;
  if (balanceError) throw balanceError;
  if (pallet.pallet_barcode !== scannedPallet) {
    throw new Error("Scanned pallet does not match the task.");
  }

  const location = balance.location_id
    ? await db("locations").select("*").eq("id", balance.location_id).single()
    : { data: null, error: null };
  if (location.error) throw location.error;
  if (location.data && location.data.code !== scannedLocation) {
    throw new Error("Scanned location does not match the suggested pick location.");
  }
  if (Number(confirmedQuantity) > Number(balance.available_quantity ?? 0)) {
    throw new Error(`Cannot pick ${confirmedQuantity}; only ${balance.available_quantity ?? 0} available on this pallet.`);
  }

  const nextAvailable = Math.max(balance.available_quantity - confirmedQuantity, 0);
  const nextStatus: InventoryStatus = nextAvailable === 0 ? "picked" : "available";
  const fullyDepleted = nextAvailable === 0;
  const nextPalletQuantity = Math.max(Number(pallet.quantity ?? 0) - confirmedQuantity, 0);
  const nextBalanceQuantity = Math.max(Number(balance.quantity ?? 0) - confirmedQuantity, 0);

  await Promise.all([
    db("pick_tasks")
      .update({
        confirmed_quantity: confirmedQuantity,
        short_reason: shortReason ?? null,
        status: shortReason ? "exception" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId),
    db("pallets")
      .update(
        fullyDepleted
          ? {
              available_quantity: 0,
              quantity: 0,
              reserved_quantity: 0,
              status: nextStatus,
              current_location_id: null,
              is_stored: false,
            }
          : {
              available_quantity: nextAvailable,
              quantity: nextPalletQuantity,
              status: nextStatus,
            },
      )
      .eq("id", pallet.id),
    db("inventory_balances")
      .update(
        fullyDepleted
          ? {
              available_quantity: 0,
              quantity: 0,
              reserved_quantity: 0,
              status: nextStatus,
              location_id: null,
              zone_id: null,
            }
          : {
              available_quantity: nextAvailable,
              quantity: nextBalanceQuantity,
              status: nextStatus,
            },
      )
      .eq("id", balance.id),
  ]);

  const pickAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pick",
    in_entity_table: "pick_tasks",
    in_entity_id: taskId,
    in_pallet_id: pallet.id,
    in_warehouse_id: balance.warehouse_id,
    in_from_location_id: balance.location_id,
    in_metadata: {
      confirmed_quantity: confirmedQuantity,
      short_reason: shortReason ?? null,
      previous_quantity: Number(balance.quantity ?? 0),
      remaining_quantity: nextBalanceQuantity,
      location_cleared: fullyDepleted,
    } as any,
  });
  if (pickAudit.error) console.error("[submitPickTaskLine] log_audit_event failed:", pickAudit.error);

  // Roll up the parent pick list if every sibling task is finished.
  if (task.pick_list_id) {
    const { data: siblings } = await db("pick_tasks")
      .select("id, status")
      .eq("pick_list_id", task.pick_list_id);
    const allDone = (siblings ?? []).every((row: any) =>
      ["completed", "cancelled", "exception"].includes(row.status),
    );
    if (allDone && (siblings ?? []).length > 0) {
      const { data: parent } = await db("pick_lists")
        .select("id, status, warehouse_id, order_id")
        .eq("id", task.pick_list_id)
        .single();
      if (parent && !["completed", "cancelled"].includes(parent.status)) {
        await db("pick_lists")
          .update({ status: "completed" })
          .eq("id", parent.id);
        if (parent.order_id) {
          await db("orders").update({ status: "completed" }).eq("id", parent.order_id);
        }
        const completeAudit = await (supabase.rpc as any)("log_audit_event", {
          in_event_type: "pick_list_completed",
          in_entity_table: "pick_lists",
          in_entity_id: parent.id,
          in_warehouse_id: parent.warehouse_id,
          in_metadata: {} as any,
        });
        if (completeAudit.error) console.error("[confirmPickTask] pick_list rollup audit failed:", completeAudit.error);
      }
    }
  }
}

export async function cancelPickList(pickListId: string, reason?: string) {
  const { data: pickList, error: pickListError } = await db("pick_lists")
    .select("*, pick_tasks(id, status)")
    .eq("id", pickListId)
    .single();
  if (pickListError) throw pickListError;
  if (["completed", "cancelled"].includes(pickList.status)) {
    throw new Error("Pick list is already closed.");
  }

  const trimmedReason = reason?.trim() || null;
  const noteSuffix = trimmedReason ? `Cancelled: ${trimmedReason}` : "Cancelled";
  const nextNotes = pickList.notes ? `${pickList.notes} · ${noteSuffix}` : noteSuffix;

  const openTaskIds = (pickList.pick_tasks ?? [])
    .filter((t: any) => !["completed", "cancelled"].includes(t.status))
    .map((t: any) => t.id);

  await db("pick_lists")
    .update({ status: "cancelled", notes: nextNotes })
    .eq("id", pickListId);

  if (openTaskIds.length > 0) {
    await db("pick_tasks")
      .update({ status: "cancelled", short_reason: trimmedReason })
      .in("id", openTaskIds);
  }

  if (pickList.order_id) {
    await db("orders").update({ status: "cancelled" }).eq("id", pickList.order_id);
  }

  const cancelAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pick_list_cancelled",
    in_entity_table: "pick_lists",
    in_entity_id: pickListId,
    in_warehouse_id: pickList.warehouse_id,
    in_metadata: { reason: trimmedReason } as any,
  });
  if (cancelAudit.error) console.error("[cancelPickList] log_audit_event failed:", cancelAudit.error);
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

  const { data: pallet, error: palletError } = await db("pallets").select("*").eq("id", payload.pallet_id).single();
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

export async function dispatchTransfer(transferId: string, driverSignoffCode: string) {
  const { data: userData } = await supabase.auth.getUser();
  const actorId = userData.user?.id;
  if (!actorId) throw new Error("Sign in is required before dispatch.");

  const normalizedCode = driverSignoffCode.trim();
  if (!normalizedCode) throw new Error("Driver sign-off code is required before departure.");

  const { data: profile, error: profileError } = await db("profiles")
    .select("id, full_name, user_code, badge_code")
    .eq("id", actorId)
    .single();
  if (profileError) throw profileError;

  if (profile.user_code !== normalizedCode && profile.badge_code !== normalizedCode) {
    throw new Error("Driver sign-off code did not match the signed-in user.");
  }

  const { data: roleRows, error: roleError } = await db("user_roles")
    .select("roles!inner(code)")
    .eq("user_id", actorId);
  if (roleError) throw roleError;
  const allowedToSign = (roleRows ?? []).some((row: { roles?: { code?: string } }) =>
    row.roles?.code ? ["dispatch_driver", "warehouse_manager", "admin"].includes(row.roles.code) : false,
  );
  if (!allowedToSign) {
    throw new Error("Only dispatch drivers, managers, or admins can sign off transfer departure.");
  }

  const { data: transfer, error: transferError } = await db("transfers").select("*").eq("id", transferId).single();
  if (transferError) throw transferError;

  const { data: lines, error: linesError } = await db("transfer_lines").select("*").eq("transfer_id", transferId);
  if (linesError) throw linesError;

  for (const line of lines ?? []) {
    if (!line.pallet_id) continue;
    await Promise.all([
      db("pallets").update({ status: "in_transit", current_location_id: null }).eq("id", line.pallet_id),
      db("inventory_balances").update({ status: "in_transit", location_id: null, zone_id: null }).eq("pallet_id", line.pallet_id),
    ]);
  }

  const dispatchedAt = new Date().toISOString();
  await db("transfers")
    .update({
      status: "in_progress",
      dispatched_at: dispatchedAt,
      dispatch_signed_off_by: actorId,
      dispatch_signed_off_at: dispatchedAt,
      dispatch_signoff_code: normalizedCode,
    })
    .eq("id", transferId);

  const dispatchAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "transfer_driver_signoff",
    in_entity_table: "transfers",
    in_entity_id: transferId,
    in_warehouse_id: transfer.source_warehouse_id,
    in_metadata: {
      transfer_number: transfer.transfer_number,
      transfer_type: transfer.transfer_type,
      signed_off_by: profile.full_name ?? actorId,
    },
  });
  if (dispatchAudit.error) console.error("[dispatchTransfer] log_audit_event failed:", dispatchAudit.error);
}

export async function receiveTransfer(transferId: string) {
  const { data: transfer, error: transferError } = await db("transfers").select("*").eq("id", transferId).single();
  if (transferError) throw transferError;
  const { data: lines, error: linesError } = await db("transfer_lines").select("*").eq("transfer_id", transferId);
  if (linesError) throw linesError;

  for (const line of lines ?? []) {
    if (!line.pallet_id) continue;
    await Promise.all([
      db("pallets")
        .update({ current_warehouse_id: transfer.destination_warehouse_id, status: "receiving", current_location_id: null, is_stored: false })
        .eq("id", line.pallet_id),
      db("inventory_balances")
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

  await db("transfers").update({ status: "completed", received_at: new Date().toISOString() }).eq("id", transferId);
}

export async function cancelTransfer(transferId: string, reason: string) {
  const { data: transfer, error: transferError } = await db("transfers").select("*").eq("id", transferId).single();
  if (transferError) throw transferError;
  if (transfer.status === "completed") throw new Error("Cannot cancel a completed transfer.");

  const { data: lines, error: linesError } = await db("transfer_lines").select("*").eq("transfer_id", transferId);
  if (linesError) throw linesError;

  for (const line of lines ?? []) {
    if (!line.pallet_id) continue;
    // Return the pallet to receiving so it gets a fresh putaway task
    await Promise.all([
      db("pallets")
        .update({ status: "receiving", current_location_id: null, is_stored: false, available_quantity: 0 })
        .eq("id", line.pallet_id),
      db("inventory_balances")
        .update({ status: "receiving", location_id: null, zone_id: null, available_quantity: 0 })
        .eq("pallet_id", line.pallet_id),
    ]);
    await createReturnedPalletDraft({
      palletId: line.pallet_id,
      warehouseId: transfer.source_warehouse_id,
      sourceLabel: `Cancelled transfer ${transfer.transfer_number}`,
      sourceType: "transfer_cancelled",
      sourceId: transferId,
      reason,
    });
  }

  await db("transfers")
    .update({ status: "cancelled", notes: reason })
    .eq("id", transferId);

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "transfer_cancelled",
    in_entity_table: "transfers",
    in_entity_id: transferId,
    in_warehouse_id: transfer.source_warehouse_id,
    in_metadata: { reason, transfer_number: transfer.transfer_number },
  });
}

export async function flagCountLineException(lineId: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to flag a count exception.");
  await db("cycle_count_lines")
    .update({ status: "exception", notes: reason } as any)
    .eq("id", lineId);

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "count_line_exception",
    in_entity_table: "cycle_count_lines",
    in_entity_id: lineId,
    in_metadata: { reason },
  });
}

export async function listTransfers() {
  const { data, error } = await db("transfers")
    .select("*, transfer_lines(*, pallets(pallet_barcode, products(*)))")
    .order("created_at", { ascending: false });
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

  let balanceQuery = db("inventory_balances").select("*").eq("warehouse_id", payload.warehouse_id);
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
  const { data, error } = await db("cycle_counts")
    .select("*, cycle_count_lines(*, products(*), locations(code, aisle, bay, level))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitCycleCountLine(lineId: string, countedQuantity: number) {
  const { data: line, error: lineError } = await db("cycle_count_lines").select("*").eq("id", lineId).single();
  if (lineError) throw lineError;

  const varianceQuantity = countedQuantity - line.expected_quantity;
  const variancePercent = line.expected_quantity === 0 ? 0 : Math.abs((varianceQuantity / line.expected_quantity) * 100);

  await db("cycle_count_lines")
    .update({
      counted_quantity: countedQuantity,
      variance_quantity: varianceQuantity,
      variance_percent: variancePercent,
      status: varianceQuantity === 0 ? "completed" : "exception",
    })
    .eq("id", lineId);

  if (line.pallet_id) {
    await Promise.all([
      db("pallets").update({ quantity: countedQuantity, available_quantity: countedQuantity }).eq("id", line.pallet_id),
      db("inventory_balances").update({ quantity: countedQuantity, available_quantity: countedQuantity }).eq("pallet_id", line.pallet_id),
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
  const { data, error } = await db("inventory_search_view")
    .select("*")
    .in("status", ["hold", "quarantine", "damaged", "missing"])
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function changePalletStatus(input: z.infer<typeof statusChangeSchema>) {
  const payload = statusChangeSchema.parse(input);
  const palletId = await resolvePalletId(payload.pallet_id);
  const { data: balance, error: balanceError } = await db("inventory_balances").select("*").eq("pallet_id", palletId).single();
  if (balanceError) throw balanceError;

  await Promise.all([
    db("pallets").update({ status: payload.new_status }).eq("id", palletId),
    db("inventory_balances").update({ status: payload.new_status }).eq("id", balance.id),
    upsertRecord("stock_adjustments", {
      adjustment_number: buildPalletCode("STS"),
      pallet_id: palletId,
      inventory_balance_id: balance.id,
      adjustment_type: "status_change",
      quantity_delta: 0,
      old_status: balance.status,
      new_status: payload.new_status,
      reason: payload.reason,
    }),
  ]);

  const statusAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "status_change",
    in_entity_table: "pallets",
    in_entity_id: palletId,
    in_pallet_id: palletId,
    in_warehouse_id: balance.warehouse_id,
    in_metadata: {
      old_status: balance.status,
      new_status: payload.new_status,
      reason: payload.reason,
    } as any,
  });
  if (statusAudit.error) console.error("[changePalletStatus] log_audit_event failed:", statusAudit.error);
  await writeSystemLog({
    log_type: "system_change",
    severity: ["missing", "damaged", "quarantine"].includes(payload.new_status) ? "warning" : "info",
    title: "Pallet status changed",
    message: `Pallet status changed from ${balance.status} to ${payload.new_status}.`,
    source: "inventory",
    table_name: "pallets",
    details: { palletId, old_status: balance.status, new_status: payload.new_status, reason: payload.reason },
  }).catch((error) => console.error("[changePalletStatus] writeSystemLog failed:", error));
}

async function resolvePalletId(palletInput: string) {
  const normalized = palletInput.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized;
  }

  const { data, error } = await db("pallets")
    .select("id")
    .or(`pallet_code.eq.${normalized},pallet_barcode.eq.${normalized}`)
    .single();
  if (error) throw new Error("Pallet barcode was not found.");
  return data.id as string;
}

export async function getDashboardMetrics(warehouseId?: string | null, enabledModules?: Partial<Record<string, boolean>>) {
  const dashboardMetricKeys = getDashboardMetricKeysForModules(enabledModules);

  const [balances, locations, receipts, putawayTasks, pickLists, moveTasks, transfers, cycleCounts, stagingLoads, replenishments, audits] = await Promise.all([
    db("inventory_balances").select("id, warehouse_id, status, zone_id, pallet_id, created_at, received_at, expiry_date"),
    db("locations").select("warehouse_id, max_pallets"),
    db("receipts").select("id, receipt_number, reference_number, warehouse_id, status, created_at").in("status", ["draft", "queued", "assigned", "in_progress"]),
    db("putaway_tasks").select("id, task_number, warehouse_id, status, created_at").in("status", ["queued", "assigned", "in_progress", "exception"]),
    db("pick_lists").select("id, pick_list_number, warehouse_id, status, created_at").in("status", ["draft", "queued", "assigned", "in_progress", "exception"]),
    db("move_tasks").select("id, task_number, warehouse_id, status, created_at").in("status", ["queued", "assigned", "in_progress", "exception"]),
    db("transfers").select("id, transfer_number, source_warehouse_id, destination_warehouse_id, status, created_at").in("status", ["draft", "queued", "assigned", "in_progress", "exception"]),
    db("cycle_counts").select("id, count_number, warehouse_id, status, created_at").in("status", ["queued", "assigned", "in_progress", "exception"]),
    db("staging_loads").select("id, route_code, status, created_at, pick_lists(warehouse_id)").in("status", ["ready", "called", "loading", "blocked"]),
    db("replenishment_tasks").select("id, task_number, warehouse_id, status, created_at").in("status", ["queued", "assigned", "in_progress", "exception"]),
    db("audit_events").select("id, warehouse_id").order("created_at", { ascending: false }).limit(50),
  ]);

  if (balances.error) throw balances.error;
  if (locations.error) throw locations.error;
  if (receipts.error) throw receipts.error;
  if (putawayTasks.error) throw putawayTasks.error;
  if (pickLists.error) throw pickLists.error;
  if (moveTasks.error) throw moveTasks.error;
  if (transfers.error) throw transfers.error;
  if (cycleCounts.error) throw cycleCounts.error;
  if (stagingLoads.error) throw stagingLoads.error;
  if (replenishments.error) throw replenishments.error;
  if (audits.error) throw audits.error;

  const allBalanceRows = balances.data ?? [];
  const balanceRows = warehouseId ? allBalanceRows.filter((row: any) => row.warehouse_id === warehouseId) : allBalanceRows;
  const retiredStatuses = new Set(["picked", "shipped", "in_transit", "missing"]);
  const liveAllBalanceRows = allBalanceRows.filter((row: any) => !retiredStatuses.has(row.status));
  const liveBalanceRows = balanceRows.filter((row: any) => !retiredStatuses.has(row.status));
  const coolRows = liveBalanceRows.filter((row: any) => row.zone_id);
  const locationRows = locations.data ?? [];
  const totalPalletCapacity = locationRows.reduce((sum: number, row: any) => sum + Number(row.max_pallets ?? 0), 0);
  const warehouseRows = warehouseId ? liveBalanceRows : [];
  const warehousePalletCapacity = warehouseId
    ? locationRows
        .filter((row: any) => row.warehouse_id === warehouseId)
        .reduce((sum: number, row: any) => sum + Number(row.max_pallets ?? 0), 0)
    : 0;
  const scopedReceipts = warehouseId ? (receipts.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (receipts.data ?? []);
  const scopedPutaway = warehouseId ? (putawayTasks.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (putawayTasks.data ?? []);
  const scopedPickLists = warehouseId ? (pickLists.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (pickLists.data ?? []);
  const scopedMoveTasks = warehouseId ? (moveTasks.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (moveTasks.data ?? []);
  const scopedTransfers = warehouseId
    ? (transfers.data ?? []).filter((row: any) => row.source_warehouse_id === warehouseId || row.destination_warehouse_id === warehouseId)
    : (transfers.data ?? []);
  const scopedCycleCounts = warehouseId ? (cycleCounts.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (cycleCounts.data ?? []);
  const scopedStagingLoads = warehouseId
    ? (stagingLoads.data ?? []).filter((row: any) => row.pick_lists?.warehouse_id === warehouseId)
    : (stagingLoads.data ?? []);
  const scopedReplenishments = warehouseId ? (replenishments.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (replenishments.data ?? []);
  const scopedAudits = warehouseId ? (audits.data ?? []).filter((row: any) => row.warehouse_id === warehouseId) : (audits.data ?? []);
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - nowMs) / dayMs) : null;
  const ageDays = (value: string | null | undefined) => value ? Math.floor((nowMs - new Date(value).getTime()) / dayMs) : 0;
  const expiryWarning60 = liveBalanceRows.filter((row: any) => {
    const days = daysUntil(row.expiry_date);
    return days !== null && days >= 0 && days <= 60;
  }).length;
  const expiryWarning30 = liveBalanceRows.filter((row: any) => {
    const days = daysUntil(row.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const stockAge3Months = liveBalanceRows.filter((row: any) => ageDays(row.received_at ?? row.created_at) >= 90).length;
  const stockAge6Months = liveBalanceRows.filter((row: any) => ageDays(row.received_at ?? row.created_at) >= 180).length;
  const stockAge12Months = liveBalanceRows.filter((row: any) => ageDays(row.received_at ?? row.created_at) >= 365).length;

  const receiptRows: DashboardTaskRow[] = scopedReceipts
    .filter((row: any) => row.status === "draft")
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.receipt_number,
      sublabel: row.reference_number ?? row.receipt_number,
      route: "/receiving",
      createdAt: row.created_at,
    }));

  const putawayRows: DashboardTaskRow[] = scopedPutaway
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.task_number,
      sublabel: row.status,
      route: "/putaway-tasks",
      createdAt: row.created_at,
    }));

  const pickRows: DashboardTaskRow[] = scopedPickLists
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.pick_list_number,
      sublabel: row.status,
      route: "/pick-lists",
      createdAt: row.created_at,
    }));

  const moveRows: DashboardTaskRow[] = scopedMoveTasks
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.task_number,
      sublabel: row.status,
      route: "/location-moves",
      createdAt: row.created_at,
    }));

  const transferRows: DashboardTaskRow[] = scopedTransfers
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.transfer_number,
      sublabel: row.status,
      route: "/transfers",
      createdAt: row.created_at,
    }));

  const cycleCountRows: DashboardTaskRow[] = scopedCycleCounts
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.count_number,
      sublabel: row.status,
      route: "/cycle-counts",
      createdAt: row.created_at,
    }));

  const dockLoadRows: DashboardTaskRow[] = scopedStagingLoads
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.route_code,
      sublabel: row.status,
      route: "/pick-lists",
      createdAt: row.created_at,
    }));

  const replenishmentRows: DashboardTaskRow[] = scopedReplenishments
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: row.task_number,
      sublabel: row.status,
      route: "/inventory-search",
      createdAt: row.created_at,
    }));

  const blockedRows: DashboardTaskRow[] = balanceRows
    .filter((row: any) => row.status === "hold" || row.status === "quarantine")
    .sort((a: any, b: any) => a.created_at < b.created_at ? -1 : 1)
    .map((row: any) => ({
      id: row.id,
      label: String(row.pallet_id).slice(0, 8).toUpperCase(),
      sublabel: row.status,
      route: "/status",
      createdAt: row.created_at,
    }));

  return {
    totalPallets: liveAllBalanceRows.length,
    totalPalletCapacity,
    warehousePallets: warehouseRows.length,
    warehousePalletCapacity,
    availablePallets: balanceRows.filter((row: any) => row.status === "available").length,
    coolZoneOccupancy: coolRows.length,
    openReceipts: scopedReceipts.filter((row: any) => row.status === "draft").length,
    openPutawayTasks: scopedPutaway.length,
    openPickLists: scopedPickLists.length,
    openMoveTasks: scopedMoveTasks.length,
    openTransfers: scopedTransfers.length,
    openCycleCounts: scopedCycleCounts.length,
    openDockLoads: scopedStagingLoads.length,
    openReplenishmentTasks: scopedReplenishments.length,
    recentAuditEvents: scopedAudits.length,
    holdStock: balanceRows.filter((row: any) => row.status === "hold").length,
    quarantineStock: balanceRows.filter((row: any) => row.status === "quarantine").length,
    expiryWarning60,
    expiryWarning30,
    stockAge3Months,
    stockAge6Months,
    stockAge12Months,
    receiptRows,
    putawayTaskRows: putawayRows,
    pickListRows: pickRows,
    moveTaskRows: moveRows,
    transferRows,
    cycleCountRows,
    dockLoadRows,
    replenishmentRows,
    blockedBalanceRows: blockedRows,
    dashboardMetricKeys,
  } satisfies DashboardMetrics;
}

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
// Client Variables
// ─────────────────────────────────────────────────────────────────────────────

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

export type DraftReceipt = {
  id: string;
  receipt_number: string;
  reference_number: string | null;
  container_number: string | null;
  po_number: string | null;
  draft_group_id: string | null;
  draft_pallet_barcode: string | null;
  draft_sequence: number | null;
  draft_count: number | null;
  warehouse_id: string;
  client_id: string | null;
  status: string;
  product_id: string | null;
  quantity: number | null;
  expiry_date: string | null;
  lot_number: string | null;
  batch_number: string | null;
  created_at: string;
  notes: string | null;
  source_label: string | null;
};

export type ShipmentDraftLineInput = {
  product_id: string;
  client_id?: string;
  packaging_profile_id?: string;
  total_quantity: number;
  quantity_per_pallet: number;
  pallet_count: number;
  expiry_date?: string;
  lot_number?: string;
  batch_number?: string;
  manufacture_date?: string;
  loading_date?: string;
  remainder_quantity?: number;
  remainder_action?: "waive" | "manual" | "special";
  create_special_pallet?: boolean;
};

export type ShipmentDraftInput = {
  receipt_type: "po" | "transfer" | "other";
  warehouse_id: string;
  client_id?: string;
  container_number: string;
  po_number?: string;
  reference_number?: string;
  lines: ShipmentDraftLineInput[];
};

export async function saveDraftReceipt(values: z.infer<typeof receivingSchema>): Promise<string> {
  if (values.container_number) {
    const containerValidation = validateIso6346ContainerNumber(values.container_number);
    if (!containerValidation.valid) throw new Error(containerValidation.message);
    values = { ...values, container_number: containerValidation.normalized };
  }
  const receiptNumber = buildPalletCode("RCT");
  const draftBarcode = values.pallet_barcode?.trim() || buildPalletCode("PLT");
  const row = {
    receipt_number: receiptNumber,
    receipt_type: values.receipt_type,
    reference_number: normalizeReferenceNumber(values, receiptNumber),
    container_number: values.container_number || null,
    po_number: values.po_number || null,
    draft_group_id: values.draft_group_id || null,
    draft_pallet_barcode: draftBarcode,
    draft_sequence: values.draft_sequence ?? null,
    draft_count: values.draft_count ?? null,
    warehouse_id: values.warehouse_id,
    client_id: values.client_id || null,
    status: "draft",
    notes: JSON.stringify({
      _draft: true,
      draft_pallet_barcode: draftBarcode,
      container_number: values.container_number,
      po_number: values.po_number,
      draft_group_id: values.draft_group_id,
      draft_sequence: values.draft_sequence,
      draft_count: values.draft_count,
      product_id: values.product_id,
      quantity: values.quantity,
      lot_number: values.lot_number,
      batch_number: values.batch_number,
      expiry_date: values.expiry_date,
      manufacture_date: values.manufacture_date,
      loading_date: values.loading_date,
      packaging_profile_id: values.packaging_profile_id,
      override_length: values.override_length,
      override_width: values.override_width,
      override_height: values.override_height,
      override_weight: values.override_weight,
      reuse_pallet_barcode: values.reuse_pallet_barcode,
    }),
  };
  let { data, error } = await db("receipts").insert(row).select("id").single();
  if (error && isMissingReceiptDraftColumn(error)) {
    ({ data, error } = await db("receipts").insert(withoutReceiptDraftColumns(row)).select("id").single());
  }
  if (error) throw error;
  return data.id;
}

export async function saveShipmentDrafts(input: ShipmentDraftInput): Promise<{ groupId: string; draftIds: string[]; count: number }> {
  if (!input.warehouse_id) throw new Error("Select a warehouse before saving shipment drafts.");
  const containerValidation = validateIso6346ContainerNumber(input.container_number);
  if (!containerValidation.valid) throw new Error(containerValidation.message);
  input = { ...input, container_number: containerValidation.normalized };
  if (!input.lines.length) throw new Error("Add at least one SKU line.");

  const groupId = buildClientId("shipment");
  const rows: any[] = [];

  for (const line of input.lines) {
    if (!line.product_id) throw new Error("Each shipment line needs a product.");
    if (line.total_quantity <= 0 || line.quantity_per_pallet <= 0 || line.pallet_count <= 0) {
      throw new Error("Each shipment line needs positive quantity, per-pallet quantity, and pallet count.");
    }
    const fullQty = Number(line.quantity_per_pallet);
    const remainderQty = Number(line.remainder_quantity ?? 0);
    if (remainderQty > 0 && !line.remainder_action) {
      throw new Error("Choose how to handle leftover quantity before creating drafts.");
    }
    const quantities = Array.from({ length: Number(line.pallet_count) }, () => fullQty);
    if (remainderQty > 0 && line.remainder_action === "special" && line.create_special_pallet) {
      quantities.push(remainderQty);
    }

    quantities.forEach((quantity, index) => {
      const receiptNumber = buildPalletCode("RCT");
      const draftBarcode = buildPalletCode("PLT");
      rows.push({
        receipt_number: receiptNumber,
        receipt_type: input.receipt_type,
        reference_number: input.reference_number || input.po_number || receiptNumber,
        container_number: input.container_number.trim(),
        po_number: input.po_number?.trim() || null,
        draft_group_id: groupId,
        draft_pallet_barcode: draftBarcode,
        draft_sequence: index + 1,
        draft_count: quantities.length,
        warehouse_id: input.warehouse_id,
        client_id: line.client_id || input.client_id || null,
        status: "draft",
        notes: JSON.stringify({
          _draft: true,
          _shipment: true,
          draft_pallet_barcode: draftBarcode,
          draft_group_id: groupId,
          draft_sequence: index + 1,
          draft_count: quantities.length,
          container_number: input.container_number.trim(),
          po_number: input.po_number?.trim() || "",
          product_id: line.product_id,
          quantity,
          total_quantity: line.total_quantity,
          quantity_per_pallet: line.quantity_per_pallet,
          remainder_quantity: remainderQty,
          remainder_action: line.remainder_action ?? null,
          special_pallet: remainderQty > 0 && line.remainder_action === "special" && index === quantities.length - 1,
          lot_number: line.lot_number,
          batch_number: line.batch_number,
          expiry_date: line.expiry_date,
          manufacture_date: line.manufacture_date,
          loading_date: line.loading_date,
          packaging_profile_id: line.packaging_profile_id,
        }),
      });
    });
  }

  let { data, error } = await db("receipts").insert(rows).select("id");
  if (error && isMissingReceiptDraftColumn(error)) {
    ({ data, error } = await db("receipts").insert(rows.map(withoutReceiptDraftColumns)).select("id"));
  }
  if (error) throw error;
  await writeSystemLog({
    log_type: "system_change",
    severity: "info",
    title: `Shipment drafts created for container ${input.container_number.trim()}`,
    message: `${rows.length} pallet draft${rows.length === 1 ? "" : "s"} created.`,
    source: "receiving",
    table_name: "receipts",
    details: { groupId, container_number: input.container_number.trim(), po_number: input.po_number ?? null, draft_count: rows.length },
  }).catch((error) => console.error("[saveShipmentDrafts] writeSystemLog failed:", error));
  return { groupId, draftIds: (data ?? []).map((row: any) => row.id), count: rows.length };
}

export async function updateDraftReceipt(draftId: string, values: z.infer<typeof receivingSchema>): Promise<void> {
  if (values.container_number) {
    const containerValidation = validateIso6346ContainerNumber(values.container_number);
    if (!containerValidation.valid) throw new Error(containerValidation.message);
    values = { ...values, container_number: containerValidation.normalized };
  }
  let { data: existing, error: existingError } = await db("receipts")
    .select("notes, draft_pallet_barcode, draft_group_id, draft_sequence, draft_count, status")
    .eq("id", draftId)
    .in("status", ["draft", "queued"])
    .single();
  if (existingError && isMissingReceiptDraftColumn(existingError)) {
    ({ data: existing, error: existingError } = await db("receipts")
      .select("notes, status")
      .eq("id", draftId)
      .in("status", ["draft", "queued"])
      .single());
  }
  if (existingError) throw existingError;
  const meta = parseReceiptNotes(existing?.notes);
  const draftBarcode = values.pallet_barcode?.trim() || existing?.draft_pallet_barcode || meta.draft_pallet_barcode || buildPalletCode("PLT");
  const nextMeta = {
    ...meta,
    _draft: true,
    draft_pallet_barcode: draftBarcode,
    container_number: values.container_number,
    po_number: values.po_number,
    draft_group_id: values.draft_group_id || existing?.draft_group_id || meta.draft_group_id,
    draft_sequence: values.draft_sequence ?? existing?.draft_sequence ?? meta.draft_sequence,
    draft_count: values.draft_count ?? existing?.draft_count ?? meta.draft_count,
    product_id: values.product_id,
    quantity: values.quantity,
    lot_number: values.lot_number,
    batch_number: values.batch_number,
    expiry_date: values.expiry_date,
    manufacture_date: values.manufacture_date,
    loading_date: values.loading_date,
    packaging_profile_id: values.packaging_profile_id,
    override_length: values.override_length,
    override_width: values.override_width,
    override_height: values.override_height,
    override_weight: values.override_weight,
  };
  const updatePayload: Record<string, any> = {
    receipt_type: values.receipt_type,
    reference_number: normalizeReferenceNumber(values, draftBarcode),
    container_number: values.container_number || null,
    po_number: values.po_number || null,
    draft_group_id: values.draft_group_id || existing?.draft_group_id || meta.draft_group_id || null,
    draft_pallet_barcode: draftBarcode,
    draft_sequence: values.draft_sequence ?? existing?.draft_sequence ?? meta.draft_sequence ?? null,
    draft_count: values.draft_count ?? existing?.draft_count ?? meta.draft_count ?? null,
    warehouse_id: values.warehouse_id,
    client_id: values.client_id || null,
    notes: JSON.stringify(nextMeta),
  };
  if (existing?.status === "queued") {
    updatePayload.status = "draft";
  }
  let { error } = await db("receipts")
    .update({
      ...updatePayload,
    })
    .eq("id", draftId)
    .in("status", ["draft", "queued"]);
  if (error && isMissingReceiptDraftColumn(error)) {
    ({ error } = await db("receipts")
      .update(withoutReceiptDraftColumns(updatePayload))
      .eq("id", draftId)
      .in("status", ["draft", "queued"]));
  }
  if (error) throw error;
  await writeSystemLog({
    log_type: "system_change",
    severity: "info",
    title: "Receiving draft updated",
    message: `Draft ${draftBarcode} was updated.`,
    source: "receiving",
    table_name: "receipts",
    details: { draftId, draft_pallet_barcode: draftBarcode, container_number: values.container_number || null, po_number: values.po_number || null },
  }).catch((error) => console.error("[updateDraftReceipt] writeSystemLog failed:", error));
}

async function createReturnedPalletDraft({
  palletId,
  warehouseId,
  sourceLabel,
  sourceType,
  sourceId,
  reason,
}: {
  palletId: string;
  warehouseId: string;
  sourceLabel: string;
  sourceType: string;
  sourceId?: string;
  reason?: string;
}): Promise<string> {
  const [{ data: pallet, error: palletError }, { data: balance }] = await Promise.all([
    db("pallets").select("*").eq("id", palletId).single(),
    db("inventory_balances").select("*").eq("pallet_id", palletId).maybeSingle(),
  ]);
  if (palletError) throw palletError;

  if (sourceId) {
    const { data: existingDraft, error: existingError } = await db("receipts")
      .select("id")
      .eq("warehouse_id", warehouseId)
      .eq("status", "draft")
      .ilike("notes", `%${sourceId}%`)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingDraft?.id) return existingDraft.id;
  }

  const receiptNumber = buildPalletCode("RCT");
  const quantity = Number(balance?.quantity ?? pallet.quantity ?? 0);
  const receiptRow = {
    receipt_number: receiptNumber,
    receipt_type: "other",
    reference_number: pallet.pallet_barcode ?? receiptNumber,
    draft_pallet_barcode: pallet.pallet_barcode ?? receiptNumber,
    warehouse_id: warehouseId,
    client_id: pallet.client_id ?? null,
    status: "draft",
    notes: JSON.stringify({
      _draft: true,
      _returned: true,
      source_label: sourceLabel,
      source_type: sourceType,
      source_id: sourceId ?? null,
      reason: reason ?? null,
      returned_pallet_id: palletId,
      draft_pallet_barcode: pallet.pallet_barcode,
      product_id: pallet.product_id,
      quantity,
      packaging_profile_id: pallet.packaging_profile_id,
      reuse_pallet_barcode: pallet.pallet_barcode,
    }),
  };
  let { data, error } = await db("receipts").insert(receiptRow).select("id").single();
  if (error && isMissingReceiptDraftColumn(error)) {
    ({ data, error } = await db("receipts").insert(withoutReceiptDraftColumns(receiptRow)).select("id").single());
  }
  if (error) throw error;
  return data.id;
}

export async function listDraftReceipts(warehouseId: string): Promise<DraftReceipt[]> {
  let { data, error } = await db("receipts")
    .select("id, receipt_number, reference_number, container_number, po_number, draft_group_id, draft_pallet_barcode, draft_sequence, draft_count, warehouse_id, client_id, status, created_at, notes, receipt_lines(id, product_id, quantity, received_quantity, inventory_lots(expiry_date, lot_number, batch_number), pallets(id, pallet_barcode, quantity, status))")
    .in("status", ["draft", "queued"])
    .eq("warehouse_id", warehouseId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error && isMissingReceiptDraftColumn(error)) {
    ({ data, error } = await db("receipts")
      .select("id, receipt_number, reference_number, warehouse_id, client_id, status, created_at, notes, receipt_lines(id, product_id, quantity, received_quantity, inventory_lots(expiry_date, lot_number, batch_number), pallets(id, pallet_barcode, quantity, status))")
      .in("status", ["draft", "queued"])
      .eq("warehouse_id", warehouseId)
      .order("created_at", { ascending: false })
      .limit(200));
  }
  if (error) {
    ({ data, error } = await db("receipts")
      .select("id, receipt_number, reference_number, warehouse_id, client_id, status, created_at, notes")
      .in("status", ["draft", "queued"])
      .eq("warehouse_id", warehouseId)
      .order("created_at", { ascending: false })
      .limit(200));
  }
  if (error) throw error;
  return (data ?? [])
    .filter((row: any) => {
      const meta = parseReceiptNotes(row.notes);
      if (meta._seeded_draft) return false;
      if (String(meta.source_label ?? "").toLowerCase().includes("seeded receiving draft")) return false;
      return row.status === "draft" || meta._draft;
    })
    .map((row: any) => {
    const meta = parseReceiptNotes(row.notes);
    const line = Array.isArray(row.receipt_lines) ? row.receipt_lines[0] : row.receipt_lines;
    const pallet = Array.isArray(line?.pallets) ? line.pallets[0] : line?.pallets;
    const lot = Array.isArray(line?.inventory_lots) ? line.inventory_lots[0] : line?.inventory_lots;
    return {
      ...row,
      container_number: row.container_number ?? meta.container_number ?? null,
      po_number: row.po_number ?? meta.po_number ?? null,
      draft_group_id: row.draft_group_id ?? meta.draft_group_id ?? null,
      draft_pallet_barcode: row.draft_pallet_barcode ?? meta.draft_pallet_barcode ?? pallet?.pallet_barcode ?? null,
      draft_sequence: row.draft_sequence ?? meta.draft_sequence ?? null,
      draft_count: row.draft_count ?? meta.draft_count ?? null,
      product_id: meta.product_id ?? line?.product_id ?? null,
      quantity: meta.quantity ?? line?.quantity ?? pallet?.quantity ?? null,
      expiry_date: meta.expiry_date ?? lot?.expiry_date ?? null,
      lot_number: meta.lot_number ?? lot?.lot_number ?? null,
      batch_number: meta.batch_number ?? lot?.batch_number ?? null,
      source_label: meta.source_label ?? (row.status === "queued" ? "Seeded receiving draft" : null),
    };
  });
}

async function completeReturnedPalletDraft(
  draftId: string,
  values: z.infer<typeof receivingSchema>,
  meta: any,
): Promise<{ palletBarcode: string; putawayTaskNumber: string }> {
  const palletId = meta.returned_pallet_id as string | undefined;
  if (!palletId) throw new Error("Returned draft is missing its pallet link.");

  const [{ data: pallet, error: palletError }, { data: existingBalance }] = await Promise.all([
    db("pallets").select("*").eq("id", palletId).single(),
    db("inventory_balances").select("*").eq("pallet_id", palletId).maybeSingle(),
  ]);
  if (palletError) throw palletError;

  const lot = await resolveInventoryLot(values);
  const { data: product, error: productError } = await db("products").select("*").eq("id", values.product_id).single();
  if (productError) throw productError;

  const { error: receiptError } = await db("receipts")
    .update({
      receipt_type: values.receipt_type,
      reference_number: values.reference_number || pallet.pallet_barcode,
      warehouse_id: values.warehouse_id,
      client_id: values.client_id || null,
      status: "completed",
    })
    .eq("id", draftId);
  if (receiptError) throw receiptError;

  await upsertRecord("receipt_lines", {
    receipt_id: draftId,
    product_id: values.product_id,
    packaging_profile_id: values.packaging_profile_id || pallet.packaging_profile_id || null,
    client_id: values.client_id || pallet.client_id || null,
    quantity: values.quantity,
    received_quantity: values.quantity,
    inventory_lot_id: lot.id,
    notes: meta.source_label ? `Returned from ${meta.source_label}` : null,
  });

  await Promise.all([
    db("pallets")
      .update({
        product_id: values.product_id,
        client_id: values.client_id || pallet.client_id || null,
        current_warehouse_id: values.warehouse_id,
        current_location_id: null,
        inventory_lot_id: lot.id,
        packaging_profile_id: values.packaging_profile_id || pallet.packaging_profile_id || null,
        quantity: values.quantity,
        available_quantity: 0,
        status: "receiving",
        is_stored: false,
        length: values.override_length ?? pallet.length ?? product.length,
        width: values.override_width ?? pallet.width ?? product.width,
        height: values.override_height ?? pallet.height ?? product.height,
        weight: values.override_weight ?? pallet.weight ?? product.weight,
      })
      .eq("id", palletId),
    existingBalance
      ? db("inventory_balances")
          .update({
            product_id: values.product_id,
            client_id: values.client_id || pallet.client_id || null,
            warehouse_id: values.warehouse_id,
            zone_id: null,
            location_id: null,
            inventory_lot_id: lot.id,
            status: "receiving",
            quantity: values.quantity,
            available_quantity: 0,
            expiry_date: lot.expiry_date,
          })
          .eq("id", existingBalance.id)
      : upsertRecord("inventory_balances", {
          pallet_id: palletId,
          product_id: values.product_id,
          client_id: values.client_id || pallet.client_id || null,
          warehouse_id: values.warehouse_id,
          inventory_lot_id: lot.id,
          status: "receiving",
          quantity: values.quantity,
          available_quantity: 0,
          expiry_date: lot.expiry_date,
        }),
  ]);

  const suggestions = await (supabase.rpc as any)("directed_putaway_candidates", { in_pallet_id: palletId });
  if (suggestions.error) console.error("[completeReturnedPalletDraft] directed_putaway_candidates failed:", suggestions.error);
  const topSuggestion = suggestions.data?.[0] ?? null;
  const putawayTask = await upsertRecord("putaway_tasks", {
    task_number: buildPalletCode("PTA"),
    pallet_id: palletId,
    warehouse_id: values.warehouse_id,
    suggested_location_id: topSuggestion?.location_id ?? null,
    status: "queued",
  });

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "returned_receipt_completed",
    in_entity_table: "receipts",
    in_entity_id: draftId,
    in_pallet_id: palletId,
    in_warehouse_id: values.warehouse_id,
    in_metadata: { source_label: meta.source_label ?? null, quantity: values.quantity },
  });

  return { palletBarcode: pallet.pallet_barcode, putawayTaskNumber: putawayTask.task_number };
}

export async function completeReceiptFromDraft(
  draftId: string,
  values: z.infer<typeof receivingSchema>,
): Promise<{ palletBarcode: string; putawayTaskNumber: string }> {
  let { data: draft, error: draftError } = await db("receipts").select("id, status, notes, container_number, po_number, draft_group_id, draft_pallet_barcode, draft_sequence, draft_count").eq("id", draftId).single();
  if (draftError && isMissingReceiptDraftColumn(draftError)) {
    ({ data: draft, error: draftError } = await db("receipts").select("id, status, notes").eq("id", draftId).single());
  }
  if (draftError) throw draftError;
  const meta = parseReceiptNotes(draft?.notes);
  if (meta._returned) {
    return completeReturnedPalletDraft(draftId, values, meta);
  }
  if (draft?.status === "queued" && !meta._draft) {
    const { data: line, error: lineError } = await db("receipt_lines")
      .select("id, pallets(id, pallet_barcode), receipts(id)")
      .eq("receipt_id", draftId)
      .limit(1)
      .maybeSingle();
    if (lineError) throw lineError;
    const pallet = Array.isArray((line as any)?.pallets) ? (line as any).pallets[0] : (line as any)?.pallets;
    if (!pallet?.id) throw new Error("Seeded receiving draft is missing its pallet.");
    const { data: putawayTask, error: putawayError } = await db("putaway_tasks")
      .select("task_number")
      .eq("pallet_id", pallet.id)
      .in("status", ["draft", "queued", "assigned", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (putawayError) throw putawayError;
    const { error: receiptError } = await db("receipts").update({ status: "completed" }).eq("id", draftId);
    if (receiptError) throw receiptError;
    return { palletBarcode: pallet.pallet_barcode, putawayTaskNumber: putawayTask?.task_number ?? "existing putaway task" };
  }

  const result = await createReceiptFlow({
    ...values,
    container_number: values.container_number || draft?.container_number || meta.container_number || "",
    po_number: values.po_number || draft?.po_number || meta.po_number || "",
    pallet_barcode: values.pallet_barcode || draft?.draft_pallet_barcode || meta.draft_pallet_barcode || "",
    draft_group_id: values.draft_group_id || draft?.draft_group_id || meta.draft_group_id || undefined,
    draft_sequence: values.draft_sequence ?? draft?.draft_sequence ?? meta.draft_sequence,
    draft_count: values.draft_count ?? draft?.draft_count ?? meta.draft_count,
  });
  const { error: draftCancelError } = await db("receipts").update({ status: "cancelled" }).eq("id", draftId);
  if (draftCancelError) {
    console.error("[completeReceiptFromDraft] failed to cancel draft:", draftCancelError);
  }
  return { palletBarcode: result.pallet.pallet_barcode, putawayTaskNumber: result.putawayTask.task_number };
}

export async function deleteDraftReceipt(draftId: string): Promise<void> {
  const { data: draft } = await db("receipts")
    .select("receipt_number, reference_number, notes")
    .eq("id", draftId)
    .maybeSingle();
  const { error } = await db("receipts").delete().eq("id", draftId).eq("status", "draft");
  if (error) throw error;
  const meta = parseReceiptNotes((draft as any)?.notes);
  await writeSystemLog({
    log_type: "system_change",
    severity: "info",
    title: "Receiving draft cancelled",
    message: `Draft ${meta.draft_pallet_barcode ?? (draft as any)?.receipt_number ?? draftId} was cancelled.`,
    source: "receiving",
    table_name: "receipts",
    details: { draftId, receipt_number: (draft as any)?.receipt_number ?? null, reference_number: (draft as any)?.reference_number ?? null },
  }).catch((error) => console.error("[deleteDraftReceipt] writeSystemLog failed:", error));
}

// ── Bin capacity helper ───────────────────────────────────────────────────────

export async function getBinOccupancy(locationCode: string): Promise<{
  locationId: string;
  locationCode: string;
  maxPallets: number;
  occupiedPallets: number;
  status: string;
} | null> {
  const { data: location, error } = await db("locations")
    .select("id, code, max_pallets, status")
    .eq("code", locationCode)
    .maybeSingle();
  if (error || !location) return null;

  const { count } = await db("inventory_balances")
    .select("*", { count: "exact", head: true })
    .eq("location_id", location.id)
    .neq("status", "picked");

  return {
    locationId: location.id,
    locationCode: location.code,
    maxPallets: location.max_pallets ?? 0,
    occupiedPallets: count ?? 0,
    status: location.status ?? "active",
  };
}

export async function getBayOccupancy(locationCode: string): Promise<{
  anchorCode: string;
  aisle: string | null;
  bay: string | null;
  cells: Array<{
    locationId: string;
    locationCode: string;
    level: string | null;
    depth: string | null;
    maxPallets: number;
    occupiedPallets: number;
    status: string;
    isFull: boolean;
  }>;
} | null> {
  const normalizedCode = locationCode.trim();
  let anchor: any = null;
  const bayParts = normalizedCode.match(/^BAY:([^:]+):([^:]+):([^:]+):([^:]+)$/i);
  const bayCodePrefix = bayParts ? `${bayParts[1]}-${bayParts[2]}-${bayParts[3]}-${bayParts[4]}-` : "";

  if (bayParts) {
    const [, warehouseCode, zoneCode, aisle, bay] = bayParts;
    const { data: warehouse, error: warehouseError } = await db("warehouses")
      .select("id")
      .eq("code", warehouseCode.toUpperCase())
      .maybeSingle();
    if (warehouseError) throw warehouseError;

    let zone: any = null;
    if (warehouse) {
      const zoneResult = await db("zones")
        .select("id")
        .eq("warehouse_id", warehouse.id)
        .eq("code", zoneCode.toUpperCase())
        .maybeSingle();
      if (zoneResult.error) throw zoneResult.error;
      zone = zoneResult.data;
    }

    anchor = {
      code: normalizedCode,
      warehouse_id: warehouse?.id ?? null,
      zone_id: zone?.id ?? null,
      aisle,
      bay,
    };
  } else {
    const { data, error } = await db("locations")
      .select("id, code, warehouse_id, zone_id, aisle, bay")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      anchor = data;
    } else {
      const prefix = normalizedCode.endsWith("-") ? normalizedCode : `${normalizedCode}-`;
      const prefixResult = await db("locations")
        .select("id, code, warehouse_id, zone_id, aisle, bay")
        .eq("location_type", "rack")
        .ilike("code", `${prefix}%`)
        .order("level", { ascending: false })
        .order("depth", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (prefixResult.error) throw prefixResult.error;
      if (!prefixResult.data) return null;
      anchor = { ...prefixResult.data, code: normalizedCode };
    }
  }

  let locations: any[] = [];
  if (anchor.warehouse_id && anchor.zone_id) {
    let query = db("locations")
      .select("id, code, aisle, bay, level, depth, max_pallets, status, location_type")
      .eq("warehouse_id", anchor.warehouse_id)
      .eq("zone_id", anchor.zone_id)
      .eq("location_type", "rack");
    if (anchor.aisle) query = query.eq("aisle", anchor.aisle);
    if (anchor.bay) query = query.eq("bay", anchor.bay);
    const result = await query.order("level", { ascending: false }).order("depth", { ascending: true });
    if (result.error) throw result.error;
    locations = result.data ?? [];
  }

  if ((locations ?? []).length === 0 && bayCodePrefix) {
    const fallback = await db("locations")
      .select("id, code, aisle, bay, level, depth, max_pallets, status, location_type")
      .eq("location_type", "rack")
      .ilike("code", `${bayCodePrefix}%`)
      .order("level", { ascending: false })
      .order("depth", { ascending: true });
    if (fallback.error) throw fallback.error;
    locations = fallback.data ?? [];
  }

  const cells = await Promise.all((locations ?? []).map(async (location: any) => {
    const { count } = await db("inventory_balances")
      .select("*", { count: "exact", head: true })
      .eq("location_id", location.id)
      .not("status", "in", "(picked,shipped,in_transit,missing)");
    const occupiedPallets = count ?? 0;
    const maxPallets = Number(location.max_pallets ?? 0);
    return {
      locationId: location.id,
      locationCode: location.code,
      level: location.level ?? null,
      depth: location.depth ?? null,
      maxPallets,
      occupiedPallets,
      status: location.status ?? "active",
      isFull: maxPallets > 0 && occupiedPallets >= maxPallets,
    };
  }));

  return {
    anchorCode: anchor.code,
    aisle: anchor.aisle ?? null,
    bay: anchor.bay ?? null,
    cells,
  };
}

export async function logPutawayBaySelection(input: {
  taskId: string;
  scannedCode: string;
  selectedLocationCode?: string;
}) {
  const { data: task, error } = await db("putaway_tasks")
    .select("id, task_number, warehouse_id, pallet_id")
    .eq("id", input.taskId)
    .maybeSingle();
  if (error || !task) return;

  const audit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "putaway_bay_selection",
    in_entity_table: "putaway_tasks",
    in_entity_id: input.taskId,
    in_pallet_id: task.pallet_id,
    in_warehouse_id: task.warehouse_id,
    in_metadata: {
      task_number: task.task_number,
      scanned_code: input.scannedCode,
      selected_location_code: input.selectedLocationCode ?? null,
    },
  });
  if (audit.error) console.error("[logPutawayBaySelection] log_audit_event failed:", audit.error);
}

// ── Move to picking area ──────────────────────────────────────────────────────

export async function getPalletByBarcode(barcode: string): Promise<{
  id: string;
  pallet_code: string;
  pallet_barcode: string;
  product_id: string;
  current_warehouse_id: string;
  current_location_id: string | null;
  status: string;
  quantity: number;
  product_sku?: string;
  product_name?: string;
  location_code?: string;
} | null> {
  const { data: pallet, error } = await db("pallets")
    .select("id, pallet_code, pallet_barcode, product_id, current_warehouse_id, current_location_id, status, quantity")
    .eq("pallet_barcode", barcode)
    .maybeSingle();
  if (error || !pallet) return null;
  const [{ data: product }, { data: location }] = await Promise.all([
    db("products").select("sku, name").eq("id", pallet.product_id).maybeSingle(),
    pallet.current_location_id
      ? db("locations").select("code").eq("id", pallet.current_location_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    ...pallet,
    product_sku: (product as any)?.sku,
    product_name: (product as any)?.name,
    location_code: (location as any)?.code,
  };
}

// ── Putaway draft revert ───────────────────────────────────────────────────────
export async function revertPutawayToDraft(taskId: string): Promise<void> {
  const { data: task, error } = await db("putaway_tasks").select("*, pallets(pallet_barcode)").eq("id", taskId).single();
  if (error) throw error;
  if (task.status === "completed") throw new Error("Cannot revert a completed putaway task.");
  if (task.status === "cancelled") throw new Error("Putaway task has already been returned to Receiving.");

  await createReturnedPalletDraft({
    palletId: task.pallet_id,
    warehouseId: task.warehouse_id,
    sourceLabel: `Putaway task ${task.task_number}`,
    sourceType: "putaway_returned",
    sourceId: taskId,
    reason: "Returned to receiving from putaway",
  });

  const [{ error: updErr }, { error: palletErr }, { error: balanceErr }] = await Promise.all([
    db("putaway_tasks")
      .update({ status: "cancelled", completed_at: new Date().toISOString() } as any)
      .eq("id", taskId)
      .in("status", ["queued", "assigned", "in_progress", "exception", "draft"]),
    db("pallets")
      .update({ status: "receiving", current_location_id: null, is_stored: false, available_quantity: 0 } as any)
      .eq("id", task.pallet_id),
    db("inventory_balances")
      .update({ status: "receiving", location_id: null, zone_id: null, available_quantity: 0 } as any)
      .eq("pallet_id", task.pallet_id),
  ]);
  if (updErr) throw updErr;
  if (palletErr) throw palletErr;
  if (balanceErr) throw balanceErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "putaway_reverted_to_draft",
    in_entity_table: "putaway_tasks",
    in_entity_id: taskId,
    in_warehouse_id: task.warehouse_id,
    in_metadata: { previous_status: task.status },
  });
}

// ── Location move tasks ────────────────────────────────────────────────────────
export async function listMoveTasks() {
  const { data, error } = await db("move_tasks")
    .select("*, pallets(pallet_barcode, products(*)), from_location:from_location_id(code, aisle, bay, level, depth), to_location:to_location_id(code, aisle, bay, level, depth)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMoveTask(palletBarcode: string, toLocationCode: string, reason?: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, current_location_id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id")
    .eq("code", toLocationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${toLocationCode}`);

  await upsertRecord("move_tasks", {
    task_number: buildPalletCode("MOV"),
    pallet_id: pallet.id,
    warehouse_id: pallet.warehouse_id,
    from_location_id: pallet.current_location_id,
    to_location_id: toLocation.id,
    status: "queued",
    reason: reason ?? null,
  });
}

export async function completeDirectMove(palletBarcode: string, locationCode: string, reason?: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, current_location_id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id")
    .eq("code", locationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${locationCode}`);

  const completedAt = new Date().toISOString();
  const task = await upsertRecord("move_tasks", {
    task_number: buildPalletCode("MOV"),
    pallet_id: pallet.id,
    warehouse_id: pallet.warehouse_id,
    from_location_id: pallet.current_location_id,
    to_location_id: toLocation.id,
    status: "completed",
    reason: reason ?? null,
    completed_at: completedAt,
  });

  const { error: palletUpdErr } = await db("pallets")
    .update({ current_location_id: toLocation.id } as any)
    .eq("id", pallet.id);
  if (palletUpdErr) throw palletUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_completed",
    in_entity_table: "move_tasks",
    in_entity_id: task.id,
    in_warehouse_id: pallet.warehouse_id,
    in_metadata: { pallet_barcode: palletBarcode, to_location: locationCode, direct_move: true },
  });
}

export async function completeMoveTask(taskId: string, scannedPalletBarcode: string, scannedLocationCode: string): Promise<void> {
  const { data: task, error: taskErr } = await db("move_tasks").select("*").eq("id", taskId).single();
  if (taskErr) throw taskErr;
  if (["completed", "cancelled"].includes(task.status)) {
    throw new Error("Move task is already closed.");
  }

  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, pallet_barcode, current_location_id, warehouse_id")
    .eq("pallet_barcode", scannedPalletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${scannedPalletBarcode}`);
  if (task.pallet_id !== pallet.id) {
    throw new Error("Scanned pallet does not match this move task.");
  }

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id")
    .eq("code", scannedLocationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${scannedLocationCode}`);

  const { error: palletUpdErr } = await db("pallets")
    .update({ current_location_id: toLocation.id } as any)
    .eq("id", pallet.id);
  if (palletUpdErr) throw palletUpdErr;

  const { error: taskUpdErr } = await db("move_tasks")
    .update({ status: "completed", to_location_id: toLocation.id, completed_at: new Date().toISOString() } as any)
    .eq("id", taskId);
  if (taskUpdErr) throw taskUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_completed",
    in_entity_table: "move_tasks",
    in_entity_id: taskId,
    in_warehouse_id: task.warehouse_id,
    in_metadata: { pallet_barcode: scannedPalletBarcode, to_location: scannedLocationCode },
  });
}

export async function cancelMoveTask(taskId: string): Promise<void> {
  const { data: task, error: taskErr } = await db("move_tasks").select("*").eq("id", taskId).single();
  if (taskErr) throw taskErr;
  if (!["queued", "in_progress"].includes(task.status)) {
    throw new Error("Only queued or in-progress move tasks can be cancelled.");
  }

  const { error: taskUpdErr } = await db("move_tasks")
    .update({ status: "cancelled" } as any)
    .eq("id", taskId);
  if (taskUpdErr) throw taskUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_cancelled",
    in_entity_table: "move_tasks",
    in_entity_id: taskId,
    in_warehouse_id: task.warehouse_id,
    in_metadata: { pallet_id: task.pallet_id, from_location_id: task.from_location_id, to_location_id: task.to_location_id },
  });
}

export async function moveToPickingArea(palletBarcode: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  // Find or create a staging/picking location in the same warehouse
  const { data: stagingLoc, error: locErr } = await db("locations")
    .select("id")
    .eq("warehouse_id", pallet.warehouse_id)
    .eq("is_staging", true)
    .limit(1)
    .maybeSingle();
  if (locErr) throw locErr;

  const toLocationId = stagingLoc?.id ?? null;
  const { error: updErr } = await db("pallets")
    .update({ current_location_id: toLocationId } as any)
    .eq("id", pallet.id);
  if (updErr) throw updErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pallet_moved_to_picking_area",
    in_entity_table: "pallets",
    in_entity_id: pallet.id,
    in_warehouse_id: pallet.warehouse_id,
    in_metadata: { pallet_barcode: palletBarcode },
  });
}
