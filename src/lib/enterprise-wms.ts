import type { DashboardMetrics, DashboardTaskRow, RoleCode } from "@/lib/wms-core";

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

type StagingLoadRow = {
  id?: string | null;
  route_code?: string | null;
  status?: DockHandoffLoad["status"] | null;
  blocker?: string | null;
  load_sequence?: number | null;
  pick_list_id?: string | null;
  dock_appointment_id?: string | null;
  pick_lists?: {
    pick_list_number?: string | null;
    warehouse_id?: string | null;
    clients?: { code?: string | null; name?: string | null } | null;
  } | null;
};

type DockAppointmentRow = {
  id?: string | null;
  dock_door?: string | null;
  carrier?: string | null;
  driver_name?: string | null;
  status?: string | null;
};

type PrinterStationRow = {
  active?: boolean | null;
};

type LabelTemplateRow = {
  active?: boolean | null;
};

type PrintJobRow = {
  status?: string | null;
};

type AiRecommendationRow = {
  id?: string | null;
  recommendation_key?: string | null;
  title?: string | null;
  severity?: WarehouseBrainRecommendation["severity"] | null;
  audience?: RoleCode[] | null;
  reason?: string | null;
  next_action?: string | null;
};

export type EnterpriseReportData = {
  inventory?: InventoryRow[];
  occupancy?: OccupancyRow[];
  audits?: Array<Record<string, unknown>>;
  cycleCounts?: CycleCountLine[];
  stagingLoads?: StagingLoadRow[];
  dockAppointments?: DockAppointmentRow[];
  printerStations?: PrinterStationRow[];
  labelTemplates?: LabelTemplateRow[];
  printJobs?: PrintJobRow[];
  replenishments?: Array<Record<string, unknown>>;
  aiRecommendations?: AiRecommendationRow[];
};

export type DashboardMode = "floor" | "dock" | "office";

export type WarehouseBrainRecommendation = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info" | "success";
  audience: RoleCode[];
  reason: string;
  nextAction: string;
  route: string;
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
  officeWidgets: Array<{ label: string; value: string; tone: "success" | "warning" | "critical" | "info"; detail: string; route: string }>;
  floorQueues: Array<{ label: string; count: number; action: string; route: string; tone: "success" | "warning" | "critical" | "info"; tasks: DashboardTaskRow[] }>;
  dockLoads: DockHandoffLoad[];
  leanMetrics: Array<{ label: string; value: string; target: string; status: "on_target" | "watch" | "off_target"; route: string }>;
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
  const activePrinters = (reportData?.printerStations ?? []).filter((row) => row.active).length;
  const activeLabelTemplates = (reportData?.labelTemplates ?? []).filter((row) => row.active).length;
  const failedPrintJobs = (reportData?.printJobs ?? []).filter((row) => row.status === "failed").length;

  return {
    officeWidgets: [
      { label: "Fill level", value: `${fillRate}%`, tone: fillRate > 92 ? "warning" : "success", detail: `${usedCapacity}/${totalCapacity || 0} slots used`, route: "/locations" },
      { label: "Inventory turn watch", value: `${lowStock}`, tone: lowStock > 0 ? "warning" : "success", detail: "SKU/location balances at or below 10 available units", route: "/inventory-search" },
      { label: "Expiration risk", value: `${expiringSoon}`, tone: expiringSoon > 0 ? "critical" : "success", detail: "Lots expiring inside 30 days", route: "/inventory-search" },
      { label: "DPMO", value: `${dpmo}`, tone: dpmo > 50_000 ? "critical" : dpmo > 10_000 ? "warning" : "success", detail: "Cycle-count defect signal", route: "/cycle-counts" },
    ],
    floorQueues: [
      {
        label: "Inbound",
        count: metrics?.openReceipts ?? 0,
        action: "Receive or resume open receipts",
        route: "/receiving",
        tone: "info",
        tasks: (metrics?.receiptRows ?? []).slice(0, 5),
      },
      {
        label: "Putaway",
        count: metrics?.openPutawayTasks ?? 0,
        action: "Complete scan-confirmed putaway",
        route: "/putaway-tasks",
        tone: (metrics?.openPutawayTasks ?? 0) > 0 ? "warning" : "success",
        tasks: (metrics?.putawayTaskRows ?? []).slice(0, 5),
      },
      {
        label: "Outbound",
        count: metrics?.openPickLists ?? 0,
        action: "Release or execute picks",
        route: "/pick-lists",
        tone: (metrics?.openPickLists ?? 0) > 0 ? "info" : "success",
        tasks: (metrics?.pickListRows ?? []).slice(0, 5),
      },
      {
        label: "Moves & Counts",
        count: (metrics?.openMoveTasks ?? 0) + (metrics?.openTransfers ?? 0) + (metrics?.openCycleCounts ?? 0),
        action: "Review active moves, transfers, and counts",
        route: "/location-moves",
        tone: "info",
        tasks: [
          ...(metrics?.moveTaskRows ?? []),
          ...(metrics?.transferRows ?? []),
          ...(metrics?.cycleCountRows ?? []),
        ].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).slice(0, 5),
      },
      {
        label: "Blocked Exceptions",
        count: controlled,
        action: "Review holds and quarantine",
        route: "/status",
        tone: controlled > 0 ? "critical" : "success",
        tasks: (metrics?.blockedBalanceRows ?? []).slice(0, 5),
      },
    ],
    dockLoads: buildDockLoads(reportData?.stagingLoads ?? [], reportData?.dockAppointments ?? []),
    leanMetrics: [
      { label: "5S location health", value: fullLocations === 0 ? "Clear" : `${fullLocations} full`, target: "No blocked aisles", status: fullLocations > 4 ? "off_target" : fullLocations > 0 ? "watch" : "on_target", route: "/locations" },
      { label: "Kanban replenishment", value: `${lowStock} signals`, target: "Zero stockouts", status: lowStock > 8 ? "off_target" : lowStock > 0 ? "watch" : "on_target", route: "/inventory-search" },
      { label: "Andon response", value: `${controlled} alerts`, target: "< 3 open", status: controlled > 8 ? "off_target" : controlled > 2 ? "watch" : "on_target", route: "/status" },
      { label: "DMAIC variance", value: `${defects} defects`, target: "Trend down", status: defects > 6 ? "off_target" : defects > 0 ? "watch" : "on_target", route: "/cycle-counts" },
    ],
    setupChecklist: [
      { label: "Warehouse layout and zones", complete: occupancy.length > 0, owner: "Admin" },
      { label: "Zebra printer stations", complete: activePrinters > 0 && failedPrintJobs === 0, owner: "Admin" },
      { label: "NetSuite connector mapping", complete: false, owner: "IT" },
      { label: "Barcode standards and label templates", complete: activeLabelTemplates > 0, owner: "Warehouse manager" },
      { label: "Operator tablet workflows", complete: (metrics?.recentAuditEvents ?? 0) > 0, owner: "Supervisor" },
      { label: "Saved reports and AI review cadence", complete: (reportData?.aiRecommendations ?? []).length > 0, owner: "Manager" },
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
  const dockBlocks = (reportData?.stagingLoads ?? []).filter((row) => row.status === "blocked").length;
  const failedPrintJobs = (reportData?.printJobs ?? []).filter((row) => row.status === "failed").length;
  const savedRecommendations = (reportData?.aiRecommendations ?? []).filter((row) => row.title && row.reason && row.next_action);
  const recommendations: WarehouseBrainRecommendation[] = [];

  for (const item of savedRecommendations) {
    recommendations.push({
      id: item.id ?? item.recommendation_key ?? `saved-${recommendations.length + 1}`,
      title: item.title ?? "Saved recommendation",
      severity: item.severity ?? "info",
      audience: item.audience ?? ["warehouse_manager"],
      reason: item.reason ?? "Saved live recommendation is open.",
      nextAction: item.next_action ?? "Review the open recommendation.",
      route: "/reports",
    });
  }

  if (expiringSoon > 0) {
    recommendations.push({
      id: "expiry-risk",
      title: "FEFO risk needs supervisor review",
      severity: "critical",
      audience: ["warehouse_manager", "inventory_clerk"],
      reason: `${expiringSoon} lot${expiringSoon === 1 ? "" : "s"} expire inside the next 30 days.`,
      nextAction: "Prioritize those lots in wave release or move them to hold if QA requires review.",
      route: "/inventory-search",
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
      route: "/inventory-search",
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
      route: "/status",
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
      route: "/putaway-tasks",
    });
  }

  if (dockBlocks > 0) {
    recommendations.push({
      id: "blocked-dock-loads",
      title: "Dock handoff has blocked loads",
      severity: "critical",
      audience: ["warehouse_manager", "warehouse_operator", "dispatch_driver"],
      reason: `${dockBlocks} staging load${dockBlocks === 1 ? "" : "s"} are blocked.`,
      nextAction: "Clear the blocker before calling the driver or loading the route.",
      route: "/pick-lists",
    });
  }

  if (failedPrintJobs > 0) {
    recommendations.push({
      id: "failed-print-jobs",
      title: "Label printing needs attention",
      severity: "warning",
      audience: ["admin", "warehouse_manager"],
      reason: `${failedPrintJobs} recent print job${failedPrintJobs === 1 ? "" : "s"} failed.`,
      nextAction: "Check printer stations and reprint failed labels before the next scan workflow.",
      route: "/settings",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "insufficient-data",
      title: "Not enough live data yet",
      severity: "info",
      audience: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator"],
      reason: "Warehouse Intelligence needs current inventory, task, dock, audit, or cycle-count activity before it can make a supported recommendation.",
      nextAction: "Run normal receiving, putaway, picking, dock, or count workflows, then return here for evidence-backed signals.",
      route: "/dashboard",
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

function buildDockLoads(stagingLoads: StagingLoadRow[], appointments: DockAppointmentRow[]): DockHandoffLoad[] {
  return stagingLoads.map((row, index) => {
    const appointment = appointments.find((item) => item.id === row.dock_appointment_id);
    const customer = row.pick_lists?.clients?.name ?? row.pick_lists?.clients?.code ?? row.pick_lists?.pick_list_number ?? "Open load";
    return {
      id: row.id ?? `dock-${index + 1}`,
      route: row.route_code ?? row.pick_lists?.pick_list_number ?? `Load ${index + 1}`,
      door: appointment?.dock_door ?? "Unassigned",
      customer,
      driver: appointment?.driver_name ?? appointment?.carrier ?? "Awaiting check-in",
      status: row.status ?? "ready",
      pallets: 1,
      temperatureClass: "live load",
      blocker: row.blocker ?? undefined,
    };
  });
}
