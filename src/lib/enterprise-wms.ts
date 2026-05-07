import type { DashboardMetrics, RoleCode } from "@/lib/wms-core";

type InventoryRow = {
  sku?: string | null;
  product_name?: string | null;
  warehouse_code?: string | null;
  location_code?: string | null;
  pallet_code?: string | null;
  status?: string | null;
  available_quantity?: number | null;
  expiry_date?: string | null;
  received_at?: string | null;
};

type OccupancyRow = {
  location_id?: string | null;
  location_code?: string | null;
  temperature_class?: string | null;
  occupied_pallets?: number | null;
  max_pallets?: number | null;
  is_full?: boolean | null;
};

type CycleCountLine = {
  variance_quantity?: number | null;
  variance_percent?: number | null;
  status?: string | null;
};

export type EnterpriseReportData = {
  inventory?: InventoryRow[];
  occupancy?: OccupancyRow[];
  audits?: Array<Record<string, unknown>>;
  cycleCounts?: CycleCountLine[];
};

export type DashboardMode = "floor" | "dock" | "office";

export type WarehouseBrainRecommendation = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info" | "success";
  audience: RoleCode[];
  reason: string;
  nextAction: string;
};

export type DockHandoffLoad = {
  id: string;
  route: string;
  door: string;
  customer: string;
  driver: string;
  status: "ready" | "called" | "loading" | "blocked" | "loaded";
  pallets: number;
  temperatureClass: string;
  blocker?: string;
};

export type EnterpriseDashboardSnapshot = {
  officeWidgets: Array<{ label: string; value: string; tone: "success" | "warning" | "critical" | "info"; detail: string }>;
  floorQueues: Array<{ label: string; count: number; action: string; route: string; tone: "success" | "warning" | "critical" | "info" }>;
  dockLoads: DockHandoffLoad[];
  leanMetrics: Array<{ label: string; value: string; target: string; status: "on_target" | "watch" | "off_target" }>;
  setupChecklist: Array<{ label: string; complete: boolean; owner: string }>;
  recommendations: WarehouseBrainRecommendation[];
};

export type ZplLabelInput = {
  labelType: "pallet" | "location" | "carton" | "count_sheet" | "pick_list" | "transfer_document";
  code: string;
  title: string;
  subtitle?: string;
  quantity?: number;
};

export type NetSuiteItemPayload = {
  id: string;
  itemId: string;
  displayName?: string;
  upcCode?: string;
  custitem_temperature_class?: string;
  custitem_lot_tracked?: boolean;
  custitem_expiry_tracked?: boolean;
  isInactive?: boolean;
};

export function generateZplLabel(input: ZplLabelInput) {
  const title = sanitizeZpl(input.title).slice(0, 34);
  const subtitle = sanitizeZpl(input.subtitle ?? input.labelType.replace(/_/g, " ")).slice(0, 42);
  const code = sanitizeZpl(input.code).slice(0, 64);
  const quantityLine = input.quantity == null ? "" : `^FO40,238^A0N,28,28^FDQTY ${input.quantity}^FS`;

  return [
    "^XA",
    "^CI28",
    "^PW609",
    "^LL406",
    "^FO28,24^GB553,358,3^FS",
    `^FO40,44^A0N,36,36^FD${title}^FS`,
    `^FO40,92^A0N,24,24^FD${subtitle}^FS`,
    `^FO40,134^BY2,3,88^BCN,88,Y,N,N^FD${code}^FS`,
    quantityLine,
    `^FO40,286^A0N,22,22^FD${input.labelType.toUpperCase().replace(/_/g, " ")}^FS`,
    "^FO40,320^A0N,18,18^FDWarehouse Wizard Enterprise WMS^FS",
    "^XZ",
  ].filter(Boolean).join("\n");
}

export function mapNetSuiteItemToProduct(payload: NetSuiteItemPayload) {
  return {
    external_system: "netsuite",
    external_id: payload.id,
    sku: payload.itemId,
    barcode: payload.upcCode ?? null,
    name: payload.displayName || payload.itemId,
    temperature_requirement: normalizeTemperature(payload.custitem_temperature_class),
    lot_tracked: Boolean(payload.custitem_lot_tracked),
    expiry_tracked: Boolean(payload.custitem_expiry_tracked),
    rotation_method: payload.custitem_expiry_tracked ? "fefo" : "fifo",
    active: !payload.isInactive,
  };
}

export function buildNetSuiteInventoryAdjustment(input: {
  accountId: string;
  sku: string;
  locationExternalId: string;
  quantityDelta: number;
  memo: string;
}) {
  return {
    accountId: input.accountId,
    recordType: "inventoryAdjustment",
    body: {
      memo: input.memo,
      subsidiary: { id: "1" },
    },
    inventory: {
      items: [
        {
          item: { externalId: input.sku },
          location: { externalId: input.locationExternalId },
          adjustQtyBy: input.quantityDelta,
        },
      ],
    },
    idempotencyKey: `netsuite-adjustment-${input.sku}-${input.locationExternalId}-${input.quantityDelta}`,
  };
}

export function buildEnterpriseDashboard(
  metrics: DashboardMetrics | undefined,
  reportData: EnterpriseReportData | undefined,
): EnterpriseDashboardSnapshot {
  const inventory = reportData?.inventory ?? [];
  const occupancy = reportData?.occupancy ?? [];
  const cycleCounts = reportData?.cycleCounts ?? [];
  const expiringSoon = countExpiringSoon(inventory, 30);
  const lowStock = inventory.filter((row) => (row.available_quantity ?? 0) > 0 && (row.available_quantity ?? 0) <= 10).length;
  const controlled = (metrics?.holdStock ?? 0) + (metrics?.quarantineStock ?? 0);
  const fullLocations = occupancy.filter((row) => row.is_full).length;
  const totalCapacity = occupancy.reduce((sum, row) => sum + (row.max_pallets ?? 0), 0);
  const usedCapacity = occupancy.reduce((sum, row) => sum + (row.occupied_pallets ?? 0), 0);
  const fillRate = totalCapacity === 0 ? 0 : Math.round((usedCapacity / totalCapacity) * 100);
  const defects = cycleCounts.filter((line) => (line.variance_quantity ?? 0) !== 0 || line.status === "exception").length;
  const dpmo = cycleCounts.length === 0 ? 0 : Math.round((defects / cycleCounts.length) * 1_000_000);

  return {
    officeWidgets: [
      { label: "Fill level", value: `${fillRate}%`, tone: fillRate > 92 ? "warning" : "success", detail: `${usedCapacity}/${totalCapacity || 0} slots used` },
      { label: "Inventory turn watch", value: `${lowStock}`, tone: lowStock > 0 ? "warning" : "success", detail: "SKUs at or below lean reorder signal" },
      { label: "Expiration risk", value: `${expiringSoon}`, tone: expiringSoon > 0 ? "critical" : "success", detail: "Lots expiring inside 30 days" },
      { label: "DPMO", value: `${dpmo}`, tone: dpmo > 50_000 ? "critical" : dpmo > 10_000 ? "warning" : "success", detail: "Cycle-count defect signal" },
    ],
    floorQueues: [
      { label: "Start Shift", count: (metrics?.openPutawayTasks ?? 0) + (metrics?.openPickLists ?? 0), action: "Open assigned scan work", route: "/putaway-tasks", tone: "info" },
      { label: "Today’s Work", count: metrics?.openPickLists ?? 0, action: "Release or execute picks", route: "/pick-lists", tone: "success" },
      { label: "Blocked Exceptions", count: controlled, action: "Review holds and quarantine", route: "/status", tone: controlled > 0 ? "critical" : "success" },
      { label: "Setup Checklist", count: 6, action: "Finish go-live controls", route: "/setup-wizard", tone: "warning" },
    ],
    dockLoads: buildDockLoads(inventory),
    leanMetrics: [
      { label: "5S location health", value: fullLocations === 0 ? "Clear" : `${fullLocations} full`, target: "No blocked aisles", status: fullLocations > 4 ? "off_target" : fullLocations > 0 ? "watch" : "on_target" },
      { label: "Kanban replenishment", value: `${lowStock} signals`, target: "Zero stockouts", status: lowStock > 8 ? "off_target" : lowStock > 0 ? "watch" : "on_target" },
      { label: "Andon response", value: `${controlled} alerts`, target: "< 3 open", status: controlled > 8 ? "off_target" : controlled > 2 ? "watch" : "on_target" },
      { label: "DMAIC variance", value: `${defects} defects`, target: "Trend down", status: defects > 6 ? "off_target" : defects > 0 ? "watch" : "on_target" },
    ],
    setupChecklist: [
      { label: "Warehouse layout and zones", complete: occupancy.length > 0, owner: "Admin" },
      { label: "Zebra printer stations", complete: false, owner: "Admin" },
      { label: "NetSuite connector mapping", complete: false, owner: "IT" },
      { label: "Barcode standards and label templates", complete: true, owner: "Warehouse manager" },
      { label: "Operator tablet workflows", complete: true, owner: "Supervisor" },
      { label: "Saved reports and AI review cadence", complete: false, owner: "Manager" },
    ],
    recommendations: buildWarehouseBrainRecommendations(metrics, reportData),
  };
}

export function buildWarehouseBrainRecommendations(
  metrics: DashboardMetrics | undefined,
  reportData: EnterpriseReportData | undefined,
): WarehouseBrainRecommendation[] {
  const inventory = reportData?.inventory ?? [];
  const expiringSoon = countExpiringSoon(inventory, 30);
  const lowStock = inventory.filter((row) => (row.available_quantity ?? 0) > 0 && (row.available_quantity ?? 0) <= 10).length;
  const controlled = (metrics?.holdStock ?? 0) + (metrics?.quarantineStock ?? 0);
  const openWork = (metrics?.openPutawayTasks ?? 0) + (metrics?.openPickLists ?? 0);
  const recommendations: WarehouseBrainRecommendation[] = [];

  if (expiringSoon > 0) {
    recommendations.push({
      id: "expiry-risk",
      title: "FEFO risk needs supervisor review",
      severity: "critical",
      audience: ["warehouse_manager", "inventory_clerk"],
      reason: `${expiringSoon} lot${expiringSoon === 1 ? "" : "s"} expire inside the next 30 days.`,
      nextAction: "Prioritize those lots in wave release or move them to hold if QA requires review.",
    });
  }

  if (lowStock > 0) {
    recommendations.push({
      id: "low-stock",
      title: "Kanban replenishment signal",
      severity: "warning",
      audience: ["warehouse_manager", "inventory_clerk"],
      reason: `${lowStock} SKU/location balance${lowStock === 1 ? "" : "s"} are at or below 10 available units.`,
      nextAction: "Create replenishment work or confirm the NetSuite reorder signal before the next wave.",
    });
  }

  if (controlled > 0) {
    recommendations.push({
      id: "controlled-stock",
      title: "Controlled stock is constraining flow",
      severity: controlled > 8 ? "critical" : "warning",
      audience: ["warehouse_manager", "inventory_clerk", "warehouse_operator"],
      reason: `${controlled} pallet${controlled === 1 ? "" : "s"} are on hold or quarantine.`,
      nextAction: "Resolve QA decisions, record root cause, and release or disposition the stock.",
    });
  }

  if (openWork > 0) {
    recommendations.push({
      id: "open-work",
      title: "Shift start work package is ready",
      severity: "info",
      audience: ["warehouse_operator", "warehouse_manager"],
      reason: `${openWork} task group${openWork === 1 ? "" : "s"} are open across putaway and picking.`,
      nextAction: "Use Start Shift on a tablet and work through scan-confirmed tasks.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "stable-flow",
      title: "Warehouse flow is stable",
      severity: "success",
      audience: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"],
      reason: "No urgent expiration, low-stock, hold, or open-work signals are currently elevated.",
      nextAction: "Continue standard work and monitor the office dashboard.",
    });
  }

  return recommendations;
}

export function buildCsvReportRows(reportData: EnterpriseReportData | undefined) {
  return (reportData?.inventory ?? []).map((row) => ({
    sku: row.sku ?? "",
    product: row.product_name ?? "",
    warehouse: row.warehouse_code ?? "",
    location: row.location_code ?? "receiving",
    pallet: row.pallet_code ?? "",
    status: row.status ?? "",
    available_quantity: row.available_quantity ?? 0,
    expiry_date: row.expiry_date ?? "",
  }));
}

function sanitizeZpl(value: string) {
  return value.replace(/[\^~]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTemperature(value: string | undefined) {
  const normalized = value?.toLowerCase();
  if (normalized === "cool" || normalized === "frozen") return normalized;
  return "ambient";
}

function countExpiringSoon(inventory: InventoryRow[], days: number) {
  const now = new Date();
  const max = new Date(now);
  max.setDate(now.getDate() + days);

  return inventory.filter((row) => {
    if (!row.expiry_date) return false;
    const expiry = new Date(row.expiry_date);
    return expiry >= now && expiry <= max;
  }).length;
}

function buildDockLoads(inventory: InventoryRow[]): DockHandoffLoad[] {
  const staged = inventory.filter((row) => row.status === "staged" || row.status === "picked").slice(0, 6);
  const source = staged.length > 0 ? staged : inventory.slice(0, 4);

  return source.map((row, index) => ({
    id: row.pallet_code ?? `dock-${index + 1}`,
    route: `R-${String(index + 1).padStart(2, "0")}`,
    door: `D${(index % 4) + 1}`,
    customer: row.product_name ?? row.sku ?? "Open order",
    driver: index % 2 === 0 ? "Assigned" : "Awaiting check-in",
    status: index === 0 ? "ready" : index === 1 ? "called" : index === 2 ? "loading" : index === 3 ? "blocked" : "loaded",
    pallets: Math.max(1, Math.round((row.available_quantity ?? 1) / 20)),
    temperatureClass: row.expiry_date ? "cool" : "ambient",
    blocker: index === 3 ? "QA release required" : undefined,
  }));
}
