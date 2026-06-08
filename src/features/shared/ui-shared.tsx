import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertCircle, AlertTriangle, ArrowLeftRight, BarChart3, Bot, Boxes, Building2, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, CloudOff, Download, Eye, EyeOff, FileDown, Forklift, GripVertical, HelpCircle, Home, Info, KeyRound, LayoutDashboard, Loader2, Lock, LockOpen, LogOut, Mail, Maximize2, MapPinned, Menu, Minimize2, Network, Package, PackageX, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Printer, QrCode, RadioTower, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Star, Tags, Trash2, Truck, Upload, UserPlus, Users } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags, MODULE_LABELS, STARTER_MODULES, type ModuleKey } from "@/hooks/use-feature-flags";
import { assertOnline, useNetworkStatus } from "@/hooks/use-network-status";
import {
  enqueueOfflineWork,
  flushOfflineQueue,
  installOfflineAutoReplay,
  isLikelyNetworkError,
  useOfflineQueue,
  useDeadLetterQueue,

  type FailedWorkItem,
} from "@/lib/offline-queue";
import { useBackgroundSync } from "@/hooks/use-background-sync";
import {
  NAVIGATION,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type AdminInviteUserInput,
  type AppRoute,
  type FieldDefinition,
  type ResourceDefinition,
  type DraftReceipt,
  type BayOccupancyCell,
  adminInviteUser,
  adminDeleteUser,
  adminUpdateUserPin,
  adminUpdateUserPassword,
  buildBayOccupancyGrid,
  updateOwnPassword,
  changePalletStatus,
  confirmPutaway,
  createCycleCountFlow,
  createPickListFlow,
  getPickableStockSummary,
  createTransferFlow,
  cancelPickList,
  deleteClientVariable,
  deleteResourceCascade,
  dispatchTransfer,
  cycleCountSchema,
  resetWmsData,
  removeUserRoleAssignment,
  downloadCsv,
  downloadCsvTemplate,
  fetchOptions,
  formatDate,
  formatNumber,
  getDashboardMetrics,
  getInventoryDetail,
  getPickExecution,
  getBinOccupancy,
  getBayOccupancy,
  getWarehouseBayOccupancy,
  type WarehouseBayGroup,
  logPutawayBaySelection,
  getPutawayTasks,
  getPutawayTaskHistory,
  getReportData,
  parseCsvForResource,
  commitImportRows,
  type ImportPreview,
  listClientVariables,
  listDraftReceipts,
  saveShipmentDrafts,
  updateDraftReceipt,
  completeReceiptFromDraft,
  deleteDraftReceipt,
  listSystemLogs,
  listUserActivities,
  listCycleCounts,
  listPickLists,
  listRecords,
  listStatusPallets,
  listTransfers,
  pickListSchema,
  receivingSchema,
  receiveTransfer,
  resolveSystemLog,
  searchInventory,
  setProfileActive,
  snapshotRecordCounts,
  updateProfileDetails,
  updateProfileDefaultWarehouse,
  statusChangeSchema,
  setResourceVisibility,
  setUserRoleVisibility,
  submitCycleCountLine,
  transferSchema,
  updateRecord,
  upsertClientVariable,
  upsertRecord,
  writeSystemLog,
  cancelTransfer,
  flagCountLineException,
  revertPutawayToDraft,
  listMoveTasks,
  completeDirectMove,
  completeMoveTask,
  cancelMoveTask,
  expandLocationRange,
  buildRackLocationCode,
  suggestNextRackPosition,
  validateMoveDestination,
  type MoveValidationResult,
} from "@/lib/wms-core";
import { ProductSearch } from "@/components/product-search";
import { PalletLabelPage } from "@/components/pallet-label-page";
import { BarcodeScanButton } from "@/components/barcode-scan-button";
import { type ProductSearchHandle } from "@/components/product-search";

import { cn } from "@/lib/utils";
import { extractIso6346ContainerNumber, normalizeContainerNumber, validateIso6346ContainerNumber } from "@/lib/container-number";
import { getOrCreateDeviceId } from "@/lib/device-identity";
import { invalidateWarehouseData } from "@/lib/query-invalidation";
import {
  filterDashboardTileDefinitions,
  hiddenDashboardTiles,
  loadDashboardDeviceLayout,
  loadDashboardTileVisibility,
  sanitizeDashboardLayout,
  saveDashboardDeviceLayout,
  saveDashboardTileVisibility,
  visibleDashboardTiles,
  type DashboardCardSize,
  type DashboardTileConfig,
  type DashboardTileDefinition,
  type DashboardVisibilityMap,
} from "@/lib/dashboard-preferences";
import {
  buildCsvReportRows,
  buildEnterpriseDashboard,
  type DashboardMode,
  type DockHandoffLoad,
  type EnterpriseDashboardSnapshot,
  type WarehouseBrainRecommendation,
} from "@/lib/enterprise-wms";
import { HelpSidebar } from "@/components/help-sidebar";
import { ZoneLabelPage } from "@/components/zone-label-page";
import { LocationLabelPage } from "@/components/location-label-page";
import { BayLocationCodesPrintDialog, LabelSheetPrintDialog, type LabelSheetItem } from "@/components/label-sheet-print";
import { WarehouseStructureTab } from "@/components/warehouse-tree-view";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// removed unused dropdown-menu and drawer imports
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const baseFormSchema = z.record(z.any());
const appTitle = "Warehouse Wizard Enterprise WMS";

type DashboardMetricKey =
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

type DashboardCardConfig = DashboardTileDefinition<ModuleKey> & {
  metricKey: DashboardMetricKey;
};

const DEFAULT_DASHBOARD_CARDS: DashboardCardConfig[] = [
  { id: "totalPallets", label: "Total Pallets", metricKey: "totalPallets", size: "lg", moduleKey: "inventory" },
  { id: "warehousePallets", label: "This Warehouse", metricKey: "warehousePallets", size: "lg", moduleKey: "inventory" },
  { id: "openReceipts", label: "Open Receipts", metricKey: "openReceipts", size: "sm", moduleKey: "receiving" },
  { id: "openPutawayTasks", label: "Open Put-Away", metricKey: "openPutawayTasks", size: "sm", moduleKey: "putaway" },
  { id: "openPickLists", label: "Open Pick Lists", metricKey: "openPickLists", size: "sm", moduleKey: "pick-lists" },
  { id: "openMoveTasks", label: "Open Moves", metricKey: "openMoveTasks", size: "sm", moduleKey: "location-moves" },
  { id: "expiryWarning30", label: "Expiry 30 Days", metricKey: "expiryWarning30", size: "sm", moduleKey: "inventory" },
  { id: "expiryWarning60", label: "Expiry 60 Days", metricKey: "expiryWarning60", size: "sm", moduleKey: "inventory" },
  { id: "stockAge3Months", label: "Aging 3+ Mo", metricKey: "stockAge3Months", size: "sm", moduleKey: "inventory" },
  { id: "stockAge6Months", label: "Aging 6+ Mo", metricKey: "stockAge6Months", size: "sm", moduleKey: "inventory" },
  { id: "stockAge12Months", label: "Aging 12+ Mo", metricKey: "stockAge12Months", size: "sm", moduleKey: "inventory" },
];

const DASHBOARD_FLOOR_LAYOUT_KEY = "wms.dashboard.floor.surface.layout.v1";
const DASHBOARD_DOCK_LAYOUT_KEY = "wms.dashboard.dock.surface.layout.v1";
const DASHBOARD_OFFICE_LAYOUT_KEY = "wms.dashboard.office.surface.layout.v1";
const DASHBOARD_DIAL_METRICS = new Set<DashboardMetricKey>(["totalPallets", "warehousePallets"]);
const DASHBOARD_METRIC_ROUTES: Record<DashboardMetricKey, AppRoute> = {
  totalPallets: "/inventory-search",
  warehousePallets: "/inventory-search",
  availablePallets: "/inventory-search",
  coolZoneOccupancy: "/locations",
  openReceipts: "/receiving",
  openPutawayTasks: "/putaway-tasks",
  openPickLists: "/pick-lists",
  openMoveTasks: "/location-moves",
  openTransfers: "/transfers",
  openCycleCounts: "/cycle-counts",
  openDockLoads: "/pick-lists",
  openReplenishmentTasks: "/inventory-search",
  recentAuditEvents: "/system-log",
  holdStock: "/status",
  quarantineStock: "/status",
  expiryWarning60: "/inventory-search",
  expiryWarning30: "/inventory-search",
  stockAge3Months: "/inventory-search",
  stockAge6Months: "/inventory-search",
  stockAge12Months: "/inventory-search",
};

function dashboardMetricLink(metricKey: DashboardMetricKey) {
  if (metricKey === "stockAge3Months") return "/inventory-search?age=3m";
  if (metricKey === "stockAge6Months") return "/inventory-search?age=6m";
  if (metricKey === "stockAge12Months") return "/inventory-search?age=12m";
  if (metricKey === "expiryWarning30") return "/inventory-search?expiry=30d";
  if (metricKey === "expiryWarning60") return "/inventory-search?expiry=60d";
  return DASHBOARD_METRIC_ROUTES[metricKey];
}
const DEFAULT_FLOOR_TILES: DashboardTileDefinition<ModuleKey>[] = [
  { id: "Inbound", label: "Inbound", size: "lg", moduleKey: "receiving" },
  { id: "Putaway", label: "Put-Away", size: "lg", moduleKey: "putaway" },
  { id: "Warehouse Intelligence", label: "Warehouse Intelligence", size: "lg" },
  { id: "Outbound", label: "Outbound", size: "lg", moduleKey: "pick-lists" },
  { id: "Moves & Counts", label: "Moves & Counts", size: "lg", moduleKey: "location-moves" },
  { id: "Blocked Exceptions", label: "Blocked Exceptions", size: "lg", moduleKey: "status" },
];

const DEFAULT_DOCK_TILES: DashboardTileDefinition<ModuleKey>[] = [
  { id: "ready", label: "Ready", size: "sm", moduleKey: "pick-lists" },
  { id: "called", label: "Called", size: "sm", moduleKey: "pick-lists" },
  { id: "loading", label: "Loading", size: "sm", moduleKey: "pick-lists" },
  { id: "blocked", label: "Blocked", size: "sm", moduleKey: "pick-lists" },
  { id: "loaded", label: "Loaded", size: "sm", moduleKey: "pick-lists" },
  { id: "warehouse-brain", label: "Warehouse Brain", size: "lg" },
];

const DEFAULT_OFFICE_TILES: DashboardTileDefinition<ModuleKey>[] = [
  { id: "Fill level", label: "Fill level", size: "lg", moduleKey: "locations" },
  { id: "Inventory turn watch", label: "Inventory turn watch", size: "lg", moduleKey: "inventory" },
  { id: "Expiration risk", label: "Expiration risk", size: "lg", moduleKey: "inventory" },
  { id: "DPMO", label: "DPMO", size: "lg", moduleKey: "cycle-counts" },
  { id: "setup-checklist", label: "Setup Checklist", size: "lg", moduleKey: "settings" },
  { id: "warehouse-brain", label: "Warehouse Brain", size: "lg" },
];

const DEFAULT_FLOOR_LAYOUT: DashboardTileDefinition<ModuleKey>[] = [...DEFAULT_DASHBOARD_CARDS, ...DEFAULT_FLOOR_TILES];
const DEFAULT_DOCK_LAYOUT: DashboardTileDefinition<ModuleKey>[] = [...DEFAULT_DASHBOARD_CARDS, ...DEFAULT_DOCK_TILES];
const DEFAULT_OFFICE_LAYOUT: DashboardTileDefinition<ModuleKey>[] = [...DEFAULT_DASHBOARD_CARDS, ...DEFAULT_OFFICE_TILES];

export function tileConfigsFromDefinitions(definitions: DashboardTileDefinition<ModuleKey>[]): DashboardTileConfig[] {
  return definitions.map((tile) => ({ id: tile.id, size: tile.size }));
}

// ---------------------------------------------------------------------------
// Barcode scanner helpers
// ---------------------------------------------------------------------------

/** Play a short, pleasant confirmation beep via Web Audio API (works on iOS/Android too). */
export function playBarcodeBeep() {
  try {
    const ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1480, ctx.currentTime);          // E6 — bright & pleasant
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.06); // quick upward chirp
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available — silent fallback
  }
}

/**
 * Flash an input element with a colour highlight for scanner feedback.
 * colour: "orange" = next-field cue, "blue" = confirmed-field cue.
 */
export function flashInput(el: HTMLElement | null, colour: "orange" | "blue") {
  if (!el) return;
  const cls = colour === "orange"
    ? ["ring-2", "ring-orange-400", "ring-offset-1"]
    : ["ring-2", "ring-blue-400", "ring-offset-1"];
  el.classList.add(...cls);
  setTimeout(() => el.classList.remove(...cls), 700);
}

export function loadFallbackTileLayout(key: string, defaults: DashboardTileConfig[]) {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    return sanitizeDashboardLayout(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

export function fallbackLayoutKey(key: string, profileId?: string | null, deviceId?: string | null) {
  return [key, profileId ?? "anonymous", deviceId ?? "device"].join(".");
}

export function loadFallbackVisibility(key: string): DashboardVisibilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as DashboardVisibilityMap : {};
  } catch {
    return {};
  }
}

export function fallbackVisibilityKey(profileId: string | null | undefined, mode: DashboardMode) {
  return `wms.dashboard.visibility.v1.${profileId ?? "anonymous"}.${mode}`;
}

export function saveFallbackJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function SortableDashboardTile({
  tile,
  editMode,
  onResize,
  onHide,
  children,
  className,
}: {
  tile: DashboardTileConfig;
  editMode: boolean;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id, disabled: !editMode });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(tile.size === "lg" ? "sm:col-span-2" : undefined, className)}>
      <div className="group relative h-full">
        {children}
        {editMode ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-background/80 p-0.5 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => onHide(tile.id)}
              className="grid h-6 w-6 place-items-center rounded-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Hide tile"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onResize(tile.id)}
              className="grid h-6 w-6 place-items-center rounded-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Resize tile"
            >
              {tile.size === "sm" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className="grid h-6 w-6 cursor-grab place-items-center rounded-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground active:cursor-grabbing"
              aria-label="Drag tile"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SortableMetricCard({
  card,
  value,
  isLoading,
  editMode,
  onResize,
  onHide,
}: {
  card: DashboardCardConfig;
  value: number;
  isLoading: boolean;
  editMode: boolean;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
}) {
  return (
    <SortableDashboardTile tile={card} editMode={editMode} onResize={onResize} onHide={onHide}>
      <Card className="relative h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 pr-20">
          <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to={dashboardMetricLink(card.metricKey)} className="block rounded-sm transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <div className="text-3xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatNumber(value)}
            </div>
          </Link>
        </CardContent>
      </Card>
    </SortableDashboardTile>
  );
}

export function SortableSummaryCard({
  card,
  metrics,
  isLoading,
  warehouseCaption,
  editMode,
  onResize,
  onHide,
}: {
  card: DashboardCardConfig;
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>> | undefined;
  isLoading: boolean;
  warehouseCaption: string;
  editMode: boolean;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
}) {
  if (DASHBOARD_DIAL_METRICS.has(card.metricKey)) {
    const capacity = card.metricKey === "totalPallets" ? metrics?.totalPalletCapacity ?? 0 : metrics?.warehousePalletCapacity ?? 0;
    const caption = card.metricKey === "totalPallets" ? `${formatNumber(metrics?.totalPalletCapacity ?? 0)} location capacity` : warehouseCaption;
    return (
      <SortableDashboardTile tile={card} editMode={editMode} onResize={onResize} onHide={onHide}>
        <PalletDialCard
          label={card.label}
          value={metrics?.[card.metricKey] ?? 0}
          capacity={capacity}
          caption={caption}
          isLoading={isLoading}
          route={dashboardMetricLink(card.metricKey)}
        />
      </SortableDashboardTile>
    );
  }

  return <SortableMetricCard card={card} value={metrics?.[card.metricKey] ?? 0} isLoading={isLoading} editMode={editMode} onResize={onResize} onHide={onHide} />;
}

export function PalletDialCard({
  label,
  value,
  capacity,
  caption,
  isLoading,
  route,
}: {
  label: string;
  value: number;
  capacity: number;
  caption: string;
  isLoading: boolean;
  route: string;
}) {
  const percentage = capacity > 0 ? Math.min(100, Math.round((value / capacity) * 100)) : 0;

  return (
    <Card className="h-full min-h-0">
      <CardContent className="flex h-full items-center gap-4 p-4 pr-20">
        <Link
          to={route}
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${label} ${percentage}%`}
          title={`Open source: ${label}`}
        >
        <div
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${percentage}%, hsl(var(--accent) / 0.35) ${percentage}% 100%)`,
          }}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-card text-sm font-semibold">
            {isLoading ? <Loader2 className="h-5 w-5 animate-themed-loader" /> : `${percentage}%`}
          </div>
        </div>
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <Link to={route} className="block rounded-sm transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <p className="text-3xl font-bold tracking-tight">{isLoading ? "..." : formatNumber(value)}</p>
          </Link>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  default_warehouse_id?: string | null;
  active?: boolean | null;
  approved?: boolean | null;
  user_code?: string | null;
  badge_code?: string | null;
};

type WarehouseOption = {
  id: string;
  name: string;
};

type UserActivityRow = {
  id: string;
  event_type: string;
  entity_table: string;
  actor_user_id?: string | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

const navIcons: Record<AppRoute, typeof LayoutDashboard> = {
  "/": Home,
  "/dashboard": LayoutDashboard,
  "/warehouses": Building2,
  "/zones": Boxes,
  "/locations": MapPinned,
  "/clients": Users,
  "/products": Package,
  "/packaging-profiles": Tags,
  "/receiving": Download,
  "/putaway-tasks": Forklift,
  "/inventory-search": Search,
  "/inventory/:balanceId": Search,
  "/pick-lists": ClipboardList,
  "/pick-lists/:pickListId": ClipboardList,
  "/transfers": Truck,
  "/location-moves": ArrowLeftRight,
  "/cycle-counts": ClipboardCheck,
  "/status": ShieldCheck,
  "/reports": BarChart3,
  "/users": Users,
  "/settings": Settings,
  "/system-log": Activity,
  "/email-log": Mail,
  "/help": HelpCircle,
  "/setup-wizard": Settings,
};

export function TableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("h-[calc(100svh-14rem)] min-h-48 w-full min-w-0 touch-pan-x overflow-auto overscroll-x-contain overscroll-y-contain [&_table]:min-w-max", className)}>
      {children}
    </div>
  );
}

export function renderField(
  field: FieldDefinition,
  form: ReturnType<typeof useForm<Record<string, unknown>>>,
  options: Array<{ label: string; value: string }> = field.options ?? [],
) {
  const uppercaseInput = shouldUppercaseField(field.name);
  return (
    <FormField
      key={field.name}
      control={form.control}
      name={field.name}
      render={({ field: controllerField }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            {field.type === "textarea" ? (
              <Textarea {...controllerField} value={(controllerField.value as string | undefined) ?? ""} />
            ) : field.type === "select" ? (
              <Select
                onValueChange={controllerField.onChange}
                value={(controllerField.value as string | undefined) ?? undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "boolean" ? (
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <Checkbox checked={Boolean(controllerField.value)} onCheckedChange={controllerField.onChange} />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            ) : (
              <Input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                {...controllerField}
                value={(controllerField.value as string | number | undefined) ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  controllerField.onChange(uppercaseInput ? normalizeScannerText(value) : value);
                }}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function RackLocationCodeBuilder({
  form,
  options,
}: {
  form: ReturnType<typeof useForm<Record<string, unknown>>>;
  options: Awaited<ReturnType<typeof fetchOptions>> | undefined;
}) {
  const [rack, setRack] = useState("A");
  const [aisle, setAisle] = useState(1);
  const [bay, setBay] = useState(1);
  const [level, setLevel] = useState(1);
  const [position, setPosition] = useState(1);
  const [depth, setDepth] = useState(1);

  const localCode = buildRackLocationCode({ rack, aisle, bay, level, position });
  const prefixKey = `${rack.toUpperCase()}-${aisle}-${String(bay).padStart(2, "0")}-L${String(level).padStart(2, "0")}`;

  const { data: existingAtPrefix = [] } = useQuery({
    queryKey: ["locations-prefix", prefixKey],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("code").ilike("code", `%-${prefixKey}-%`);
      return (data ?? []).map((r: any) => String(r.code));
    },
    enabled: Boolean(rack && aisle && bay && level),
    staleTime: 10_000,
  });

  const isDuplicate = existingAtPrefix.some((c) => c.toUpperCase().includes(localCode.toUpperCase()));
  const nextSuggestion = suggestNextRackPosition(existingAtPrefix, rack, aisle, bay, level);

  const warehouseId = form.watch("warehouse_id") as string | undefined;
  const zoneId = form.watch("zone_id") as string | undefined;
  const fullCode = composeLocationCode(options, warehouseId, zoneId, localCode);

  useEffect(() => {
    form.setValue("code", localCode, { shouldValidate: true });
    form.setValue("aisle", `${rack.toUpperCase()}-${aisle}`);
    form.setValue("bay", String(bay).padStart(2, "0"));
    form.setValue("level", level);
    form.setValue("position", position);
    form.setValue("depth", depth);
    form.setValue("location_type", "rack");
    if (isDuplicate) {
      form.setError("code", { type: "manual", message: "This location already exists" });
    } else {
      form.clearErrors("code");
    }
  }, [rack, aisle, bay, level, position, depth, localCode, isDuplicate, form]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormItem>
          <FormLabel>Rack</FormLabel>
          <FormControl>
            <Input
              maxLength={1}
              value={rack}
              placeholder="A"
              onChange={(e) => setRack(e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || "A")}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">A–Z, back to front</p>
        </FormItem>
        <FormItem>
          <FormLabel>Aisle</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              value={aisle}
              onChange={(e) => setAisle(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">Floor in front of rack</p>
        </FormItem>
        <FormItem>
          <FormLabel>Bay</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={99}
              value={bay}
              onChange={(e) => setBay(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">01–13, left to right</p>
        </FormItem>
        <FormItem>
          <FormLabel>Level</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={7}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1)))}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">1 = floor, 2+ above</p>
        </FormItem>
        <FormItem>
          <FormLabel>
            Position
            {nextSuggestion > position && (
              <button
                type="button"
                className="ml-2 text-[10px] text-primary underline-offset-2 hover:underline"
                onClick={() => setPosition(nextSuggestion)}
              >
                next: P{String(nextSuggestion).padStart(2, "0")}
              </button>
            )}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={9}
              value={position}
              onChange={(e) => setPosition(Math.max(1, Math.min(9, parseInt(e.target.value, 10) || 1)))}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">Left to right within bay</p>
        </FormItem>
        <FormItem>
          <FormLabel>Depth</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={5}
              value={depth}
              onChange={(e) => setDepth(Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)))}
            />
          </FormControl>
          <p className="text-[11px] text-muted-foreground">Pallets deep, 1–5</p>
        </FormItem>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm",
          isDuplicate
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-border bg-muted/50 text-foreground",
        )}
      >
        <span className="shrink-0 text-xs text-muted-foreground">Code:</span>
        <span className="flex-1 truncate">{fullCode || localCode}</span>
        {isDuplicate && <span className="shrink-0 text-xs font-medium text-destructive">already exists</span>}
      </div>
    </div>
  );
}

export function ResourceFormDialog({
  resource,
  trigger,
}: {
  resource: ResourceDefinition;
  trigger?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { roles, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", resource.table, restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });
  const isZones = resource.table === "zones";
  const isLocations = resource.table === "locations";
  // Fields controlled by the location code builder — hidden from the generic loop
  const builderControlledFields = new Set(["code", "aisle", "bay", "level", "position", "depth", "location_type"]);

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: resource.fields.reduce<Record<string, unknown>>((accumulator, field) => {
      accumulator[field.name] = defaultFieldValue(field);
      return accumulator;
    }, {}),
  });

  // Auto-select warehouse when only one exists
  useEffect(() => {
    if (options?.warehouses?.length === 1) {
      const onlyId = (options.warehouses[0] as any).id as string;
      const current = form.getValues("warehouse_id");
      if (!current) form.setValue("warehouse_id", onlyId, { shouldDirty: false });
    }
  }, [options?.warehouses, form]);

  // Zone duplicate guard
  const watchedWarehouseId = form.watch("warehouse_id");
  const watchedCode = form.watch("code");
  const watchedName = form.watch("name");
  useEffect(() => {
    if (!isZones) return;
    const existing = (options?.zones ?? []).filter((z: any) => z.warehouse_id === watchedWarehouseId);
    const rawCode = String(watchedCode ?? "").trim().toUpperCase();
    const rawName = String(watchedName ?? "").trim().toLowerCase();
    const codeExists = rawCode.length > 0 && existing.some((z: any) => String(z.code).toUpperCase() === rawCode);
    const nameExists = rawName.length > 0 && existing.some((z: any) => String(z.name).toLowerCase() === rawName);
    if (codeExists) {
      form.setError("code", { type: "manual", message: "Zone code already exists in this warehouse" });
    } else {
      form.clearErrors("code");
    }
    if (nameExists) {
      form.setError("name", { type: "manual", message: "Zone name already exists in this warehouse" });
    } else {
      form.clearErrors("name");
    }
  }, [isZones, watchedWarehouseId, watchedCode, watchedName, options?.zones, form]);

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => upsertRecord(resource.table, normalizeResourceValues(resource, values, options)),
    onSuccess: () => {
      toast.success(`${resource.singular} saved`);
      queryClient.invalidateQueries({ queryKey: [resource.table] });
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>
          <Plus data-icon="inline-start" />
          Add {resource.singular}
        </Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create {resource.singular}</DialogTitle>
          <DialogDescription>{resource.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh] pr-4">
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(async (values) => createMutation.mutate(values))}
            >
              {resource.fields.map((field) => {
                if (isLocations && builderControlledFields.has(field.name)) return null;
                return renderField(field, form, getResourceFieldOptions(field, options));
              })}
              {isLocations && <RackLocationCodeBuilder form={form} options={options} />}
              <Button type="submit" disabled={createMutation.isPending || (isZones && (!!form.formState.errors.code || !!form.formState.errors.name)) || (isLocations && !!form.formState.errors.code)}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save {resource.singular}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceEditDialog({
  resource,
  editRecord,
  onClose,
}: {
  resource: ResourceDefinition;
  editRecord: Record<string, unknown>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { roles, profile } = useAuth();
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", resource.table, restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: resource.fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.name] = editRecord[field.name] ?? defaultFieldValue(field);
      return acc;
    }, {}),
  });

  // For locations: watch status to show disable-reason notice
  const isLocations = resource.table === "locations";
  const watchedStatus = isLocations ? (form.watch("status") as string | undefined) : undefined;
  const isBeingDisabled = watchedStatus === "disabled" || watchedStatus === "maintenance";
  const wasAlreadyDisabled = isLocations && (editRecord.status === "disabled" || editRecord.status === "maintenance");
  const originalLocationCode = isLocations ? String(editRecord.code ?? "") : "";

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const id = String(editRecord.id ?? "");
      if (!id) throw new Error(`Missing ${resource.singular} id.`);
      return updateRecord(resource.table, id, normalizeResourceValues(resource, values, options, { preserveLocationCode: isLocations }));
    },
    onSuccess: (_updated, values) => {
      toast.success(`${resource.singular} updated`);
      if (isLocations && normalizeScannerText(values.code) !== normalizeScannerText(originalLocationCode)) {
        toast.message("Location code changed", {
          description: "Reprint the location label unless this code change was intentional.",
          duration: 8000,
        });
      }
      queryClient.invalidateQueries({ queryKey: [resource.table] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  function handleSubmit(values: Record<string, unknown>) {
    // Locations: require a reason in Notes when disabling or marking maintenance
    if (isLocations && isBeingDisabled && !values.notes) {
      toast.error("Add a reason in the Notes field before marking this location unavailable.");
      return;
    }
    updateMutation.mutate(values);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit {resource.singular}
          </DialogTitle>
          <DialogDescription>{resource.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh] pr-4">
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              {resource.fields.map((field) => (
                <div key={field.name}>
                  {renderField(field, form, getResourceFieldOptions(field, options))}
                  {/* Disable-with-reason notice for locations status field */}
                  {isLocations && field.name === "status" && isBeingDisabled && !wasAlreadyDisabled && (
                    <p className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      This location will be marked as unavailable. Enter the reason in the Notes field below so operators know the cause and when it can return to service.
                    </p>
                  )}
                  {isLocations && field.name === "status" && watchedStatus === "active" && wasAlreadyDisabled && (
                    <p className="mt-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400">
                      Re-enabling this location will make it available for putaway and picking. Update the Notes field to record the clearance if needed.
                    </p>
                  )}
                </div>
              ))}
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const locationWizardSchema = z
  .object({
    warehouse_id: z.string().uuid({ message: "Select a warehouse" }),
    zone_id: z.string().uuid({ message: "Select a zone" }),
    prefix: z.string().trim().min(1, "Prefix required").max(8, "Max 8 chars"),
    start_bay: z.coerce.number().int().min(1),
    end_bay: z.coerce.number().int().min(1),
    levels: z.coerce.number().int().min(1).max(6),
    positions_per_level: z.coerce.number().int().min(1).max(3),
    depth: z.coerce.number().int().min(1).max(5),
    location_type: z.enum(["rack", "staging", "quarantine", "dispatch", "receiving", "floor", "returns"]),
    temperature_class: z.enum(["ambient", "cool", "frozen"]),
    mixed_sku_allowed: z.boolean(),
    mixed_lot_allowed: z.boolean(),
  })
  .refine((v) => v.end_bay >= v.start_bay, { path: ["end_bay"], message: "End bay must be ≥ start bay" });

export type LocationWizardValues = z.infer<typeof locationWizardSchema>;

export function ChangeOwnPasswordDialog({
  onClose,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => updateOwnPassword(password),
    onSuccess: () => {
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
      setOpen(false);
      onClose?.();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Password update failed"),
  });

  const handleSubmit = () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs">
            <KeyRound className="mr-1 h-3 w-3" />
            Change password
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Enter a new password for your account. Minimum 8 characters.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">New password</label>
            <Input
              type="password"
              value={password}
              placeholder="At least 8 characters"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Confirm password</label>
            <Input
              type="password"
              value={confirm}
              placeholder="Repeat new password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileMenu({ initials, displayName, onSignOut }: { initials: string; displayName: string; onSignOut: () => void }) {
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden truncate text-xs font-medium sm:block">{displayName}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPwOpen(true); }}>
            <KeyRound className="mr-2 h-3.5 w-3.5" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onSignOut()}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangeOwnPasswordDialog open={pwOpen} onOpenChange={setPwOpen} hideTrigger />
    </>
  );
}

export function OfflineQueueBadge({ compact = false }: { compact?: boolean }) {
  const { count, syncing } = useOfflineQueue();
  if (count === 0 && !syncing) return null;
  const label = syncing ? "Syncing…" : `${count} queued`;
  const handleClick = async () => {
    if (syncing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Still offline — reconnect to a network, then tap again.");
      return;
    }
    const result = await flushOfflineQueue();
    if (result.remaining === 0 && result.succeeded > 0) {
      toast.success(`Synced ${result.succeeded} buffered action${result.succeeded === 1 ? "" : "s"}.`);
    } else if (result.remaining > 0) {
      toast.warning(`${result.remaining} item${result.remaining === 1 ? "" : "s"} still pending — will retry on next reconnect.`);
    }
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={syncing}
      className={cn(
        "h-9 gap-1.5 border-amber-400/60 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50",
        compact && "px-2 text-[11px]",
      )}
      title="Buffered work waiting for reconnect"
    >
      {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      <span className={cn(compact && "hidden sm:inline")}>{label}</span>
      {!compact && count > 0 && !syncing ? <span className="text-xs opacity-70">tap to sync</span> : null}
    </Button>
  );
}

export function FailedTasksReminder() {
  const { items, dismiss, dismissAll } = useDeadLetterQueue();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  if (items.length === 0) return null;

  const item = items[Math.min(activeIndex, items.length - 1)];
  if (!item) return null;

  function describeItem(it: FailedWorkItem) {
    if (it.kind === "putaway") {
      const p = it.payload as { pallet: string; location: string; taskNumber?: string };
      return `Putaway${p.taskNumber ? ` #${p.taskNumber}` : ""} — pallet ${p.pallet} → ${p.location}`;
    }
    if (it.kind === "pick") {
      const p = it.payload as { palletBarcode: string; locationCode: string };
      return `Pick — pallet ${p.palletBarcode} at ${p.locationCode}`;
    }
    return it.kind;
  }

  const timestamp = new Date(item.failedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {items.length === 1 ? "Offline task needs attention" : `${items.length} offline tasks need attention`}
          </DialogTitle>
          <DialogDescription>
            {items.length > 1
              ? `One or more actions saved while offline could not be submitted when you reconnected. Review each one and confirm whether the work is done.`
              : `An action saved while offline could not be submitted when you reconnected. Confirm whether the work is done.`}
          </DialogDescription>
        </DialogHeader>

        {items.length > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Item {activeIndex + 1} of {items.length}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={activeIndex === 0} onClick={() => setActiveIndex((i) => i - 1)}>←</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={activeIndex >= items.length - 1} onClick={() => setActiveIndex((i) => i + 1)}>→</Button>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1.5">
          <p className="font-medium">{describeItem(item)}</p>
          <p className="text-xs text-muted-foreground">Failed at {timestamp} · {item.attempts} attempt{item.attempts === 1 ? "" : "s"}</p>
          <p className="text-xs text-destructive/80 break-words">{item.error}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {items.length > 1 && (
            <Button
              variant="ghost"
              className="text-muted-foreground sm:mr-auto"
              onClick={() => void dismissAll()}
            >
              Mark all resolved
            </Button>
          )}
          <Button variant="outline" onClick={() => void dismiss(item.id)}>
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessRequestsBanner() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const canSee = roles.some((r) => ["admin", "warehouse_manager", "warehouse_supervisor", "developer"].includes(r));
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.sessionStorage.getItem("dismissed-pending-requests") ?? "[]");
    } catch {
      return [];
    }
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-access-requests"],
    enabled: canSee,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .eq("approved", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; created_at: string | null }>;
    },
  });

  const undismissed = useMemo(
    () => pending.filter((p) => !dismissed.includes(p.id)),
    [pending, dismissed],
  );
  const open = canSee && undismissed.length > 0;

  function dismissAll() {
    const next = Array.from(new Set([...dismissed, ...undismissed.map((p) => p.id)]));
    setDismissed(next);
    try {
      window.sessionStorage.setItem("dismissed-pending-requests", JSON.stringify(next));
    } catch {
      /* noop */
    }
  }

  function goToUsers() {
    dismissAll();
    navigate("/settings");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismissAll(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <UserPlus className="h-5 w-5" />
            {undismissed.length} access request{undismissed.length === 1 ? "" : "s"} awaiting approval
          </DialogTitle>
          <DialogDescription>
            New users have requested access to the warehouse. Review and approve them in Users &amp; Roles.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded border border-border">
          {undismissed.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.full_name?.trim() || p.email || "Unnamed user"}</div>
                {p.email && p.full_name ? (
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={dismissAll}>Remind me later</Button>
          <Button onClick={goToUsers}>
            <Users className="mr-2 h-4 w-4" />
            Go to Users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportButton({ resource, asMenuItems = false }: { resource: ResourceDefinition; asMenuItems?: boolean }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setParsing(true);
      try {
        const p = await parseCsvForResource(resource, file);
        setPreview(p);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not parse CSV");
      } finally {
        setParsing(false);
      }
    };
    input.click();
  }

  async function handleConfirm() {
    if (!preview) return;
    setCommitting(true);
    try {
      const result = await commitImportRows(resource, preview);
      if (result.failed > 0) {
        downloadCsv(`${resource.table}-errors.csv`, result.errors);
        toast.error(`Imported ${result.inserted}, failed ${result.failed} — error report downloaded`);
      } else {
        toast.success(`Imported ${result.inserted} ${resource.title.toLowerCase()}`);
      }
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["records", resource.table] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  if (asMenuItems) {
    return (
      <>
        <DropdownMenuItem onClick={() => downloadCsvTemplate(resource)}>
          <FileDown className="mr-2 h-4 w-4" />
          Template
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleImport(); }} disabled={parsing}>
          <Upload className="mr-2 h-4 w-4" />
          {parsing ? "Parsing…" : "Import CSV"}
        </DropdownMenuItem>
        <ImportPreviewDialog
          resource={resource}
          preview={preview}
          onCancel={() => setPreview(null)}
          onConfirm={handleConfirm}
          committing={committing}
        />
      </>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => downloadCsvTemplate(resource)}>
        <FileDown data-icon="inline-start" />
        Template
      </Button>
      <Button
        variant="outline"
        onClick={handleImport}
        disabled={parsing}
      >
        <Upload data-icon="inline-start" />
        {parsing ? "Parsing…" : "Import CSV"}
      </Button>
      <ImportPreviewDialog
        resource={resource}
        preview={preview}
        onCancel={() => setPreview(null)}
        onConfirm={handleConfirm}
        committing={committing}
      />
    </>
  );
}

function ImportPreviewDialog({
  resource,
  preview,
  onCancel,
  onConfirm,
  committing,
}: {
  resource: ResourceDefinition;
  preview: ImportPreview | null;
  onCancel: () => void;
  onConfirm: () => void;
  committing: boolean;
}) {
  const open = preview !== null;
  const summary = preview?.summary ?? { total: 0, valid: 0, invalid: 0 };
  const previewCols = resource.fields.slice(0, 5).map((f) => f.name);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !committing) onCancel(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review {resource.title} import</DialogTitle>
          <DialogDescription>
            Rows are validated before anything is written. IDs and timestamps from the file are ignored — new records get fresh IDs.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">Total {summary.total}</Badge>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Valid {summary.valid}</Badge>
          <Badge variant="destructive">Errors {summary.invalid}</Badge>
        </div>
        <ScrollArea className="max-h-[55vh] rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-24">Status</TableHead>
                {previewCols.map((c) => <TableHead key={c}>{c}</TableHead>)}
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview?.rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                  <TableCell>
                    {r.normalized
                      ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">OK</Badge>
                      : <Badge variant="destructive">Error</Badge>}
                  </TableCell>
                  {previewCols.map((c) => (
                    <TableCell key={c} className="text-xs">
                      {String((r.normalized?.[c] ?? r.raw[c]) ?? "")}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs">
                    {[...r.errors, ...r.warnings].join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={committing}>Cancel</Button>
          <Button onClick={onConfirm} disabled={committing || summary.valid === 0}>
            {committing ? <Loader2 className="animate-spin" /> : <Upload data-icon="inline-start" />}
            Import {summary.valid} row{summary.valid === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LocationWizardDialog({ trigger }: { trigger?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options", "location-wizard"], queryFn: () => fetchOptions() });
  const [open, setOpen] = useState(false);
  const form = useForm<LocationWizardValues>({
    resolver: zodResolver(locationWizardSchema),
    defaultValues: {
      warehouse_id: "",
      zone_id: "",
      prefix: "A",
      start_bay: 1,
      end_bay: 10,
      levels: 3,
      positions_per_level: 1,
      depth: 1,
      location_type: "rack",
      temperature_class: "ambient",
      mixed_sku_allowed: false,
      mixed_lot_allowed: false,
    },
  });

  const selectedWarehouseId = form.watch("warehouse_id");

  // Reset zone when warehouse changes so user can’t submit a mismatched pair
  useEffect(() => {
    form.setValue("zone_id", "");
  }, [selectedWarehouseId, form]);

  const filteredZones = (options?.zones ?? []).filter(
    (zone: any) => zone.warehouse_id === selectedWarehouseId,
  );

  const locationCount =
    Math.max((form.watch("end_bay") ?? 1) - (form.watch("start_bay") ?? 1) + 1, 0) *
    Math.max(form.watch("levels") ?? 1, 1) *
    Math.max(form.watch("positions_per_level") ?? 1, 1);

  const mutation = useMutation({
    mutationFn: async (values: LocationWizardValues) => {
      const expanded = expandLocationRange({
        prefix: values.prefix,
        startBay: values.start_bay,
        endBay: values.end_bay,
        positionsPerLevel: values.positions_per_level,
        levels: values.levels,
        depth: values.depth,
      });
      const locations = expanded.map((row) => ({
        warehouse_id: values.warehouse_id,
        zone_id: values.zone_id,
        code: composeLocationCode(options, values.warehouse_id, values.zone_id, row.localCode),
        aisle: row.aisle,
        bay: row.bay,
        level: row.level,
        position: row.position,
        depth: row.depth,
        max_pallets: row.maxPallets,
        location_type: values.location_type,
        temperature_class: values.temperature_class,
        mixed_sku_allowed: values.mixed_sku_allowed,
        mixed_lot_allowed: values.mixed_lot_allowed,
        status: "active",
      }));

      for (const location of locations) {
        await upsertRecord("locations", location);
      }

      return locations.length;
    },
    onSuccess: async (count) => {
      toast.success(`${count} locations created`);
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Location wizard failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">
          <MapPinned data-icon="inline-start" />
          Location wizard
        </Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create locations by range</DialogTitle>
          <DialogDescription>Each bay-level splits into 1–3 side-by-side positions. Total = bays × levels × positions. Depth = pallet capacity per slot.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh] pr-4">
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <SelectField
                form={form}
                name="warehouse_id"
                label="Warehouse"
                hint="All locations are scoped to one warehouse."
                options={(options?.warehouses ?? []).map((warehouse: any) => ({ label: warehouse.name, value: warehouse.id }))}
              />
              <SelectField
                form={form}
                name="zone_id"
                label="Zone"
                hint={selectedWarehouseId ? "Zones for the selected warehouse." : "Select a warehouse first."}
                options={filteredZones.map((zone: any) => ({ label: `${zone.code} – ${zone.name}`, value: zone.id }))}
              />
              <TextField form={form} name="prefix" label="Aisle prefix" hint="Letter or short code, e.g. A or BR." />
              <TextField form={form} name="start_bay" label="Start bay" type="number" hint="First bay number in the range (≥ 1)." />
              <TextField form={form} name="end_bay" label="End bay" type="number" hint="Must be ≥ start bay." />
              <TextField form={form} name="levels" label="Levels" type="number" hint="Vertical levels per bay (1–6)." />
              <TextField form={form} name="positions_per_level" label="Positions per level" type="number" hint="Side-by-side slots in each bay-level (1–3)." />
              <TextField form={form} name="depth" label="Depth (capacity)" type="number" hint="Pallets deep per slot = capacity (1–5)." />
              <SelectField form={form} name="location_type" label="Type" hint="Used by directed putaway rules." options={[
                { label: "Rack", value: "rack" },
                { label: "Staging", value: "staging" },
                { label: "Quarantine", value: "quarantine" },
                { label: "Dispatch", value: "dispatch" },
                { label: "Receiving", value: "receiving" },
                { label: "Floor", value: "floor" },
                { label: "Returns", value: "returns" },
              ]} />
              <SelectField form={form} name="temperature_class" label="Temperature" hint="Must match the zone’s temperature class." options={[
                { label: "Ambient", value: "ambient" },
                { label: "Cool", value: "cool" },
                { label: "Frozen", value: "frozen" },
              ]} />
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 sm:col-span-2">
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">Mixed SKU allowed</span>
                  <span className="text-xs text-muted-foreground">Permit different products in the same location.</span>
                </div>
                <FormField control={form.control} name="mixed_sku_allowed" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 sm:col-span-2">
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">Mixed lot allowed</span>
                  <span className="text-xs text-muted-foreground">Permit different lot numbers in the same location.</span>
                </div>
                <FormField control={form.control} name="mixed_lot_allowed" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
              {locationCount > 0 ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  This will generate <strong>{locationCount}</strong> location{locationCount !== 1 ? "s" : ""}.
                </p>
              ) : null}
              <Button className="sm:col-span-2" disabled={mutation.isPending || !selectedWarehouseId || !form.watch("zone_id")} type="submit">
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Create location range
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function BarcodePrintDialog({ labelType, code, title }: { labelType: "warehouse" | "zone" | "location"; code: string; title: string }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const zpl = [
    "^XA",
    "^CI28",
    "^PW609",
    "^LL406",
    "^FO28,24^GB553,358,3^FS",
    `^FO40,44^A0N,34,34^FD${title.replace(/[\^~]/g, " ").slice(0, 34)}^FS`,
    `^FO40,92^A0N,24,24^FD${labelType.toUpperCase()}^FS`,
    `^FO64,130^BQN,2,7^FDLA,${code.replace(/[\^~]/g, " ").slice(0, 64)}^FS`,
    `^FO288,176^A0N,30,30^FD${code.replace(/[\^~]/g, " ").slice(0, 28)}^FS`,
    "^FO288,220^A0N,18,18^FD3PL Management^FS",
    "^XZ",
  ].join("\n");

  function handlePrint() {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=420,height=480");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Label — ${escapeHtml(title)}</title><style>
      @page { margin: 12mm; }
      body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
      .label { text-align: center; border: 1px solid #ccc; padding: 16px; border-radius: 8px; display: inline-block; }
      .label-type { font-size: 11px; text-transform: uppercase; color: #888; margin-top: 8px; letter-spacing: 0.08em; }
      .label-code { font-size: 18px; font-weight: 700; margin-top: 4px; letter-spacing: 0.04em; }
      .label-sub { font-size: 11px; color: #666; margin-top: 2px; }
    </style></head><body><div class="label">${printRef.current.innerHTML}
      <p class="label-type">${escapeHtml(labelType)}</p>
      <p class="label-code">${escapeHtml(title)}</p>
      <p class="label-sub">${escapeHtml(code)}</p>
    </div><script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    printWindow.document.close();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <QrCode data-icon="inline-start" />
          Print
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Scan label with human-readable code.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div ref={printRef} className="mx-auto rounded-md border border-border bg-white p-4">
            <QRCodeSVG value={code} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">{labelType}</p>
            <p className="break-all text-xl font-semibold">{code}</p>
          </div>
          <Button className="w-full" onClick={handlePrint}>
            <Printer data-icon="inline-start" />
            Print label
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline text-left"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} advanced (ZPL payload)
          </button>
          {showAdvanced && (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">ZPL payload</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(zpl);
                    toast.success("ZPL copied");
                  }}
                >
                  Copy
                </Button>
              </div>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{zpl}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function defaultFieldValue(field: FieldDefinition) {
  if (field.type === "boolean") return field.name === "active" || field.name === "lot_tracked";
  if (field.type === "number") return "";
  if (field.name === "temperature_class" || field.name === "temperature_requirement") return "ambient";
  if (field.name === "rotation_method") return "fifo";
  if (field.name === "status") return "active";
  return "";
}

export function composeLocationCode(
  options: Awaited<ReturnType<typeof fetchOptions>> | undefined,
  warehouseId: unknown,
  zoneId: unknown,
  localCode: unknown,
) {
  const rawCode = String(localCode ?? "").trim();
  if (!rawCode) return rawCode;
  const warehouse = (options?.warehouses ?? []).find((row: any) => row.id === warehouseId);
  const zone = (options?.zones ?? []).find((row: any) => row.id === zoneId);
  const warehouseCode = String(warehouse?.code ?? "").trim();
  const zoneCode = String(zone?.code ?? "").trim();
  if (!warehouseCode || !zoneCode) return rawCode;
  const prefix = `${warehouseCode}-${zoneCode}-`;
  return rawCode.toUpperCase().startsWith(prefix.toUpperCase()) ? rawCode : `${prefix}${rawCode}`;
}

export function normalizeResourceValues(
  resource: ResourceDefinition,
  values: Record<string, unknown>,
  options?: Awaited<ReturnType<typeof fetchOptions>>,
  behavior?: { preserveLocationCode?: boolean },
) {
  const payload = resource.fields.reduce<Record<string, unknown>>((current, field) => {
    const value = values[field.name];
    if (value === "") {
      current[field.name] = field.required ? value : null;
      return current;
    }
    current[field.name] = field.type === "number" && value != null ? Number(value) : value;
    return current;
  }, {});
  if (resource.table === "locations" && !behavior?.preserveLocationCode) {
    payload.code = composeLocationCode(options, payload.warehouse_id, payload.zone_id, payload.code);
  }
  return payload;
}

export function getResourceFieldOptions(field: FieldDefinition, options?: Awaited<ReturnType<typeof fetchOptions>>) {
  if (field.options) return field.options;
  if (field.name === "warehouse_id") return (options?.warehouses ?? []).map((warehouse: any) => ({ label: `${warehouse.code} - ${warehouse.name}`, value: warehouse.id }));
  if (field.name === "zone_id") return (options?.zones ?? []).map((zone: any) => ({ label: `${zone.code} - ${zone.name}`, value: zone.id }));
  if (field.name === "client_owner_id") return (options?.clients ?? []).map((client: any) => ({ label: client.name, value: client.id }));
  if (field.name === "product_id") return (options?.products ?? []).map((product: any) => ({ label: `${product.sku} - ${product.name}`, value: product.id }));
  return [];
}

export function shouldRestrictToDefaultWarehouse(roles: string[]) {
  return roles.some((role) => ["inventory_clerk", "warehouse_operator", "dispatch_driver"].includes(role)) &&
    !roles.some((role) => ["admin", "warehouse_manager"].includes(role));
}

export function WarehouseFloorMode({
  snapshot,
  sensors,
  tiles,
  hiddenTiles,
  definitionsById,
  editMode,
  renderSummaryTile,
  onDragEnd,
  onResize,
  onHide,
  onRestore,
}: {
  snapshot: EnterpriseDashboardSnapshot;
  sensors: ReturnType<typeof useSensors>;
  tiles: DashboardTileConfig[];
  hiddenTiles: DashboardTileConfig[];
  definitionsById: Map<string, DashboardTileDefinition<ModuleKey>>;
  editMode: boolean;
  renderSummaryTile: (tile: DashboardTileConfig, onResize: (id: string) => void, onHide: (id: string) => void) => ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const queuesByLabel = new Map(snapshot.floorQueues.map((queue) => [queue.label, queue]));

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tiles.map((tile) => tile.id)} strategy={rectSortingStrategy}>
          <div className="grid min-h-0 gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
            {tiles.map((tile) => {
              const summaryTile = renderSummaryTile(tile, onResize, onHide);
              if (summaryTile) return summaryTile;

              if (tile.id === "Warehouse Intelligence") {
                return (
                  <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                    <WarehouseIntelligenceCard snapshot={snapshot} />
                  </SortableDashboardTile>
                );
              }

              const queue = queuesByLabel.get(tile.id);
              if (!queue) return null;

              return (
                <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                  <Card className={cn("flex h-full min-w-0 flex-col border-l-4", toneBorder(queue.tone))}>
                    <CardHeader className="p-4 pb-2 pr-20">
                      <CardTitle className="flex items-center justify-between gap-4">
                        <span>{queue.label}</span>
                        <Link to={queue.route} className="shrink-0 rounded-sm text-3xl transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                          {formatNumber(queue.count)}
                        </Link>
                      </CardTitle>
                      <CardDescription>{queue.action}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-0">
                      {queue.tasks.length > 0 ? (
                        <ul className="mb-2 grid gap-1">
                          {queue.tasks.map((task) => (
                            <li key={task.id}>
                              <Link
                                to={task.route}
                                className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors"
                              >
                                <span className="font-medium truncate">{task.label}</span>
                                <Badge variant="outline" className="ml-2 shrink-0 capitalize text-xs">{task.sublabel}</Badge>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Button className="mt-auto h-10 w-full" asChild>
                        <Link to={queue.route}>Open workflow</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </SortableDashboardTile>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <HiddenDashboardTilesPanel editMode={editMode} tiles={hiddenTiles} definitionsById={definitionsById} onRestore={onRestore} />
    </div>
  );
}

export function normalizeScannerText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function resolveContainerScanValue(value: unknown) {
  const result = extractIso6346ContainerNumber(value);
  if (result.valid) return { value: result.normalized, valid: true, message: result.message, candidate: result.candidate };
  return {
    value: result.candidate ?? normalizeContainerNumber(value),
    valid: false,
    candidate: result.candidate,
    message: result.message,
  };
}

export function isBaySelectorCode(value: string) {
  const normalized = normalizeScannerText(value);
  if (normalized.startsWith("BAY:")) return true;
  const parts = normalized.split("-").filter(Boolean);
  return parts.length >= 4 && !parts.some((part) => /^L\d+$/i.test(part));
}

export function shouldUppercaseField(name: string) {
  const lower = name.toLowerCase();
  return (
    lower === "code" ||
    lower === "sku" ||
    lower.includes("barcode") ||
    lower.includes("container") ||
    lower.includes("po_number") ||
    lower.includes("order_number") ||
    lower.includes("reference_number") ||
    lower.includes("location")
  );
}

export function WarehouseIntelligenceCard({ snapshot }: { snapshot: EnterpriseDashboardSnapshot }) {
  return (
    <Card className="h-full min-w-0">
      <CardHeader className="pb-2 pr-20">
        <CardTitle className="flex items-center gap-2 text-base"><RadioTower className="h-4 w-4" /> Warehouse Intelligence</CardTitle>
        <CardDescription className="text-xs">Live shift signals — DPMO, 5S, Kanban, exceptions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {snapshot.leanMetrics.map((metric) => (
          <Link key={metric.label} to={metric.route} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 transition hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{metric.label}</p>
              <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">{metric.value}</span>
              <Badge className="text-[10px] px-1.5 py-0" variant={metric.status === "off_target" ? "destructive" : metric.status === "watch" ? "secondary" : "default"}>
                {metric.status.replace("_", " ")}
              </Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DockHandoffBoard({
  loads,
  recommendations,
  sensors,
  tiles,
  hiddenTiles,
  definitionsById,
  editMode,
  renderSummaryTile,
  onDragEnd,
  onResize,
  onHide,
  onRestore,
}: {
  loads: DockHandoffLoad[];
  recommendations: WarehouseBrainRecommendation[];
  sensors: ReturnType<typeof useSensors>;
  tiles: DashboardTileConfig[];
  hiddenTiles: DashboardTileConfig[];
  definitionsById: Map<string, DashboardTileDefinition<ModuleKey>>;
  editMode: boolean;
  renderSummaryTile: (tile: DashboardTileConfig, onResize: (id: string) => void, onHide: (id: string) => void) => ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tiles.map((tile) => tile.id)} strategy={rectSortingStrategy}>
          <div className="grid min-w-0 gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))]">
            {tiles.map((tile) => {
              const summaryTile = renderSummaryTile(tile, onResize, onHide);
              if (summaryTile) return summaryTile;

              if (tile.id === "warehouse-brain") {
                return (
                  <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                    <WarehouseBrainPanel recommendations={recommendations} />
                  </SortableDashboardTile>
                );
              }

              const status = tile.id as DockHandoffLoad["status"];
              const laneLoads = loads.filter((load) => load.status === status);

              return (
                <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                  <Card className={cn("h-full min-h-72 min-w-0", status === "blocked" ? "border-destructive/50" : "")}>
                    <CardHeader className="pr-20">
                      <CardTitle className="flex items-center justify-between gap-2 capitalize">
                        <span>{status}</span>
                        <Link to="/pick-lists" className="rounded-sm text-2xl transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                          {formatNumber(laneLoads.length)}
                        </Link>
                      </CardTitle>
                      <CardDescription>Dock handoff lane</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {laneLoads.map((load) => (
                        <div key={load.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{load.route}</span>
                            <Badge>{load.door}</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm">{load.customer}</p>
                          <p className="text-xs text-muted-foreground">{load.driver} · {load.pallets} pallet{load.pallets === 1 ? "" : "s"} · {load.temperatureClass}</p>
                          {load.blocker ? <p className="mt-2 text-xs text-destructive">{load.blocker}</p> : null}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </SortableDashboardTile>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <HiddenDashboardTilesPanel editMode={editMode} tiles={hiddenTiles} definitionsById={definitionsById} onRestore={onRestore} />
    </div>
  );
}

export function OfficeMonitoringMode({
  snapshot,
  sensors,
  tiles,
  hiddenTiles,
  definitionsById,
  editMode,
  renderSummaryTile,
  onDragEnd,
  onResize,
  onHide,
  onRestore,
}: {
  snapshot: EnterpriseDashboardSnapshot;
  sensors: ReturnType<typeof useSensors>;
  tiles: DashboardTileConfig[];
  hiddenTiles: DashboardTileConfig[];
  definitionsById: Map<string, DashboardTileDefinition<ModuleKey>>;
  editMode: boolean;
  renderSummaryTile: (tile: DashboardTileConfig, onResize: (id: string) => void, onHide: (id: string) => void) => ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onResize: (id: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const widgetsByLabel = new Map(snapshot.officeWidgets.map((widget) => [widget.label, widget]));

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tiles.map((tile) => tile.id)} strategy={rectSortingStrategy}>
          <div className="grid min-w-0 gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
            {tiles.map((tile) => {
              const summaryTile = renderSummaryTile(tile, onResize, onHide);
              if (summaryTile) return summaryTile;

              if (tile.id === "setup-checklist") {
                return (
                  <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                    <Card className="h-full">
                      <CardHeader className="pr-20">
                        <CardTitle className="flex items-center gap-2"><ClipboardCheck /> Setup Checklist</CardTitle>
                        <CardDescription>Go-live prompts for admin and management setup activities.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        {snapshot.setupChecklist.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.owner}</p>
                            </div>
                            <Badge variant={item.complete ? "default" : "secondary"}>{item.complete ? "Ready" : "Open"}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </SortableDashboardTile>
                );
              }

              if (tile.id === "warehouse-brain") {
                return (
                  <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                    <WarehouseBrainPanel recommendations={snapshot.recommendations} />
                  </SortableDashboardTile>
                );
              }

              const widget = widgetsByLabel.get(tile.id);
              if (!widget) return null;

              return (
                <SortableDashboardTile key={tile.id} tile={tile} editMode={editMode} onResize={onResize} onHide={onHide}>
                  <Card className={cn("h-full min-w-0 border-l-4", toneBorder(widget.tone))}>
                    <CardHeader className="pr-20">
                      <CardDescription>{widget.label}</CardDescription>
                      <CardTitle className="text-4xl">
                        <Link to={widget.route} className="rounded-sm transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                          {widget.value}
                        </Link>
                      </CardTitle>
                      <CardDescription>{widget.detail}</CardDescription>
                    </CardHeader>
                  </Card>
                </SortableDashboardTile>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <HiddenDashboardTilesPanel editMode={editMode} tiles={hiddenTiles} definitionsById={definitionsById} onRestore={onRestore} />
    </div>
  );
}

export function HiddenDashboardTilesPanel({
  editMode,
  tiles,
  definitionsById,
  onRestore,
}: {
  editMode: boolean;
  tiles: DashboardTileConfig[];
  definitionsById: Map<string, DashboardTileDefinition<ModuleKey>>;
  onRestore: (id: string) => void;
}) {
  if (!editMode || tiles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/25 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">Hidden tiles</span>
      {tiles.map((tile) => {
        const label = definitionsById.get(tile.id)?.label ?? tile.id;
        return (
          <Button key={tile.id} type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onRestore(tile.id)}>
            <Eye className="h-3.5 w-3.5" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

export function WarehouseBrainPanel({ recommendations }: { recommendations: WarehouseBrainRecommendation[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pr-20">
        <CardTitle className="flex items-center gap-2"><Bot /> Warehouse Brain</CardTitle>
        <CardDescription>Explainable recommendations using live WMS context and role-aware next actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {recommendations.map((recommendation) => (
          <Link key={recommendation.id} to={recommendation.route} className={cn("block rounded-lg border border-border p-3 transition hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", recommendation.severity === "critical" ? "bg-destructive/10" : recommendation.severity === "warning" ? "bg-warning/10" : "bg-secondary/30")}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{recommendation.title}</p>
              <Badge variant={recommendation.severity === "critical" ? "destructive" : "secondary"}>{recommendation.severity}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{recommendation.reason}</p>
            <p className="mt-2 text-sm">{recommendation.nextAction}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function toneBorder(tone: "success" | "warning" | "critical" | "info") {
  if (tone === "critical") return "border-l-destructive";
  if (tone === "warning") return "border-l-warning";
  if (tone === "info") return "border-l-info";
  return "border-l-success";
}

export type ReceivingShipmentLineState = {
  id: string;
  product_id: string;
  total_quantity: number;
  quantity_per_pallet: number;
  pallet_count: number;
  expiry_date: string;
  lot_number: string;
  batch_number: string;
  packaging_profile_id: string;
  remainder_action: "waive" | "manual" | "special" | "";
};

export type ReceivingShipmentFormState = {
  receipt_type: "po" | "transfer" | "other";
  warehouse_id: string;
  client_id: string;
  container_number: string;
  po_number: string;
  reference_number: string;
  lines: ReceivingShipmentLineState[];
};

export function newShipmentLine(productId = ""): ReceivingShipmentLineState {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    product_id: productId,
    total_quantity: 1,
    quantity_per_pallet: 1,
    pallet_count: 1,
    expiry_date: "",
    lot_number: "",
    batch_number: "",
    packaging_profile_id: "",
    remainder_action: "",
  };
}

export function distributeShipmentLine(line: ReceivingShipmentLineState, changed: "total" | "perPallet" | "count"): ReceivingShipmentLineState {
  const total = Math.max(0, Number(line.total_quantity) || 0);
  let perPallet = Math.max(1, Number(line.quantity_per_pallet) || 1);
  let palletCount = Math.max(1, Math.floor(Number(line.pallet_count) || 1));

  if (changed !== "count") {
    palletCount = Math.max(1, Math.floor(total / perPallet) || 1);
  }

  const remainder = total - (perPallet * palletCount);
  return {
    ...line,
    total_quantity: total,
    quantity_per_pallet: perPallet,
    pallet_count: palletCount,
    remainder_action: remainder > 0 ? line.remainder_action : "",
  };
}

export function parseDraftMeta(notes: string | null | undefined): Record<string, any> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function remainderForLine(line: ReceivingShipmentLineState) {
  return Math.max(0, Number(line.total_quantity || 0) - (Number(line.quantity_per_pallet || 0) * Number(line.pallet_count || 0)));
}

export function ShipmentFieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium leading-none text-foreground">{children}</label>;
}

export function useIsMobileEntry() {
  const [isMobileEntry, setIsMobileEntry] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse), (max-width: 767px)");
    const update = () => setIsMobileEntry(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobileEntry;
}

export function productRequiresExpiry(product?: { expiry_tracked?: boolean } | null) {
  return Boolean(product?.expiry_tracked);
}

export function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function draftToReceivingValues(draft: DraftReceipt): z.infer<typeof receivingSchema> {
  const meta = parseDraftMeta(draft.notes);
  return {
    receipt_type: "other",
    reference_number: draft.reference_number ?? draft.po_number ?? "",
    container_number: draft.container_number ?? meta.container_number ?? "",
    po_number: draft.po_number ?? meta.po_number ?? "",
    warehouse_id: draft.warehouse_id,
    client_id: draft.client_id ?? "",
    product_id: (meta.product_id as string) ?? draft.product_id ?? "",
    packaging_profile_id: (meta.packaging_profile_id as string) ?? "",
    quantity: Number(meta.quantity ?? draft.quantity ?? 1),
    lot_number: (meta.lot_number as string) ?? "",
    batch_number: (meta.batch_number as string) ?? "",
    manufacture_date: (meta.manufacture_date as string) ?? "",
    expiry_date: (meta.expiry_date as string) ?? draft.expiry_date ?? "",
    loading_date: (meta.loading_date as string) ?? "",
    rotation_date: (meta.rotation_date as string) ?? "",
    override_length: (meta.override_length as number) ?? undefined,
    override_width: (meta.override_width as number) ?? undefined,
    override_height: (meta.override_height as number) ?? undefined,
    override_weight: (meta.override_weight as number) ?? undefined,
    reuse_pallet_barcode: (meta.reuse_pallet_barcode as string) ?? "",
    pallet_barcode: draft.draft_pallet_barcode ?? meta.draft_pallet_barcode ?? "",
    draft_group_id: draft.draft_group_id ?? meta.draft_group_id ?? undefined,
    draft_sequence: draft.draft_sequence ?? meta.draft_sequence ?? undefined,
    draft_count: draft.draft_count ?? meta.draft_count ?? undefined,
  };
}

export function labelHasValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}

export function printDraftLabels(
  drafts: DraftReceipt[],
  products: Array<{ id: string; sku: string; name: string; temperature_requirement?: string | null }>,
  clients: Array<{ id: string; name: string }>,
  warehouses: Array<{ id: string; name: string; code?: string | null }>,
  packagingProfiles: Array<{ id: string; name?: string | null; unit_name?: string | null; unit_of_measure?: string | null }>,
  onPrinted?: () => Promise<void> | void,
) {
  if (drafts.length === 0) {
    toast.error("Select at least one draft label to print.");
    return false;
  }
  const pages = drafts.map((draft) => {
    const meta = parseDraftMeta(draft.notes);
    const product = products.find((p) => p.id === (draft.product_id ?? meta.product_id));
    const client = clients.find((item) => item.id === draft.client_id);
    const warehouse = warehouses.find((item) => item.id === draft.warehouse_id);
    const packaging = packagingProfiles.find((item) => item.id === meta.packaging_profile_id);
    const barcode = draft.draft_pallet_barcode ?? meta.draft_pallet_barcode ?? draft.receipt_number;
    const qr = renderToStaticMarkup(<QRCodeSVG value={barcode} size={220} bgColor="#ffffff" fgColor="#000000" level="H" />);
    const draftPosition = draft.draft_sequence && draft.draft_count ? `${draft.draft_sequence}/${draft.draft_count}` : "";
    const fields = [
      ["Pallet", barcode],
      ["SKU", product?.sku ?? ""],
      ["Product", product?.name ?? ""],
      ["Qty", draft.quantity ?? meta.quantity ?? ""],
      ["Expiry", draft.expiry_date ?? meta.expiry_date ?? ""],
      ["Lot", draft.lot_number ?? meta.lot_number ?? ""],
      ["Batch", draft.batch_number ?? meta.batch_number ?? ""],
      ["Container", draft.container_number ?? meta.container_number ?? ""],
      ["PO", draft.po_number ?? meta.po_number ?? ""],
      ["Client", client?.name ?? ""],
      ["Warehouse", warehouse ? `${warehouse.code ? `${warehouse.code} - ` : ""}${warehouse.name}` : ""],
      ["Receipt", draft.reference_number ?? draft.receipt_number ?? ""],
      ["Packaging", packaging?.name ?? packaging?.unit_name ?? packaging?.unit_of_measure ?? ""],
      ["Draft", draftPosition],
    ].filter(([label, value]) => label === "Pallet" || labelHasValue(value));
    return `<section class="sheet">
      <div class="header"><div><div class="title">Pallet Draft</div><div class="code">${barcode}</div></div>${draftPosition ? `<div class="badge">${draftPosition}</div>` : ""}</div>
      <div class="grid">${fields.map(([label, value]) => `<div class="field${label === "Expiry" ? " expiry" : ""}"><span>${label}</span><strong>${String(value)}</strong></div>`).join("")}</div>
      <div class="qr">${qr}<div>${barcode}</div></div>
    </section>`;
  }).join("");
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast.error("Print window was blocked. Allow popups, then try again.");
    return false;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>Pallet draft labels</title><style>
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
    .sheet { page-break-after: always; width: 8.5in; min-height: 11in; padding: .45in; display: flex; flex-direction: column; gap: .22in; border: .08in solid #1f2937; }
    .header { display: flex; justify-content: space-between; gap: .25in; align-items: flex-start; }
    .title { font-size: 16pt; font-weight: 800; text-transform: uppercase; color: #1f2937; }
    .code { font-size: 38pt; font-weight: 900; line-height: 1; }
    .badge { font-size: 16pt; font-weight: 800; border: 2px solid #1f2937; border-radius: 999px; padding: .08in .18in; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .14in; }
    .field { border: 1px solid #94a3b8; border-radius: .06in; padding: .1in; min-height: .62in; }
    .field.expiry { border-color: #f59e0b; background: #fffbeb; }
    .field span { display: block; color: #475569; text-transform: uppercase; font-size: 8.5pt; font-weight: 800; letter-spacing: .05em; }
    .field.expiry span { color: #92400e; }
    .field strong { display: block; margin-top: .05in; font-size: 15pt; overflow-wrap: anywhere; }
    .qr { margin-top: auto; border: 2px solid #1f2937; border-radius: .08in; padding: .22in; display: flex; flex-direction: column; align-items: center; gap: .08in; font-family: "Courier New", monospace; font-size: 16pt; font-weight: 800; }
    .qr svg { width: 2.45in; height: 2.45in; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>${pages}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  win.document.close();
  void Promise.resolve(onPrinted?.());
  return true;
}

export function TextField({
  form,
  name,
  label,
  type = "text",
  hint,
}: {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  type?: string;
  hint?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} type={type} value={(field.value as string | number | readonly string[] | undefined) ?? ""} />
          </FormControl>
          {hint ? <FormDescription>{hint}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField({
  form,
  name,
  label,
  options,
  hint,
}: {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  hint?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={(field.value as string | undefined) ?? undefined}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hint ? <FormDescription>{hint}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function BinCapacityBar({ locationCode }: { locationCode: string; taskId?: string }) {
  const { data } = useQuery({
    queryKey: ["bin-occupancy", locationCode],
    queryFn: () => getBinOccupancy(locationCode),
    enabled: locationCode.length >= 2,
    staleTime: 0,
  });

  if (!data || !locationCode) return null;

  const { maxPallets, occupiedPallets, status } = data;
  const pct = maxPallets > 0 ? Math.min(100, Math.round((occupiedPallets / maxPallets) * 100)) : 0;
  const isFull = maxPallets > 0 && occupiedPallets >= maxPallets;
  const isNearFull = pct >= 80 && !isFull;
  const isBlocked = status !== "active";

  if (isBlocked) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Location unavailable (status: {status})
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Bin capacity</span>
        <span className={cn(isFull ? "text-red-600 font-semibold" : isNearFull ? "text-amber-600" : "text-green-700")}>
          {occupiedPallets} / {maxPallets} pallets
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          "h-2",
          isFull ? "[&>div]:bg-red-500" : isNearFull ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500",
        )}
      />
      {isFull && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Location FULL — scan a different location
        </p>
      )}
    </div>
  );
}
export function BayOccupancyGrid({
  locationCode,
  selectedLocationCode,
  onSelect,
}: {
  locationCode: string;
  selectedLocationCode?: string;
  onSelect: (locationCode: string) => void;
}) {
  const isBayScan = isBaySelectorCode(locationCode);
  const selectedLocation = selectedLocationCode?.trim().toUpperCase() ?? "";
  const { data, error, isLoading } = useQuery({
    queryKey: ["bay-occupancy", locationCode],
    queryFn: () => getBayOccupancy(locationCode),
    enabled: locationCode.length >= 2,
    staleTime: 0,
  });

  if (isLoading && !data) {
    return (
      <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
        Loading bay locations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Bay locations could not load. Scan again or refresh the page.
      </div>
    );
  }

  if (!data || data.cells.length === 0) {
    return isBayScan ? (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        No active rack locations found for this bay barcode.
      </div>
    ) : null;
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Bay {data.aisle ?? "?"}-{data.bay ?? "?"}</span>
        <span>{data.cells.filter((cell) => cell.status === "active" && !cell.isFull).length} open</span>
      </div>
      <div className="grid gap-2">
        {buildBayOccupancyGrid(data.cells).map((row) => (
          <div
            key={`level-${row[0]?.level ?? "unknown"}`}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((slot) => {
              const cell = slot.cell;
              if (!cell) {
                return (
                  <div
                    key={`empty-${slot.level}-${slot.position}`}
                    aria-hidden="true"
                    className="min-h-16 rounded-md border border-dashed border-border/60 bg-background/40"
                  />
                );
              }

              const available = cell.status === "active" && !cell.isFull;
              const selected = selectedLocation.length > 0 && cell.locationCode.toUpperCase() === selectedLocation;
              return (
                <button
                  key={cell.locationId}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelect(cell.locationCode)}
                  className={cn(
                    "min-h-16 rounded-md border px-2 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    selected
                      ? "animate-pulse border-cyan-400 bg-cyan-50 text-cyan-950 ring-2 ring-cyan-400 dark:bg-cyan-950/50 dark:text-cyan-50"
                      : available
                      ? "border-green-500 bg-green-50 text-green-950 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-100"
                      : "cursor-not-allowed border-muted bg-muted text-muted-foreground opacity-70",
                  )}
                >
                  <span className="block font-mono font-semibold">{cell.locationCode}</span>
                  <span className="mt-1 block">{cell.occupiedPallets}/{cell.maxPallets} pallets</span>
                  <span className="block">{selected && available ? "Selected" : available ? "Available" : cell.status !== "active" ? cell.status : "Full"}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function incrementOccupancy(occupiedPallets: number, maxPallets: number) {
  return maxPallets > 0 ? Math.min(maxPallets, occupiedPallets + 1) : occupiedPallets + 1;
}

export function markPutawayOccupancyCached(queryClient: ReturnType<typeof useQueryClient>, locationCode: string) {
  const confirmedLocation = locationCode.trim().toUpperCase();
  if (!confirmedLocation) return;

  queryClient.setQueriesData(
    { queryKey: ["bin-occupancy"] },
    (current: Awaited<ReturnType<typeof getBinOccupancy>> | null | undefined) => {
      if (!current || current.locationCode.toUpperCase() !== confirmedLocation) return current;
      const occupiedPallets = incrementOccupancy(current.occupiedPallets, current.maxPallets);
      return {
        ...current,
        occupiedPallets,
      };
    },
  );

  queryClient.setQueriesData(
    { queryKey: ["bay-occupancy"] },
    (current: Awaited<ReturnType<typeof getBayOccupancy>> | null | undefined) => {
      if (!current) return current;
      let changed = false;
      const cells = current.cells.map((cell: BayOccupancyCell) => {
        if (cell.locationCode.toUpperCase() !== confirmedLocation) return cell;
        changed = true;
        const occupiedPallets = incrementOccupancy(cell.occupiedPallets, cell.maxPallets);
        return {
          ...cell,
          occupiedPallets,
          isFull: cell.maxPallets > 0 && occupiedPallets >= cell.maxPallets,
        };
      });
      return changed ? { ...current, cells } : current;
    },
  );
}

