import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, ArrowLeftRight, BarChart3, Bot, Boxes, Building2, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, CloudOff, Download, Eye, EyeOff, FileDown, Forklift, GripVertical, HelpCircle, Home, Info, KeyRound, LayoutDashboard, Loader2, Lock, LockOpen, LogOut, Mail, Maximize2, MapPinned, Menu, Minimize2, Package, PackageX, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Printer, QrCode, RadioTower, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Star, Tags, Trash2, Truck, Upload, UserPlus, Users } from "lucide-react";
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
} from "@/lib/offline-queue";
import {
  NAVIGATION,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type AdminInviteUserInput,
  type AppRoute,
  type FieldDefinition,
  type ResourceDefinition,
  type DraftReceipt,
  adminInviteUser,
  adminUpdateUserPin,
  adminUpdateUserPassword,
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

function tileConfigsFromDefinitions(definitions: DashboardTileDefinition<ModuleKey>[]): DashboardTileConfig[] {
  return definitions.map((tile) => ({ id: tile.id, size: tile.size }));
}

// ---------------------------------------------------------------------------
// Barcode scanner helpers
// ---------------------------------------------------------------------------

/** Play a short, pleasant confirmation beep via Web Audio API (works on iOS/Android too). */
function playBarcodeBeep() {
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
function flashInput(el: HTMLElement | null, colour: "orange" | "blue") {
  if (!el) return;
  const cls = colour === "orange"
    ? ["ring-2", "ring-orange-400", "ring-offset-1"]
    : ["ring-2", "ring-blue-400", "ring-offset-1"];
  el.classList.add(...cls);
  setTimeout(() => el.classList.remove(...cls), 700);
}

function loadFallbackTileLayout(key: string, defaults: DashboardTileConfig[]) {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    return sanitizeDashboardLayout(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

function fallbackLayoutKey(key: string, profileId?: string | null, deviceId?: string | null) {
  return [key, profileId ?? "anonymous", deviceId ?? "device"].join(".");
}

function loadFallbackVisibility(key: string): DashboardVisibilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as DashboardVisibilityMap : {};
  } catch {
    return {};
  }
}

function fallbackVisibilityKey(profileId: string | null | undefined, mode: DashboardMode) {
  return `wms.dashboard.visibility.v1.${profileId ?? "anonymous"}.${mode}`;
}

function saveFallbackJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function SortableDashboardTile({
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

function SortableMetricCard({
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

function SortableSummaryCard({
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

function PalletDialCard({
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

function TableFrame({
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

function renderField(
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

function ResourceFormDialog({
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
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: resource.fields.reduce<Record<string, unknown>>((accumulator, field) => {
      accumulator[field.name] = defaultFieldValue(field);
      return accumulator;
    }, {}),
  });

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
              {resource.fields.map((field) => renderField(field, form, getResourceFieldOptions(field, options)))}
              <Button type="submit" disabled={createMutation.isPending}>
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

function ResourceEditDialog({
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

function ChangeOwnPasswordDialog({
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

function OfflineQueueBadge({ compact = false }: { compact?: boolean }) {
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { profile, roles, signOut, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { isEnabled } = useFeatureFlags();
  const { online } = useNetworkStatus();
  useEffect(() => {
    installOfflineAutoReplay();
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const networkStatusSeenRef = useRef(false);
  const items = NAVIGATION
    .filter(
      (item) =>
        item.roles.some((role) => roles.includes(role)) &&
        (!item.moduleKey || isEnabled(item.moduleKey as ModuleKey)),
    )
    // Help is always pinned as the last sidebar entry, regardless of module order.
    .sort((a, b) => (a.to === "/help" ? 1 : 0) - (b.to === "/help" ? 1 : 0));
  const canSwitchWarehouses = roles.some((role) => ["admin", "warehouse_manager"].includes(role));
  const { data: headerOptions } = useQuery({
    queryKey: ["header-warehouse-options", canSwitchWarehouses],
    queryFn: () => fetchOptions(false),
    enabled: canSwitchWarehouses,
  });
  const headerWarehouses = useMemo(() => {
    const warehouses = headerOptions?.warehouses ?? [];
    if (roles.includes("admin")) return warehouses;

    const assignedWarehouseIds = new Set(
      (headerOptions?.userRoles ?? [])
        .filter((userRole: any) => userRole.user_id === profile?.id && userRole.warehouse_id)
        .map((userRole: any) => userRole.warehouse_id),
    );

    return assignedWarehouseIds.size > 0
      ? warehouses.filter((warehouse: any) => assignedWarehouseIds.has(warehouse.id))
      : warehouses;
  }, [headerOptions, profile?.id, roles]);
  const warehouseSwitchMutation = useMutation({
    mutationFn: (warehouseId: string) => updateProfileDefaultWarehouse(profile?.id ?? "", warehouseId),
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Warehouse switched");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Warehouse switch failed"),
  });
  const displayName = profile?.full_name?.trim() || user?.email || "Warehouse User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "WU";

  useEffect(() => {
    if (!networkStatusSeenRef.current) {
      networkStatusSeenRef.current = true;
      return;
    }
    if (online) {
      toast.success("Connection restored. Refreshing live data.");
      void flushOfflineQueue({ silent: true }).finally(() => {
        void queryClient.invalidateQueries();
      });
      return;
    }
    toast.message("Connection lost. Keep finishing scan work already open; it will sync when signal returns.", {
      duration: 6000,
    });
  }, [online, queryClient]);

  const prefetchRouteData = useCallback((route: AppRoute) => {
    const warehouseId = profile?.default_warehouse_id;
    if (route === "/dashboard") {
      void queryClient.prefetchQuery({
        queryKey: ["dashboard-metrics", warehouseId],
        queryFn: () => getDashboardMetrics(warehouseId),
      });
      return;
    }
    if (route === "/receiving") {
      void queryClient.prefetchQuery({
        queryKey: ["options", "receiving", shouldRestrictToDefaultWarehouse(roles), warehouseId],
        queryFn: () => fetchOptions(false, { restrictToWarehouse: shouldRestrictToDefaultWarehouse(roles), warehouseId }),
      });
      return;
    }
    if (route === "/putaway-tasks") {
      const canSeeAll = roles.some((r) => ["developer", "admin", "warehouse_manager", "warehouse_supervisor"].includes(r));
      const prefetchUserId = canSeeAll ? undefined : user?.id;
      void queryClient.prefetchQuery({
        queryKey: ["putaway-tasks", prefetchUserId],
        queryFn: () => getPutawayTasks(prefetchUserId),
      });
      return;
    }
    if (route === "/inventory-search") {
      void queryClient.prefetchQuery({
        queryKey: ["inventory-search", "", "all", ""],
        queryFn: () => searchInventory({ status: "all" }),
      });
      return;
    }
    if (route === "/pick-lists") {
      void queryClient.prefetchQuery({
        queryKey: ["pick-lists"],
        queryFn: listPickLists,
      });
    }
  }, [profile?.default_warehouse_id, queryClient, roles, user?.id]);

  const navigation = (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-sidebar",
        sidebarCollapsed ? "items-center px-1.5 py-3 bg-teal-500" : "px-3 py-3"
      )}
    >
      {/* Logo area */}
      <div className={cn(
        "mb-4 flex items-center gap-3 px-2",
        sidebarCollapsed && "justify-center px-0"
      )}>
        <img src="/logo.png" alt="Warehouse Wizard" className="h-8 w-8 shrink-0 rounded-lg object-fill" />
        {!sidebarCollapsed && (
          <span className="truncate text-sm font-semibold text-foreground">Warehouse Wizard</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = navIcons[item.to] ?? LayoutDashboard;
            const isActive = pathname === item.to;
            const showSeparator = !sidebarCollapsed && item.to === "/warehouses";
            const link = (
              <NavLink
                key={item.to}
                className={({ isActive: navActive }) =>
                  cn(
                    "group flex min-h-[3.375rem] items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-all duration-100 active:scale-[0.96] active:transition-transform",
                    sidebarCollapsed && "h-[3.375rem] w-11 justify-center p-0",
                    navActive || isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
                to={item.to}
                aria-label={item.label}
                onMouseEnter={() => prefetchRouteData(item.to)}
                onFocus={() => prefetchRouteData(item.to)}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className={cn("shrink-0", sidebarCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                {sidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            const node = sidebarCollapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : link;

            if (showSeparator) {
              return (
                <Fragment key={item.to}>
                  <div className="my-1 border-t border-sidebar-border" />
                  {node}
                </Fragment>
              );
            }
            return node;
          })}
        </div>
      </nav>

      {/* Collapse/expand toggle at bottom — landscape desktop only */}
      <div className={cn("mt-2 hidden border-t border-sidebar-border pt-2 lg:landscape:flex", sidebarCollapsed ? "justify-center" : "justify-end")}>
        <Button
          className="h-8 w-8 shrink-0"
          size="icon"
          variant="ghost"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div
        className={cn(
          // Mobile + portrait-desktop: top header + content. Landscape-desktop: sidebar + content.
          "grid h-full w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden",
          "lg:landscape:grid-rows-1 lg:landscape:grid-cols-[minmax(11rem,max-content)_minmax(0,1fr)]",
          sidebarCollapsed && "lg:landscape:grid-cols-[64px_minmax(0,1fr)]",
        )}
      >
        {/* Mobile header */}
        <header className="col-span-full flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:landscape:hidden">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Warehouse Wizard" className="h-7 w-7 shrink-0 rounded-md object-fill" />
            <span className="text-sm font-semibold">{appTitle}</span>
            <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">v{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/80 px-1.5 py-1">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">{displayName}</span>
            </div>
            <OfflineQueueBadge compact />
            <HelpSidebar pathname={pathname} />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button className="h-9 w-9" size="icon" variant="outline">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="flex max-h-svh w-screen max-w-full flex-col p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col border-b border-border bg-card/80 px-4 py-3 gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">v{__APP_VERSION__}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ChangeOwnPasswordDialog onClose={() => setMobileMenuOpen(false)} />
                    <Button className="h-8 flex-1 text-xs justify-start" variant="outline" size="sm" onClick={() => { setMobileMenuOpen(false); void signOut(); }}>
                      <LogOut className="mr-2 h-3 w-3" />
                      Sign out
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">{navigation}</div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <aside className="hidden h-full overflow-hidden border-r border-border lg:landscape:block">{navigation}</aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Desktop top bar — landscape only */}
          <div className="hidden items-center justify-between gap-3 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur lg:landscape:flex">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                <span className="truncate">{items.find((item) => item.to === pathname)?.label ?? "Warehouse Wizard Enterprise WMS"}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">v{__APP_VERSION__}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canSwitchWarehouses ? (
                <Select
                  value={profile?.default_warehouse_id ?? ""}
                  onValueChange={(value) => warehouseSwitchMutation.mutate(value)}
                  disabled={warehouseSwitchMutation.isPending}
                >
                  <SelectTrigger className="h-9 w-[13rem]">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {headerWarehouses.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code ? `${warehouse.code} - ${warehouse.name}` : warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <HelpSidebar pathname={pathname} />
              <OfflineQueueBadge />
              <ProfileMenu initials={initials} displayName={displayName} onSignOut={() => void signOut()} />
            </div>
          </div>
          <div
            className={cn(
              "flex-1 min-h-0 min-w-0 px-4 py-5 sm:px-5 lg:px-6",
              pathname === "/inventory-search" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <AccessRequestsBanner />
    </div>
  );
}

function AccessRequestsBanner() {
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

export function ResourcePage({
  resource,
}: {
  resource: ResourceDefinition;
}) {
  const { roles: viewerRoles } = useAuth();
  const canHardDelete = viewerRoles.some((r) => ["admin", "developer"].includes(r));
  const cascadeSupported = ["warehouses", "zones", "locations", "products", "clients"].includes(resource.table);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<Record<string, unknown> | null>(null);
  const [deleteChallenge, setDeleteChallenge] = useState("");
  const [deleteBlockers, setDeleteBlockers] = useState<Array<{ table: string; count: number }> | null>(null);
  const cascadeMutation = useMutation({
    mutationFn: async (id: string) => deleteResourceCascade(resource.table, id),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`${resource.singular} permanently deleted`);
        setDeleteRecord(null);
        setDeleteBlockers(null);
        setDeleteChallenge("");
        queryClient.invalidateQueries({ queryKey: [resource.table] });
        void invalidateWarehouseData(queryClient);
      } else {
        setDeleteBlockers(result.blocked_by);
        toast.error("Cannot delete — child records still reference this item.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });
  const useGearActions = ["warehouses", "zones", "locations", "products"].includes(resource.table);
  const { data = [], isLoading } = useQuery({
    queryKey: [resource.table, includeHidden],
    queryFn: () => listRecords(resource.table, resource.select ?? "*", resource.orderBy, {
      includeHidden,
      archiveField: resource.archiveField,
    }),
  });
  const { data: locationRowsForLabels = [] } = useQuery({
    queryKey: ["locations", "label-source"],
    enabled: resource.table === "zones",
    queryFn: () => listRecords("locations", "*", { column: "code" }),
  });
  const queryClient = useQueryClient();
  const hasTrailingLabelColumn = ["warehouses", "zones"].includes(resource.table);
  const extraColumnCount = (resource.supportsHide ? 1 : 0) + (hasTrailingLabelColumn ? 1 : 0) + 1 + (resource.table === "products" ? 1 : 0);
  const isProducts = resource.table === "products";
  const { data: productQtyRows = [] } = useQuery({
    queryKey: ["product-qty-totals"],
    enabled: isProducts,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("inventory_balances")
        .select("product_id, available_quantity, quantity")
        .limit(10000);
      if (error) throw error;
      return data as Array<{ product_id: string; available_quantity: number | null; quantity: number | null }>;
    },
  });
  const productQtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of productQtyRows) {
      const qty = Number(r.available_quantity ?? r.quantity ?? 0);
      if (!r.product_id) continue;
      m.set(r.product_id, (m.get(r.product_id) ?? 0) + qty);
    }
    return m;
  }, [productQtyRows]);

  const hasProductRef = resource.fields.some((f) => f.name === "product_id");
  const { data: productOptions = [] } = useQuery({
    queryKey: ["products", "options-for-table"],
    queryFn: () => listRecords("products", "id, sku, name"),
    enabled: hasProductRef,
  });
  const productMap = useMemo(() => {
    const map = new Map<string, { sku: string; name: string }>();
    (productOptions as Array<{ id: string; sku: string; name: string }>).forEach((p) => {
      map.set(p.id, { sku: p.sku, name: p.name });
    });
    return map;
  }, [productOptions]);

  const hasClientRef = resource.fields.some((f) => f.name === "client_id" || f.name === "client_owner_id");
  const { data: clientOptions = [] } = useQuery({
    queryKey: ["clients", "options-for-table"],
    queryFn: () => listRecords("clients", "id, name"),
    enabled: hasClientRef,
  });
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    (clientOptions as Array<{ id: string; name: string }>).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clientOptions]);

  const hasWarehouseRef = resource.fields.some((f) => f.name === "warehouse_id");
  const { data: warehouseOptions = [] } = useQuery({
    queryKey: ["warehouses", "options-for-table"],
    queryFn: () => listRecords("warehouses", "id, code, name"),
    enabled: hasWarehouseRef,
  });
  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    (warehouseOptions as Array<{ id: string; code: string; name: string }>).forEach((w) =>
      map.set(w.id, w.name ?? w.code),
    );
    return map;
  }, [warehouseOptions]);
  const warehouseInfoMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    (warehouseOptions as Array<{ id: string; code: string; name: string }>).forEach((w) =>
      map.set(w.id, { code: w.code, name: w.name }),
    );
    return map;
  }, [warehouseOptions]);

  const hasZoneRef = resource.fields.some((f) => f.name === "zone_id");
  const { data: zoneOptions = [] } = useQuery({
    queryKey: ["zones", "options-for-table"],
    queryFn: () => listRecords("zones", "id, code, name"),
    enabled: hasZoneRef,
  });
  const zoneMap = useMemo(() => {
    const map = new Map<string, string>();
    (zoneOptions as Array<{ id: string; code: string; name: string }>).forEach((z) =>
      map.set(z.id, z.name ?? z.code),
    );
    return map;
  }, [zoneOptions]);
  const zoneInfoMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    (zoneOptions as Array<{ id: string; code: string; name: string }>).forEach((z) =>
      map.set(z.id, { code: z.code, name: z.name }),
    );
    return map;
  }, [zoneOptions]);

  const filteredData = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      resource.fields.some((field) => {
        const val = (row as Record<string, unknown>)[field.name];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [data, filterQuery, resource.fields]);
  const tableFields = useMemo(() => {
    if (resource.table !== "locations") return resource.fields;
    const fieldMap = new Map(resource.fields.map((field) => [field.name, field]));
    const orderedNames = [
      "code",
      "warehouse_id",
      "zone_id",
      "aisle",
      "bay",
      "level",
      "depth",
      "location_type",
      "temperature_class",
      "max_pallets",
      "pick_sequence",
      "putaway_sequence",
      "mixed_sku_allowed",
      "mixed_lot_allowed",
      "max_height",
      "status",
      "notes",
    ];
    return [
      ...orderedNames.map((name) => fieldMap.get(name)).filter(Boolean),
      ...resource.fields.filter((field) => !orderedNames.includes(field.name)),
    ] as typeof resource.fields;
  }, [resource.fields, resource.table]);
  const bayLabelItems = useMemo(() => {
    if (resource.table !== "locations") return [] as LabelSheetItem[];
    const byCode = new Map<string, LabelSheetItem>();
    for (const row of filteredData as Array<Record<string, unknown>>) {
      const warehouse = warehouseInfoMap.get(String(row.warehouse_id ?? ""));
      const zone = zoneInfoMap.get(String(row.zone_id ?? ""));
      const aisle = normalizeScannerText(row.aisle);
      const bay = normalizeScannerText(row.bay);
      if (!warehouse?.code || !zone?.code || !aisle || !bay) continue;
      const code = `${normalizeScannerText(warehouse.code)}-${normalizeScannerText(zone.code)}-${aisle}-${bay}`;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          title: `Aisle ${aisle} · Bay ${bay}`,
          subtitle: `${zone.name ?? zone.code} · ${warehouse.name ?? warehouse.code}`,
        });
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredData, resource.table, warehouseInfoMap, zoneInfoMap]);
  const zoneAisleLabelItems = useMemo(() => {
    if (resource.table !== "zones") return [] as LabelSheetItem[];
    const visibleZoneIds = new Set((filteredData as Array<Record<string, unknown>>).map((row) => String(row.id ?? "")));
    const zoneById = new Map((filteredData as Array<Record<string, unknown>>).map((row) => [String(row.id ?? ""), row]));
    const byCode = new Map<string, LabelSheetItem>();
    for (const row of locationRowsForLabels as Array<Record<string, unknown>>) {
      const zoneId = String(row.zone_id ?? "");
      if (!visibleZoneIds.has(zoneId)) continue;
      const zone = zoneById.get(zoneId);
      const warehouse = warehouseInfoMap.get(String(row.warehouse_id ?? zone?.warehouse_id ?? ""));
      const zoneCode = normalizeScannerText(zone?.code);
      const zoneName = String(zone?.name ?? zoneCode);
      const aisle = normalizeScannerText(row.aisle);
      if (!warehouse?.code || !zoneCode || !aisle) continue;
      const code = `${normalizeScannerText(warehouse.code)}-${zoneCode}-${aisle}`;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          title: zoneName,
          subtitle: `${warehouse.name ?? warehouse.code} · Aisle ${aisle}`,
          aisle,
          temperatureClass: String(zone?.temperature_class ?? "ambient"),
        });
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredData, locationRowsForLabels, resource.table, warehouseInfoMap]);

  function handleRowPointerUp(row: unknown) {
    if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
    const id = String((row as { id?: string }).id ?? JSON.stringify(row));
    const now = Date.now();
    if (lastTapRef.current?.id === id && now - lastTapRef.current.time < 450) {
      setEditRecord(row as Record<string, unknown>);
      lastTapRef.current = null;
      return;
    }
    lastTapRef.current = { id, time: now };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{resource.title}</h2>
          <p className="text-sm text-muted-foreground">{resource.description} Double-click any row to edit. Double-tap on touch screens.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {useGearActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" aria-label={`${resource.title} actions`}>
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {resource.exportable ? (
                  <DropdownMenuItem onClick={() => downloadCsv(`${resource.table}.csv`, data as Array<Record<string, unknown>>)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                ) : null}
                {resource.supportsHide ? (
                  <DropdownMenuItem onClick={() => setIncludeHidden((current) => !current)}>
                    {includeHidden ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {includeHidden ? "Hide archived" : "Show archived"}
                  </DropdownMenuItem>
                ) : null}
                {resource.importable ? (
                  <>
                    <DropdownMenuSeparator />
                    <ImportButton resource={resource} asMenuItems />
                  </>
                ) : null}
                {resource.table === "locations" ? (
                  <LocationWizardDialog
                    trigger={
                      <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                        <MapPinned className="mr-2 h-4 w-4" />
                        Location wizard
                      </DropdownMenuItem>
                    }
                  />
                ) : null}
                {["locations", "zones"].includes(resource.table) ? (
                  <LabelSheetPrintDialog
                    resourceLabel={resource.singular}
                    kind={resource.table === "zones" ? "zone" : "location"}
                    items={resource.table === "zones"
                      ? zoneAisleLabelItems
                      : (filteredData as Array<Record<string, unknown>>).map((row): LabelSheetItem => {
                        const warehouse = warehouseInfoMap.get(String((row as any).warehouse_id ?? ""));
                        const zone = zoneInfoMap.get(String((row as any).zone_id ?? ""));
                        return {
                          code: String((row as any).code ?? (row as any).id ?? ""),
                          title: (row as any).name ? String((row as any).name) : null,
                          aisle: String((row as any).aisle ?? ""),
                          bay: String((row as any).bay ?? ""),
                          level: (row as any).level as number | string | null,
                          locationType: String((row as any).location_type ?? ""),
                          temperatureClass: String((row as any).temperature_class ?? "ambient"),
                          warehouseName: warehouse?.name ?? warehouse?.code ?? null,
                          zoneName: zone?.name ?? zone?.code ?? null,
                        };
                      })}
                    trigger={
                      <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                        <Printer className="mr-2 h-4 w-4" />
                        {resource.table === "locations" ? "Print location labels sheet" : "Print zone labels sheet"}
                      </DropdownMenuItem>
                    }
                  />
                ) : null}
                {resource.table === "locations" ? (
                  <BayLocationCodesPrintDialog
                    items={bayLabelItems}
                    trigger={
                      <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Print bay location codes
                      </DropdownMenuItem>
                    }
                  />
                ) : null}
                <ResourceFormDialog
                  resource={resource}
                  trigger={
                    <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {resource.singular}
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {resource.exportable ? (
                <Button variant="outline" onClick={() => downloadCsv(`${resource.table}.csv`, data as Array<Record<string, unknown>>)}>
                  <Download data-icon="inline-start" />
                  Export CSV
                </Button>
              ) : null}
              {resource.supportsHide ? (
                <Button variant="outline" onClick={() => setIncludeHidden((current) => !current)}>
                  {includeHidden ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                  {includeHidden ? "Hide archived" : "Show archived"}
                </Button>
              ) : null}
              {resource.importable ? <ImportButton resource={resource} /> : null}
              {resource.table === "locations" ? <LocationWizardDialog /> : null}
              <ResourceFormDialog resource={resource} />
            </>
          )}
        </div>
      </div>

      {/* Search bar — client-side filter across all text fields */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="h-9 pl-9 pr-20 bg-muted"
          placeholder={`Search ${resource.title.toLowerCase()}…`}
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        {filterQuery ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
            {filteredData.length} / {data.length}
          </span>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
            {isLoading ? "" : `${data.length} rows`}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  {tableFields.map((field) => (
                    <Fragment key={field.name}>
                      {resource.table === "locations" && field.name === "max_pallets" ? (
                        <TableHead className="w-28">Label</TableHead>
                      ) : null}
                      <TableHead>{field.label}</TableHead>
                      {isProducts && field.name === "name" ? (
                        <TableHead className="w-20 text-right">Qty</TableHead>
                      ) : null}
                    </Fragment>
                  ))}
                  {hasTrailingLabelColumn ? <TableHead className="w-28">Label</TableHead> : null}
                  {resource.supportsHide ? <TableHead className="w-32">Visibility</TableHead> : null}
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={tableFields.length + extraColumnCount + (resource.table === "locations" ? 1 : 0)}>
                      Loading {resource.title.toLowerCase()}...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={tableFields.length + extraColumnCount + (resource.table === "locations" ? 1 : 0)}>
                      {filterQuery ? `No ${resource.title.toLowerCase()} matched "${filterQuery}".` : `No ${resource.title.toLowerCase()} found.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row) => (
                    <TableRow
                      key={(row as { id?: string }).id ?? JSON.stringify(row)}
                      className="even:bg-muted/30 cursor-pointer"
                      onDoubleClick={() => setEditRecord(row as Record<string, unknown>)}
                      onPointerUp={() => handleRowPointerUp(row)}
                    >
                      {tableFields.map((field) => {
                        const rawValue = (row as Record<string, unknown>)[field.name];
                        let displayValue: React.ReactNode;
                        if (rawValue == null || rawValue === "") {
                          displayValue = <span className="text-muted-foreground">—</span>;
                        } else if (field.type === "boolean") {
                          displayValue = <Badge variant={rawValue ? "default" : "secondary"}>{rawValue ? "Yes" : "No"}</Badge>;
                        } else if (field.type === "date") {
                          displayValue = formatDate(String(rawValue));
                        } else if (field.name === "status" && resource.table === "locations") {
                          const sv = String(rawValue);
                          const variant =
                            sv === "active" ? "default"
                            : sv === "maintenance" ? "outline"
                            : "destructive";
                          const label =
                            sv === "active" ? "Active"
                            : sv === "maintenance" ? "Maintenance"
                            : sv === "blocked" ? "Blocked"
                            : sv === "disabled" ? "Disabled"
                            : sv;
                          displayValue = <Badge variant={variant} className={sv === "maintenance" ? "border-amber-400 text-amber-600" : undefined}>{label}</Badge>;
                        } else if (field.type === "select" && field.options) {
                          displayValue = field.options.find((o) => o.value === String(rawValue))?.label ?? String(rawValue);
                        } else if (field.name === "product_id") {
                          const p = productMap.get(String(rawValue));
                          displayValue = p ? `${p.sku} - ${p.name}` : String(rawValue);
                        } else if (field.name === "client_id" || field.name === "client_owner_id") {
                          displayValue = clientMap.get(String(rawValue)) ?? String(rawValue);
                        } else if (field.name === "warehouse_id") {
                          displayValue = warehouseMap.get(String(rawValue)) ?? String(rawValue);
                        } else if (field.name === "zone_id") {
                          displayValue = zoneMap.get(String(rawValue)) ?? String(rawValue);
                        } else if (field.type === "textarea") {
                          const text = String(rawValue);
                          displayValue = text.length > 60 ? <span title={text}>{text.slice(0, 60)}…</span> : text;
                        } else {
                          displayValue = String(rawValue);
                        }
                        const cell = <TableCell key={field.name}>{displayValue}</TableCell>;
                        if (resource.table === "locations" && field.name === "max_pallets") {
                          return (
                            <Fragment key={field.name}>
                              <TableCell className="w-28">
                                <LocationLabelPage
                                  code={String((row as Record<string, unknown>).code ?? "")}
                                  aisle={(row as Record<string, unknown>).aisle as string | null}
                                  bay={(row as Record<string, unknown>).bay as string | null}
                                  level={(row as Record<string, unknown>).level as number | null}
                                  locationType={(row as Record<string, unknown>).location_type as string | null}
                                  temperatureClass={String((row as Record<string, unknown>).temperature_class ?? "ambient")}
                                  warehouseCode={warehouseInfoMap.get(String((row as Record<string, unknown>).warehouse_id))?.code}
                                  zoneCode={zoneInfoMap.get(String((row as Record<string, unknown>).zone_id))?.code}
                                  warehouseName={warehouseInfoMap.get(String((row as Record<string, unknown>).warehouse_id))?.name}
                                  zoneName={zoneInfoMap.get(String((row as Record<string, unknown>).zone_id))?.name}
                                />
                              </TableCell>
                              {cell}
                            </Fragment>
                          );
                        }
                        if (isProducts && field.name === "name") {
                          const qty = productQtyMap.get(String((row as Record<string, unknown>).id ?? "")) ?? 0;
                          return (
                            <Fragment key={field.name}>
                              {cell}
                              <TableCell className="w-20 whitespace-nowrap text-right font-mono text-xs font-semibold">
                                {formatNumber(qty)}
                              </TableCell>
                            </Fragment>
                          );
                        }
                        return cell;
                      })}
                      {hasTrailingLabelColumn ? (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <>
                                <BarcodePrintDialog
                                  labelType={resource.table === "warehouses" ? "warehouse" : "zone"}
                                  code={String((row as Record<string, unknown>).code ?? "")}
                                  title={String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).code ?? resource.singular)}
                                />
                                {resource.table === "zones" && (
                                  <ZoneLabelPage
                                    code={String((row as Record<string, unknown>).code ?? "")}
                                    name={String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).code ?? "")}
                                    temperatureClass={String((row as Record<string, unknown>).temperature_class ?? "ambient")}
                                    isStaging={Boolean((row as Record<string, unknown>).is_staging)}
                                    isDispatch={Boolean((row as Record<string, unknown>).is_dispatch)}
                                    isQuarantine={Boolean((row as Record<string, unknown>).is_quarantine)}
                                  />
                                )}
                              </>
                          </div>
                        </TableCell>
                      ) : null}
                      {resource.supportsHide ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const record = row as Record<string, unknown> & { id?: string };
                                const id = record.id;
                                if (!id || !resource.archiveField) return;
                                assertOnline();
                                const hidden = resource.archiveField === "active" ? record.active !== false : record.is_hidden === true;
                                await setResourceVisibility(resource.table, id, resource.archiveField, !hidden, !hidden ? "Hidden from UI" : undefined);
                                toast.success(hidden ? `${resource.singular} restored` : `${resource.singular} hidden`);
                                queryClient.invalidateQueries({ queryKey: [resource.table] });
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Visibility update failed");
                              }
                            }}
                          >
                            {((resource.archiveField === "active" ? (row as Record<string, unknown>).active !== false : (row as Record<string, unknown>).is_hidden === true))
                              ? "Restore"
                              : "Hide"}
                          </Button>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); setEditRecord(row as Record<string, unknown>); }}
                          title={`Edit ${resource.singular}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {cascadeSupported && canHardDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-1 h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteBlockers(null); setDeleteChallenge(""); setDeleteRecord(row as Record<string, unknown>); }}
                            title={`Delete ${resource.singular} permanently`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableFrame>
        </CardContent>
      </Card>

      {editRecord ? (
        <ResourceEditDialog resource={resource} editRecord={editRecord} onClose={() => setEditRecord(null)} />
      ) : null}
      <Dialog
        open={!!deleteRecord}
        onOpenChange={(o) => { if (!o && !cascadeMutation.isPending) { setDeleteRecord(null); setDeleteBlockers(null); setDeleteChallenge(""); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete {resource.singular} permanently</DialogTitle>
            <DialogDescription>
              {(() => {
                const r = (deleteRecord as Record<string, unknown> | null) ?? {};
                const label = String((r as { name?: string }).name ?? (r as { code?: string }).code ?? (r as { sku?: string }).sku ?? "this record");
                return <>This will permanently remove <span className="font-medium">{label}</span>. This action cannot be undone.</>;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Permanent delete is only allowed when no other records reference this {resource.singular.toLowerCase()}.
              If child records exist they must be removed or reassigned first.
            </p>
            {deleteBlockers && deleteBlockers.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="font-medium text-destructive">Cannot delete — still referenced by:</p>
                <ul className="mt-1 list-disc pl-5 text-destructive/90">
                  {deleteBlockers.map((b) => (
                    <li key={b.table}>{b.count} × {b.table.replace(/_/g, " ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-1.5 pt-1">
              <label htmlFor="delete-challenge" className="text-sm font-medium">
                Type <span className="font-mono font-semibold">DELETE</span> to confirm
              </label>
              <Input
                id="delete-challenge"
                value={deleteChallenge}
                onChange={(e) => setDeleteChallenge(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteRecord(null); setDeleteBlockers(null); setDeleteChallenge(""); }} disabled={cascadeMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={cascadeMutation.isPending || deleteChallenge.trim() !== "DELETE" || !deleteRecord}
              onClick={() => {
                const id = (deleteRecord as { id?: string } | null)?.id;
                if (id) cascadeMutation.mutate(id);
              }}
            >
              {cascadeMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportButton({ resource, asMenuItems = false }: { resource: ResourceDefinition; asMenuItems?: boolean }) {
  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const errors = await importCsvToResource(resource, file);
      if (errors.length > 0) {
        downloadCsv(`${resource.table}-errors.csv`, errors);
        toast.error(`Imported with ${errors.length} row errors`);
      } else {
        toast.success(`${resource.title} imported`);
      }
    };
    input.click();
  }

  if (asMenuItems) {
    return (
      <>
        <DropdownMenuItem onClick={() => downloadCsvTemplate(resource)}>
          <FileDown className="mr-2 h-4 w-4" />
          Template
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleImport(); }}>
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </DropdownMenuItem>
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
      >
        <Upload data-icon="inline-start" />
        Import CSV
      </Button>
    </>
  );
}

function LocationWizardDialog({ trigger }: { trigger?: React.ReactNode }) {
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

function BarcodePrintDialog({ labelType, code, title }: { labelType: "warehouse" | "zone" | "location"; code: string; title: string }) {
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

function defaultFieldValue(field: FieldDefinition) {
  if (field.type === "boolean") return field.name === "active" || field.name === "lot_tracked";
  if (field.type === "number") return "";
  if (field.name === "temperature_class" || field.name === "temperature_requirement") return "ambient";
  if (field.name === "rotation_method") return "fifo";
  if (field.name === "status") return "active";
  return "";
}

function composeLocationCode(
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

function normalizeResourceValues(
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

function getResourceFieldOptions(field: FieldDefinition, options?: Awaited<ReturnType<typeof fetchOptions>>) {
  if (field.options) return field.options;
  if (field.name === "warehouse_id") return (options?.warehouses ?? []).map((warehouse: any) => ({ label: `${warehouse.code} - ${warehouse.name}`, value: warehouse.id }));
  if (field.name === "zone_id") return (options?.zones ?? []).map((zone: any) => ({ label: `${zone.code} - ${zone.name}`, value: zone.id }));
  if (field.name === "client_owner_id") return (options?.clients ?? []).map((client: any) => ({ label: client.name, value: client.id }));
  if (field.name === "product_id") return (options?.products ?? []).map((product: any) => ({ label: `${product.sku} - ${product.name}`, value: product.id }));
  return [];
}

function shouldRestrictToDefaultWarehouse(roles: string[]) {
  return roles.some((role) => ["inventory_clerk", "warehouse_operator", "dispatch_driver"].includes(role)) &&
    !roles.some((role) => ["admin", "warehouse_manager"].includes(role));
}

export function DashboardPage() {
  const { profile } = useAuth();
  const { flags, isEnabled } = useFeatureFlags();
  const [mode, setMode] = useState<DashboardMode>("floor");
  const [editMode, setEditMode] = useState(false);
  const deviceId = useMemo(() => (typeof window === "undefined" ? "server-render-device" : getOrCreateDeviceId()), []);
  const floorDefinitions = useMemo(() => filterDashboardTileDefinitions(DEFAULT_FLOOR_LAYOUT, isEnabled), [isEnabled]);
  const dockDefinitions = useMemo(() => filterDashboardTileDefinitions(DEFAULT_DOCK_LAYOUT, isEnabled), [isEnabled]);
  const officeDefinitions = useMemo(() => filterDashboardTileDefinitions(DEFAULT_OFFICE_LAYOUT, isEnabled), [isEnabled]);
  const floorDefaults = useMemo(() => tileConfigsFromDefinitions(floorDefinitions), [floorDefinitions]);
  const dockDefaults = useMemo(() => tileConfigsFromDefinitions(dockDefinitions), [dockDefinitions]);
  const officeDefaults = useMemo(() => tileConfigsFromDefinitions(officeDefinitions), [officeDefinitions]);
  const floorLayoutKey = fallbackLayoutKey(DASHBOARD_FLOOR_LAYOUT_KEY, profile?.id, deviceId);
  const dockLayoutKey = fallbackLayoutKey(DASHBOARD_DOCK_LAYOUT_KEY, profile?.id, deviceId);
  const officeLayoutKey = fallbackLayoutKey(DASHBOARD_OFFICE_LAYOUT_KEY, profile?.id, deviceId);
  const [floorTiles, setFloorTiles] = useState<DashboardTileConfig[]>(() => loadFallbackTileLayout(floorLayoutKey, floorDefaults));
  const [dockTiles, setDockTiles] = useState<DashboardTileConfig[]>(() => loadFallbackTileLayout(dockLayoutKey, dockDefaults));
  const [officeTiles, setOfficeTiles] = useState<DashboardTileConfig[]>(() => loadFallbackTileLayout(officeLayoutKey, officeDefaults));
  const [floorVisibility, setFloorVisibility] = useState<DashboardVisibilityMap>({});
  const [dockVisibility, setDockVisibility] = useState<DashboardVisibilityMap>({});
  const [officeVisibility, setOfficeVisibility] = useState<DashboardVisibilityMap>({});
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitToScreen, setFitToScreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === dashboardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (dashboardRef.current) {
        await dashboardRef.current.requestFullscreen();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fullscreen unavailable");
    }
  }, []);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics", profile?.default_warehouse_id, flags],
    queryFn: () => getDashboardMetrics(profile?.default_warehouse_id, flags),
    refetchInterval: 15_000,
  });
  const { data: reports } = useQuery({ queryKey: ["reports", "enterprise-dashboard"], queryFn: getReportData });
  const snapshot = useMemo(() => buildEnterpriseDashboard(metrics, reports), [metrics, reports]);
  const summaryCardsById = useMemo(() => {
    const returnedMetricKeys = metrics?.dashboardMetricKeys ? new Set(metrics.dashboardMetricKeys) : null;
    const cards = (filterDashboardTileDefinitions(DEFAULT_DASHBOARD_CARDS, isEnabled) as DashboardCardConfig[])
      .filter((card) => !returnedMetricKeys || returnedMetricKeys.has(card.metricKey));
    return new Map(cards.map((card) => [card.id, card]));
  }, [isEnabled, metrics?.dashboardMetricKeys]);
  const floorDefinitionById = useMemo(() => new Map(floorDefinitions.map((tile) => [tile.id, tile])), [floorDefinitions]);
  const dockDefinitionById = useMemo(() => new Map(dockDefinitions.map((tile) => [tile.id, tile])), [dockDefinitions]);
  const officeDefinitionById = useMemo(() => new Map(officeDefinitions.map((tile) => [tile.id, tile])), [officeDefinitions]);

  useEffect(() => {
    let cancelled = false;

    async function loadMode(
      modeKey: DashboardMode,
      storageKey: string,
      defaults: DashboardTileConfig[],
      setTiles: Dispatch<SetStateAction<DashboardTileConfig[]>>,
      setVisibility: Dispatch<SetStateAction<DashboardVisibilityMap>>,
    ) {
      const fallbackLayout = loadFallbackTileLayout(storageKey, defaults);
      const fallbackVisibility = loadFallbackVisibility(fallbackVisibilityKey(profile?.id, modeKey));
      if (!profile?.id) {
        setTiles(sanitizeDashboardLayout(fallbackLayout, defaults));
        setVisibility(fallbackVisibility);
        return;
      }

      try {
        const [remoteLayout, remoteVisibility] = await Promise.all([
          loadDashboardDeviceLayout(profile.id, deviceId, modeKey),
          loadDashboardTileVisibility(profile.id, modeKey),
        ]);
        if (cancelled) return;
        setTiles(sanitizeDashboardLayout(remoteLayout ?? fallbackLayout, defaults));
        setVisibility({ ...fallbackVisibility, ...remoteVisibility });
      } catch (error) {
        if (cancelled) return;
        setTiles(sanitizeDashboardLayout(fallbackLayout, defaults));
        setVisibility(fallbackVisibility);
        console.error("[DashboardPage] dashboard preferences unavailable:", error);
      }
    }

    loadMode("floor", floorLayoutKey, floorDefaults, setFloorTiles, setFloorVisibility);
    loadMode("dock", dockLayoutKey, dockDefaults, setDockTiles, setDockVisibility);
    loadMode("office", officeLayoutKey, officeDefaults, setOfficeTiles, setOfficeVisibility);

    return () => {
      cancelled = true;
    };
  }, [deviceId, dockDefaults, dockLayoutKey, floorDefaults, floorLayoutKey, officeDefaults, officeLayoutKey, profile?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistLayout = useCallback((modeKey: DashboardMode, key: string, tiles: DashboardTileConfig[]) => {
    saveFallbackJson(key, tiles);
    if (profile?.id) {
      saveDashboardDeviceLayout(profile.id, deviceId, modeKey, tiles).catch((error) => {
        console.error("[DashboardPage] save layout failed:", error);
        toast.error("Dashboard layout could not be saved");
      });
    }
  }, [deviceId, profile?.id]);

  const handleTileDragEnd = useCallback((event: DragEndEvent, modeKey: DashboardMode, key: string, setTiles: Dispatch<SetStateAction<DashboardTileConfig[]>>) => {
    if (!editMode) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTiles((prev) => {
        const oldIdx = prev.findIndex((tile) => tile.id === active.id);
        const newIdx = prev.findIndex((tile) => tile.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return prev;
        const next = arrayMove(prev, oldIdx, newIdx);
        persistLayout(modeKey, key, next);
        return next;
      });
    }
  }, [editMode, persistLayout]);

  const handleTileResize = useCallback((id: string, modeKey: DashboardMode, key: string, setTiles: Dispatch<SetStateAction<DashboardTileConfig[]>>) => {
    setTiles((prev) => {
      const next = prev.map((tile) => tile.id === id ? { ...tile, size: (tile.size === "sm" ? "lg" : "sm") as DashboardCardSize } : tile);
      persistLayout(modeKey, key, next);
      return next;
    });
  }, [persistLayout]);

  const handleTileVisibility = useCallback((
    id: string,
    modeKey: DashboardMode,
    visible: boolean,
    setVisibility: Dispatch<SetStateAction<DashboardVisibilityMap>>,
  ) => {
    setVisibility((prev) => {
      const next = { ...prev, [id]: visible };
      saveFallbackJson(fallbackVisibilityKey(profile?.id, modeKey), next);
      return next;
    });
    if (profile?.id) {
      saveDashboardTileVisibility(profile.id, modeKey, id, visible).catch((error) => {
        console.error("[DashboardPage] save visibility failed:", error);
        toast.error("Dashboard tile visibility could not be saved");
      });
    }
  }, [profile?.id]);

  const floorVisibleTiles = useMemo(() => visibleDashboardTiles(floorTiles, floorVisibility, editMode), [editMode, floorTiles, floorVisibility]);
  const dockVisibleTiles = useMemo(() => visibleDashboardTiles(dockTiles, dockVisibility, editMode), [dockTiles, dockVisibility, editMode]);
  const officeVisibleTiles = useMemo(() => visibleDashboardTiles(officeTiles, officeVisibility, editMode), [editMode, officeTiles, officeVisibility]);
  const floorHiddenTiles = useMemo(() => hiddenDashboardTiles(floorTiles, floorVisibility), [floorTiles, floorVisibility]);
  const dockHiddenTiles = useMemo(() => hiddenDashboardTiles(dockTiles, dockVisibility), [dockTiles, dockVisibility]);
  const officeHiddenTiles = useMemo(() => hiddenDashboardTiles(officeTiles, officeVisibility), [officeTiles, officeVisibility]);

  const renderSummaryTile = useCallback((tile: DashboardTileConfig, onResize: (id: string) => void, onHide: (id: string) => void) => {
    const card = summaryCardsById.get(tile.id);
    if (!card) return null;
    return (
      <SortableSummaryCard
        key={tile.id}
        card={{ ...card, size: tile.size }}
        metrics={metrics}
        isLoading={isLoading}
        warehouseCaption={profile?.default_warehouse_id ? `${formatNumber(metrics?.warehousePalletCapacity ?? 0)} location capacity` : "No warehouse selected"}
        editMode={editMode}
        onResize={onResize}
        onHide={onHide}
      />
    );
  }, [editMode, isLoading, metrics, profile?.default_warehouse_id, summaryCardsById]);

  return (
    <div
      ref={dashboardRef}
      className={cn(
        "flex min-h-0 flex-col gap-6 overflow-y-auto overflow-x-hidden lg:h-full lg:gap-3",
        (isFullscreen || fitToScreen) && "h-screen overflow-auto bg-background p-4",
      )}
    >
      <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Command Center</h2>
          <p className="text-sm text-muted-foreground">Live warehouse metrics. Unlock edit mode to reorder, resize, or hide tiles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as DashboardMode)}>
            <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
              <TabsTrigger value="floor" className="gap-1.5"><Forklift className="h-3.5 w-3.5" /> Floor</TabsTrigger>
              <TabsTrigger value="dock" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Dock</TabsTrigger>
              <TabsTrigger value="office" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Office</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={editMode ? "secondary" : "outline"}
                onClick={() => setEditMode((value) => !value)}
                aria-label={editMode ? "Lock dashboard layout" : "Unlock dashboard layout"}
                aria-pressed={editMode}
              >
                {editMode ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{editMode ? "Lock dashboard layout" : "Unlock dashboard layout"}</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="outline" onClick={() => setFitToScreen((v) => !v)} aria-pressed={fitToScreen}>
            {fitToScreen ? "Reset fit" : "Fit to screen"}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {mode === "floor" ? (
          <WarehouseFloorMode
            snapshot={snapshot}
            sensors={sensors}
            tiles={floorVisibleTiles}
            hiddenTiles={floorHiddenTiles}
            definitionsById={floorDefinitionById}
            editMode={editMode}
            renderSummaryTile={renderSummaryTile}
            onDragEnd={(event) => handleTileDragEnd(event, "floor", floorLayoutKey, setFloorTiles)}
            onResize={(id) => handleTileResize(id, "floor", floorLayoutKey, setFloorTiles)}
            onHide={(id) => handleTileVisibility(id, "floor", false, setFloorVisibility)}
            onRestore={(id) => handleTileVisibility(id, "floor", true, setFloorVisibility)}
          />
        ) : null}
        {mode === "dock" ? (
          <DockHandoffBoard
            loads={snapshot.dockLoads}
            recommendations={snapshot.recommendations}
            sensors={sensors}
            tiles={dockVisibleTiles}
            hiddenTiles={dockHiddenTiles}
            definitionsById={dockDefinitionById}
            editMode={editMode}
            renderSummaryTile={renderSummaryTile}
            onDragEnd={(event) => handleTileDragEnd(event, "dock", dockLayoutKey, setDockTiles)}
            onResize={(id) => handleTileResize(id, "dock", dockLayoutKey, setDockTiles)}
            onHide={(id) => handleTileVisibility(id, "dock", false, setDockVisibility)}
            onRestore={(id) => handleTileVisibility(id, "dock", true, setDockVisibility)}
          />
        ) : null}
        {mode === "office" ? (
          <OfficeMonitoringMode
            snapshot={snapshot}
            sensors={sensors}
            tiles={officeVisibleTiles}
            hiddenTiles={officeHiddenTiles}
            definitionsById={officeDefinitionById}
            editMode={editMode}
            renderSummaryTile={renderSummaryTile}
            onDragEnd={(event) => handleTileDragEnd(event, "office", officeLayoutKey, setOfficeTiles)}
            onResize={(id) => handleTileResize(id, "office", officeLayoutKey, setOfficeTiles)}
            onHide={(id) => handleTileVisibility(id, "office", false, setOfficeVisibility)}
            onRestore={(id) => handleTileVisibility(id, "office", true, setOfficeVisibility)}
          />
        ) : null}
      </div>
    </div>
  );
}

function WarehouseFloorMode({
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
          <div className="grid min-h-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
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

function normalizeScannerText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function resolveContainerScanValue(value: unknown) {
  const result = extractIso6346ContainerNumber(value);
  if (result.valid) return { value: result.normalized, valid: true, message: result.message, candidate: result.candidate };
  return {
    value: result.candidate ?? normalizeContainerNumber(value),
    valid: false,
    candidate: result.candidate,
    message: result.message,
  };
}

function isBaySelectorCode(value: string) {
  const normalized = normalizeScannerText(value);
  if (normalized.startsWith("BAY:")) return true;
  const parts = normalized.split("-").filter(Boolean);
  return parts.length >= 4 && !parts.some((part) => /^L\d+$/i.test(part));
}

function shouldUppercaseField(name: string) {
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

function WarehouseIntelligenceCard({ snapshot }: { snapshot: EnterpriseDashboardSnapshot }) {
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

function DockHandoffBoard({
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
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

function OfficeMonitoringMode({
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
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

function HiddenDashboardTilesPanel({
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

function WarehouseBrainPanel({ recommendations }: { recommendations: WarehouseBrainRecommendation[] }) {
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

function toneBorder(tone: "success" | "warning" | "critical" | "info") {
  if (tone === "critical") return "border-l-destructive";
  if (tone === "warning") return "border-l-warning";
  if (tone === "info") return "border-l-info";
  return "border-l-success";
}

type ReceivingShipmentLineState = {
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

type ReceivingShipmentFormState = {
  receipt_type: "po" | "transfer" | "other";
  warehouse_id: string;
  client_id: string;
  container_number: string;
  po_number: string;
  reference_number: string;
  lines: ReceivingShipmentLineState[];
};

function newShipmentLine(productId = ""): ReceivingShipmentLineState {
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

function parseDraftMeta(notes: string | null | undefined): Record<string, any> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function remainderForLine(line: ReceivingShipmentLineState) {
  return Math.max(0, Number(line.total_quantity || 0) - (Number(line.quantity_per_pallet || 0) * Number(line.pallet_count || 0)));
}

function ShipmentFieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium leading-none text-foreground">{children}</label>;
}

function useIsMobileEntry() {
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

function productRequiresExpiry(product?: { expiry_tracked?: boolean } | null) {
  return Boolean(product?.expiry_tracked);
}

function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function draftToReceivingValues(draft: DraftReceipt): z.infer<typeof receivingSchema> {
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

function labelHasValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}

function printDraftLabels(
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

export function ReceivingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useNetworkStatus();
  const { roles, profile } = useAuth();
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", "receiving", restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });

  const defaultWarehouseId = profile?.default_warehouse_id ?? "";
  const warehouses = options?.warehouses ?? [];
  const clients = options?.clients ?? [];
  const productOptions = (options?.products ?? []).map((p: any) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    barcode: p.barcode,
    expiry_tracked: Boolean(p.expiry_tracked),
    temperature_requirement: p.temperature_requirement,
  }));
  const packagingProfiles = options?.packagingProfiles ?? [];
  const isMobileEntry = useIsMobileEntry();
  const productRefs = useRef<Record<string, ProductSearchHandle | null>>({});
  const totalRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const perPalletRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const palletCountRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const expiryRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [numberPad, setNumberPad] = useState<{ lineId: string; field: "total" | "perPallet" | "count" } | null>(null);
  const [numberPadStarted, setNumberPadStarted] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [showShipmentMore, setShowShipmentMore] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [printContainer, setPrintContainer] = useState("");
  const [printContainerWarning, setPrintContainerWarning] = useState<string | null>(null);
  const [shipmentContainerTouched, setShipmentContainerTouched] = useState(false);
  const [shipmentContainerScanWarning, setShipmentContainerScanWarning] = useState<string | null>(null);
  const shipmentContainerInputRef = useRef<HTMLInputElement>(null);
  const shipmentPoInputRef = useRef<HTMLInputElement>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [editingDraft, setEditingDraft] = useState<DraftReceipt | null>(null);
  const [lastResult, setLastResult] = useState<{ barcode: string; taskNumber: string; qty: number } | null>(null);
  const [printAfterSaveIds, setPrintAfterSaveIds] = useState<string[]>([]);
  const [shipmentForm, setShipmentForm] = useState<ReceivingShipmentFormState>({
    receipt_type: "po",
    warehouse_id: defaultWarehouseId,
    client_id: clients.length === 1 ? clients[0].id : "",
    container_number: "",
    po_number: "",
    reference_number: "",
    lines: [newShipmentLine()],
  });

  useEffect(() => {
    setShipmentForm((current) => {
      if (current.warehouse_id) return current;
      const fill = defaultWarehouseId || (warehouses.length === 1 ? warehouses[0].id : "");
      return fill ? { ...current, warehouse_id: fill } : current;
    });
  }, [defaultWarehouseId, warehouses]);

  useEffect(() => {
    setShipmentForm((current) => clients.length === 1 && !current.client_id ? { ...current, client_id: clients[0].id } : current);
  }, [clients]);

  const currentWarehouseId = shipmentForm.warehouse_id || defaultWarehouseId || (warehouses.length === 1 ? warehouses[0].id : "");
  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ["draft-receipts", currentWarehouseId],
    queryFn: () => listDraftReceipts(currentWarehouseId),
    enabled: Boolean(currentWarehouseId),
  });

  const draftSearchTerm = draftSearch.trim().toLowerCase();
  const visibleDrafts = useMemo(() => {
    if (!draftSearchTerm) return drafts;
    return drafts.filter((draft) => {
      const meta = parseDraftMeta(draft.notes);
      const product = productOptions.find((p) => p.id === (draft.product_id ?? meta.product_id));
      return [
        draft.receipt_number,
        draft.reference_number,
        draft.container_number,
        draft.po_number,
        draft.draft_pallet_barcode,
        draft.source_label,
        draft.quantity,
        product?.sku,
        product?.name,
        product?.barcode,
      ].some((value) => String(value ?? "").toLowerCase().includes(draftSearchTerm));
    });
  }, [draftSearchTerm, drafts, productOptions]);

  const printDrafts = useMemo(() => {
    const term = printContainer.trim().toLowerCase();
    return term ? drafts.filter((draft) => String(draft.container_number ?? "").toLowerCase().includes(term)) : drafts;
  }, [drafts, printContainer]);

  const selectedPrintDrafts = printDrafts.filter((draft) => selectedDraftIds.has(draft.id));
  const shipmentContainerValidation = useMemo(
    () => validateIso6346ContainerNumber(shipmentForm.container_number),
    [shipmentForm.container_number],
  );
  const shipmentContainerHasValue = shipmentForm.container_number.trim().length > 0;
  const shipmentContainerInvalid = shipmentContainerHasValue && !shipmentContainerValidation.valid;
  const shipmentContainerValid = shipmentContainerHasValue && shipmentContainerValidation.valid;
  const shipmentContainerMessage = shipmentContainerScanWarning ?? (shipmentContainerHasValue
    ? shipmentContainerValidation.message
    : "Enter a valid ISO 6346 container number. Example: MSKU1234565.");
  useEffect(() => {
    if (!printOpen || selectedDraftIds.size > 0) return;
    setSelectedDraftIds(new Set(printDrafts.map((draft) => draft.id)));
  }, [printDrafts, printOpen, selectedDraftIds.size]);

  useEffect(() => {
    if (!printOpen || printAfterSaveIds.length === 0) return;
    const availableIds = new Set(drafts.map((draft) => draft.id));
    const readyIds = printAfterSaveIds.filter((id) => availableIds.has(id));
    if (readyIds.length > 0) {
      setSelectedDraftIds(new Set(readyIds));
      setPrintAfterSaveIds([]);
    }
  }, [drafts, printAfterSaveIds, printOpen]);
  const incompleteLine = shipmentForm.lines.find((line) => {
    const remainder = remainderForLine(line);
    return !line.product_id ||
      Number(line.total_quantity) <= 0 ||
      Number(line.quantity_per_pallet) <= 0 ||
      Number(line.pallet_count) <= 0 ||
      (remainder > 0 && !line.remainder_action);
  });
  const saveBlockedReason = !shipmentForm.container_number.trim()
    ? "Enter a container number before saving."
    : !shipmentContainerValidation.valid
      ? shipmentContainerValidation.message
    : !shipmentForm.warehouse_id
      ? "Select a warehouse before saving."
      : incompleteLine
        ? remainderForLine(incompleteLine) > 0 && !incompleteLine.remainder_action
          ? "Choose how to handle the leftover quantity before saving."
          : "Enter a SKU and valid quantities before saving."
        : "";
  const canSaveShipment = !saveBlockedReason;

  const saveShipmentMutation = useMutation({
    mutationFn: async (mode: "receive" | "new") => {
      const lines = shipmentForm.lines.map((line) => ({
        product_id: line.product_id,
        client_id: shipmentForm.client_id || undefined,
        packaging_profile_id: line.packaging_profile_id || undefined,
        total_quantity: Number(line.total_quantity),
        quantity_per_pallet: Number(line.quantity_per_pallet),
        pallet_count: Number(line.pallet_count),
        expiry_date: line.expiry_date || (productRequiresExpiry(productOptions.find((item) => item.id === line.product_id)) ? defaultExpiryDate() : undefined),
        lot_number: line.lot_number || undefined,
        batch_number: line.batch_number || undefined,
        remainder_quantity: remainderForLine(line),
        remainder_action: line.remainder_action || undefined,
        create_special_pallet: line.remainder_action === "special",
      }));
      const missingExpiry = shipmentForm.lines.find((line) => {
        const product = productOptions.find((item) => item.id === line.product_id);
        const computedExpiry = line.expiry_date || (productRequiresExpiry(product) ? defaultExpiryDate() : "");
        return productRequiresExpiry(product) && !computedExpiry;
      });
      if (missingExpiry) {
        const product = productOptions.find((item) => item.id === missingExpiry.product_id);
        throw new Error(`${product?.sku ?? "Selected product"} requires an expiry date.`);
      }
      if (editingDraft) {
        const line = shipmentForm.lines[0];
        await updateDraftReceipt(editingDraft.id, {
          receipt_type: shipmentForm.receipt_type,
          reference_number: shipmentForm.reference_number || shipmentForm.po_number,
          container_number: shipmentForm.container_number,
          po_number: shipmentForm.po_number,
          warehouse_id: shipmentForm.warehouse_id,
          client_id: shipmentForm.client_id,
          product_id: line.product_id,
          packaging_profile_id: line.packaging_profile_id,
          quantity: Number(line.total_quantity),
          lot_number: line.lot_number,
          batch_number: line.batch_number,
          expiry_date: line.expiry_date,
          pallet_barcode: editingDraft.draft_pallet_barcode ?? undefined,
          draft_group_id: editingDraft.draft_group_id ?? undefined,
          draft_sequence: editingDraft.draft_sequence ?? undefined,
          draft_count: editingDraft.draft_count ?? undefined,
        });
        return { mode, count: 1, edited: true, draftIds: [editingDraft.id], containerNumber: shipmentForm.container_number };
      }
      const result = await saveShipmentDrafts({
        receipt_type: shipmentForm.receipt_type,
        warehouse_id: shipmentForm.warehouse_id,
        client_id: shipmentForm.client_id || undefined,
        container_number: shipmentForm.container_number,
        po_number: shipmentForm.po_number,
        reference_number: shipmentForm.reference_number,
        lines,
      });
      return { mode, count: result.count, edited: false, draftIds: result.draftIds, containerNumber: shipmentForm.container_number };
    },
    onSuccess: async (result) => {
      toast.success(result.edited ? "Draft updated" : `${result.count} pallet draft${result.count === 1 ? "" : "s"} saved`);
      await queryClient.invalidateQueries({ queryKey: ["draft-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      setEditingDraft(null);
      if (result.mode === "receive" && !result.edited) {
        setShipmentOpen(false);
        setPrintContainer(result.containerNumber);
        setSelectedDraftIds(new Set(result.draftIds));
        setPrintAfterSaveIds(result.draftIds);
        setPrintOpen(true);
      } else if (result.mode === "new" && !result.edited) {
        setShipmentContainerTouched(false);
        setShipmentContainerScanWarning(null);
        setShipmentForm((current) => ({
          ...current,
          container_number: "",
          po_number: "",
          reference_number: "",
          lines: [newShipmentLine()],
        }));
      } else {
        setShipmentOpen(false);
      }
    },
    onError: (error: any) => toast.error(error?.message ?? error?.details ?? "Shipment draft save failed"),
  });

  const receiveMutation = useMutation({
    mutationFn: (draft: DraftReceipt) => completeReceiptFromDraft(draft.id, draftToReceivingValues(draft)),
    onSuccess: async (result, draft) => {
      toast.success(`Pallet ${result.palletBarcode} ready — putaway task ${result.putawayTaskNumber} queued.`);
      setLastResult({ barcode: result.palletBarcode, taskNumber: result.putawayTaskNumber, qty: Number(draft.quantity ?? 0) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
        queryClient.invalidateQueries({ queryKey: ["draft-receipts"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Receiving failed"),
  });

  const batchReceiveMutation = useMutation({
    mutationFn: async (draftsToReceive: DraftReceipt[]) => {
      const results = [];
      for (const draft of draftsToReceive) {
        results.push(await completeReceiptFromDraft(draft.id, draftToReceivingValues(draft)));
      }
      return results;
    },
    onSuccess: async (results) => {
      const count = results.length;
      toast.success(`${count} pallet label${count === 1 ? "" : "s"} printed and sent to Put-Away.`);
      setLastResult({
        barcode: count === 1 ? results[0]?.palletBarcode ?? "Pallet" : `${count} pallets`,
        taskNumber: count === 1 ? results[0]?.putawayTaskNumber ?? "queued" : "queued",
        qty: count,
      });
      setPrintOpen(false);
      setSelectedDraftIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
        queryClient.invalidateQueries({ queryKey: ["draft-receipts"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Receiving failed"),
  });

  function printAndReceiveDrafts(draftsToReceive: DraftReceipt[]) {
    printDraftLabels(draftsToReceive, productOptions, clients, warehouses, packagingProfiles, () => {
      batchReceiveMutation.mutate(draftsToReceive);
    });
  }

  const deleteDraftMutation = useMutation({
    mutationFn: deleteDraftReceipt,
    onSuccess: async () => {
      toast.success("Draft cancelled");
      await queryClient.invalidateQueries({ queryKey: ["draft-receipts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Draft cancel failed"),
  });

  function openNewShipment() {
    setEditingDraft(null);
    setShipmentContainerTouched(false);
    setShipmentContainerScanWarning(null);
    setShipmentForm({
      receipt_type: "po",
      warehouse_id: currentWarehouseId,
      client_id: clients.length === 1 ? clients[0].id : "",
      container_number: "",
      po_number: "",
      reference_number: "",
      lines: [newShipmentLine()],
    });
    setShipmentOpen(true);
  }

  function openEditDraft(draft: DraftReceipt) {
    const values = draftToReceivingValues(draft);
    setEditingDraft(draft);
    setShipmentContainerTouched(Boolean(values.container_number));
    setShipmentContainerScanWarning(null);
    setShipmentForm({
      receipt_type: values.receipt_type,
      warehouse_id: values.warehouse_id,
      client_id: values.client_id ?? "",
      container_number: values.container_number ?? "",
      po_number: values.po_number ?? "",
      reference_number: values.reference_number ?? "",
      lines: [{
        ...newShipmentLine(values.product_id),
        total_quantity: Number(values.quantity),
        quantity_per_pallet: Number(values.quantity),
        pallet_count: 1,
        expiry_date: values.expiry_date ?? "",
        lot_number: values.lot_number ?? "",
        batch_number: values.batch_number ?? "",
        packaging_profile_id: values.packaging_profile_id ?? "",
      }],
    });
    setShipmentOpen(true);
  }

  function updateLine(id: string, patch: Partial<ReceivingShipmentLineState>, changed?: "total" | "perPallet" | "count") {
    setShipmentForm((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        return changed ? distributeShipmentLine(next, changed) : next;
      }),
    }));
  }

  function focusShipmentField(lineId: string, field: "total" | "perPallet" | "count" | "expiry") {
    const target =
      field === "total" ? totalRefs.current[lineId] :
      field === "perPallet" ? perPalletRefs.current[lineId] :
      field === "count" ? palletCountRefs.current[lineId] :
      expiryRefs.current[lineId];
    setTimeout(() => target?.focus(), 40);
  }

  function openNumberPad(lineId: string, field: "total" | "perPallet" | "count") {
    setNumberPad({ lineId, field });
    setNumberPadStarted(false);
  }

  function openDatePicker(input: HTMLInputElement | null) {
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow showPicker from direct user gestures.
    }
  }

  function moveToNextShipmentField(lineId: string, field: "product" | "total" | "perPallet" | "count") {
    if (field === "product") {
      if (isMobileEntry) {
        openNumberPad(lineId, "total");
      } else {
        focusShipmentField(lineId, "total");
      }
      return;
    }
    if (field === "total") {
      if (isMobileEntry) {
        openNumberPad(lineId, "perPallet");
      } else {
        focusShipmentField(lineId, "perPallet");
      }
      return;
    }
    if (field === "perPallet") {
      if (isMobileEntry) {
        openNumberPad(lineId, "count");
      } else {
        focusShipmentField(lineId, "count");
      }
      return;
    }
    setNumberPad(null);
    setNumberPadStarted(false);
    setTimeout(() => openDatePicker(expiryRefs.current[lineId]), 40);
  }

  const numberPadLine = numberPad ? shipmentForm.lines.find((line) => line.id === numberPad.lineId) : undefined;
  const numberPadValue = numberPadLine && numberPad
    ? String(numberPad.field === "total" ? numberPadLine.total_quantity : numberPad.field === "perPallet" ? numberPadLine.quantity_per_pallet : numberPadLine.pallet_count)
    : "";
  const numberPadLabel = numberPad?.field === "total" ? "Total received" : numberPad?.field === "perPallet" ? "Qty per pallet" : "Pallets";

  function setNumberPadValue(value: string) {
    if (!numberPad) return;
    setNumberPadStarted(true);
    const clean = value.replace(/\D/g, "");
    const numeric = numberPad.field === "total" ? Number(clean || 0) : Math.max(1, Number(clean || 1));
    if (numberPad.field === "total") updateLine(numberPad.lineId, { total_quantity: numeric }, "total");
    if (numberPad.field === "perPallet") updateLine(numberPad.lineId, { quantity_per_pallet: numeric }, "perPallet");
    if (numberPad.field === "count") updateLine(numberPad.lineId, { pallet_count: numeric }, "count");
  }

  function appendNumberPadDigit(digit: string) {
    const base = !numberPadStarted || numberPadValue === "0" ? "" : numberPadValue;
    setNumberPadValue(`${base}${digit}`);
  }

  const canAddSkuLine = shipmentForm.lines.every((line) => Boolean(line.product_id) && Number(line.total_quantity) > 0);

  function saveShipment(mode: "receive" | "new") {
    if (!canSaveShipment) {
      toast.error(saveBlockedReason);
      return;
    }
    saveShipmentMutation.mutate(mode);
  }

  function setShipmentContainer(value: unknown) {
    setShipmentContainerTouched(true);
    setShipmentContainerScanWarning(null);
    setShipmentForm((cur) => ({ ...cur, container_number: normalizeContainerNumber(value) }));
  }

  function applyShipmentContainerScan(value: unknown) {
    const result = resolveContainerScanValue(value);
    setShipmentContainerTouched(true);
    setShipmentContainerScanWarning(result.valid ? null : result.message);
    setShipmentForm((cur) => ({ ...cur, container_number: result.value }));
    if (!result.valid) toast.warning(result.message);
  }

  function applyDraftSearchScan(value: unknown) {
    const result = resolveContainerScanValue(value);
    if (result.valid) {
      setDraftSearch(result.value);
      return;
    }
    if (result.candidate) {
      toast.warning(result.message);
      setDraftSearch(result.value);
      return;
    }
    setDraftSearch(normalizeScannerText(value));
  }

  function applyPrintContainerScan(value: unknown) {
    const result = resolveContainerScanValue(value);
    setPrintContainer(result.value);
    setPrintContainerWarning(result.valid ? null : result.message);
    if (!result.valid) toast.warning(result.message);
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {!online && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Connection is unstable. Finish scan work already in progress, then move to better signal and use Sync/Refresh before starting new receiving batches.
        </div>
      )}
      {lastResult && (
        <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Pallet {lastResult.barcode} received · {lastResult.qty} units</p>
            <p className="text-xs text-green-700 dark:text-green-400">Put-Away task {lastResult.taskNumber} queued</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate("/putaway-tasks")}>Go to Put-Away</Button>
            <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>x</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Receiving</h2>
          <p className="text-sm text-muted-foreground">Create shipment drafts by container, print labels, then receive selected pallets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { refetchDrafts(); void flushOfflineQueue(); }}>
            <RefreshCw data-icon="inline-start" />
            Sync / Refresh
          </Button>
          <Button variant="outline" onClick={() => {
            setPrintContainer(draftSearch);
            setSelectedDraftIds(new Set(visibleDrafts.map((draft) => draft.id)));
            setPrintOpen(true);
          }}>
            <Printer data-icon="inline-start" />
            Print drafts
          </Button>
          <Button onClick={openNewShipment}>
            <Plus data-icon="inline-start" />
            New shipment
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex min-w-0 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="pl-9"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Search container, PO, pallet, SKU, product, receipt"
              />
            </div>
            <BarcodeScanButton title="Scan container, PO, or pallet" enableTextRecognition onScan={applyDraftSearchScan} />
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader>
          <CardTitle className="text-base">Draft Pallets {drafts.length > 0 && <Badge variant="secondary">{drafts.length}</Badge>}</CardTitle>
          <CardDescription>Use Print for labels, Edit for quantity/date corrections, and Receive when the physical pallet is confirmed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {visibleDrafts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {drafts.length === 0 ? "No draft pallets yet." : `No drafts matched "${draftSearch}".`}
            </p>
          ) : visibleDrafts.map((draft) => {
            const meta = parseDraftMeta(draft.notes);
            const product = productOptions.find((p) => p.id === (draft.product_id ?? meta.product_id));
            const client = clients.find((item) => item.id === draft.client_id);
            const warehouse = warehouses.find((item) => item.id === draft.warehouse_id);
            const packaging = packagingProfiles.find((item: any) => item.id === meta.packaging_profile_id);
            const barcode = draft.draft_pallet_barcode ?? meta.draft_pallet_barcode ?? draft.receipt_number;
            return (
              <div key={draft.id} className="grid gap-3 rounded-lg border border-border px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{product ? `${product.sku} · ${product.name}` : "Unknown product"}</p>
                    <Badge variant="outline" className="font-mono">{barcode}</Badge>
                    {draft.draft_sequence && draft.draft_count ? <Badge variant="secondary">{draft.draft_sequence}/{draft.draft_count}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Container {draft.container_number ?? "—"} · PO {draft.po_number ?? draft.reference_number ?? "—"} · Qty {draft.quantity ?? "?"} · Exp {draft.expiry_date ? formatDate(draft.expiry_date) : "—"}
                  </p>
                  {draft.source_label && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Returned from {draft.source_label}</p>}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <PalletLabelPage
                    barcode={barcode}
                    quantity={Number(draft.quantity ?? meta.quantity ?? 1)}
                    productSku={product?.sku}
                    productName={product?.name}
                    lotNumber={draft.lot_number ?? meta.lot_number}
                    batchNumber={draft.batch_number ?? meta.batch_number}
                    expiryDate={draft.expiry_date ?? meta.expiry_date}
                    containerNumber={draft.container_number ?? meta.container_number}
                    poNumber={draft.po_number ?? meta.po_number}
                    clientName={client?.name}
                    warehouseName={warehouse ? `${warehouse.code ? `${warehouse.code} - ` : ""}${warehouse.name}` : undefined}
                    receiptReference={draft.reference_number ?? draft.receipt_number}
                    packaging={packaging?.name ?? packaging?.unit_name ?? packaging?.unit_of_measure}
                    draftSequence={draft.draft_sequence}
                    draftCount={draft.draft_count}
                    temperatureClass={product?.temperature_requirement}
                    onPrinted={async () => { await receiveMutation.mutateAsync(draft); }}
                    trigger={<Button size="sm" variant="outline" disabled={receiveMutation.isPending}><Printer data-icon="inline-start" />Print & Receive</Button>}
                  />
                  <Button size="sm" variant="outline" onClick={() => openEditDraft(draft)}><Pencil data-icon="inline-start" />Edit</Button>
                  {draft.status === "draft" && (
                    <Button size="sm" variant="ghost" onClick={() => deleteDraftMutation.mutate(draft.id)} disabled={deleteDraftMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={shipmentOpen} onOpenChange={(open) => { setShipmentOpen(open); if (!open) setEditingDraft(null); }}>
        <DialogContent className="h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] overflow-hidden bg-card p-0 text-card-foreground sm:h-auto sm:max-h-[92vh] sm:max-w-[min(72rem,96vw)]">
          <DialogHeader className="border-b border-border px-3 py-2 sm:px-4 sm:py-3">
            <DialogTitle>{editingDraft ? "Edit Draft Pallet" : "New Shipment"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Container and PO come first, then one or more SKU lines with expiry and pallet distribution.</DialogDescription>
          </DialogHeader>
          <ScrollArea className={cn("max-h-[calc(100dvh-8.75rem)] px-3 py-3 sm:max-h-[calc(92vh-150px)] sm:px-4 sm:py-4", isMobileEntry && numberPad && "max-h-[calc(100dvh-27rem)]")}>
            <div className="grid gap-3 sm:gap-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <ShipmentFieldLabel>Container number</ShipmentFieldLabel>
                  <div className="flex gap-2">
                    <Input
                      ref={shipmentContainerInputRef}
                      className={cn(
                        "h-9 sm:h-10",
                        shipmentContainerTouched && shipmentContainerInvalid && "border-destructive focus-visible:ring-destructive",
                        shipmentContainerValid && "border-green-500 focus-visible:ring-green-500",
                      )}
                      autoFocus
                      value={shipmentForm.container_number}
                      onBlur={() => setShipmentContainerTouched(true)}
                      onChange={(e) => setShipmentContainer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); shipmentPoInputRef.current?.focus(); } }}
                      aria-invalid={shipmentContainerInvalid}
                      aria-describedby="container-number-help"
                    />
                    <BarcodeScanButton title="Scan container number" enableTextRecognition inputRef={shipmentContainerInputRef} onScan={applyShipmentContainerScan} />
                  </div>
                  <p
                    id="container-number-help"
                    className={cn(
                      "text-xs",
                      shipmentContainerTouched && shipmentContainerInvalid ? "text-destructive" : shipmentContainerValid ? "text-green-500" : "text-muted-foreground",
                    )}
                  >
                    {shipmentContainerMessage}
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <ShipmentFieldLabel>PO number</ShipmentFieldLabel>
                  <Input ref={shipmentPoInputRef} className="h-9 sm:h-10" value={shipmentForm.po_number} onChange={(e) => setShipmentForm((cur) => ({ ...cur, po_number: e.target.value.toUpperCase(), reference_number: e.target.value.toUpperCase() }))} />
                </div>
                <div className="col-span-2 grid gap-1.5 md:col-span-1">
                  <ShipmentFieldLabel>Warehouse</ShipmentFieldLabel>
                  <Select value={shipmentForm.warehouse_id || undefined} onValueChange={(value) => setShipmentForm((cur) => ({ ...cur, warehouse_id: value }))}>
                    <SelectTrigger className="h-9 sm:h-10"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.length === 0 ? <SelectItem value="__loading_warehouses" disabled>Loading warehouses...</SelectItem> : null}
                      {warehouses.filter((w: any) => Boolean(w.id)).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button type="button" className="w-fit text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={() => setShowShipmentMore((v) => !v)}>
                {showShipmentMore ? "Hide" : "Show"} shipment options
              </button>
              {showShipmentMore && (
                <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <ShipmentFieldLabel>Receipt type</ShipmentFieldLabel>
                    <Select value={shipmentForm.receipt_type} onValueChange={(value) => setShipmentForm((cur) => ({ ...cur, receipt_type: value as ReceivingShipmentFormState["receipt_type"] }))}>
                      <SelectTrigger className="h-9 sm:h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="po">Purchase Order</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="other">Manual / Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <ShipmentFieldLabel>Client</ShipmentFieldLabel>
                    <Select value={shipmentForm.client_id || undefined} onValueChange={(value) => setShipmentForm((cur) => ({ ...cur, client_id: value }))}>
                      <SelectTrigger className="h-9 sm:h-10"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.length === 0 ? <SelectItem value="__no_clients" disabled>No clients available</SelectItem> : null}
                        {clients.filter((client: any) => Boolean(client.id)).map((client: any) => <SelectItem key={client.id} value={client.id}>{client.code} · {client.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <ShipmentFieldLabel>Reference</ShipmentFieldLabel>
                    <Input className="h-9 sm:h-10" value={shipmentForm.reference_number} onChange={(e) => setShipmentForm((cur) => ({ ...cur, reference_number: normalizeScannerText(e.target.value) }))} />
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                {shipmentForm.lines.map((line, index) => {
                  const remainder = remainderForLine(line);
                  const selectedProduct = productOptions.find((product) => product.id === line.product_id);
                  const expiryRequired = productRequiresExpiry(selectedProduct);
                  const allocatedQuantity = Math.max(0, Number(line.quantity_per_pallet || 0) * Number(line.pallet_count || 0));
                  return (
                    <div key={line.id} className="grid gap-2 rounded-lg border border-border p-2 sm:gap-3 sm:p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">SKU line {index + 1}</p>
                        {!editingDraft && shipmentForm.lines.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => setShipmentForm((cur) => ({ ...cur, lines: cur.lines.filter((item) => item.id !== line.id) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 lg:grid-cols-[2fr_repeat(3,1fr)] lg:gap-3">
                        <div className="col-span-3 grid gap-1.5 lg:col-span-1">
                          <ShipmentFieldLabel>Product</ShipmentFieldLabel>
                          <ProductSearch
                            ref={(node) => { productRefs.current[line.id] = node; }}
                            value={line.product_id}
                            options={productOptions}
                            placeholder="Select SKU"
                            onChange={(value) => {
                              const product = productOptions.find((item) => item.id === value);
                              updateLine(line.id, {
                                product_id: value,
                                expiry_date: productRequiresExpiry(product) && !line.expiry_date ? defaultExpiryDate() : line.expiry_date,
                              });
                            }}
                            onSelectComplete={() => moveToNextShipmentField(line.id, "product")}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Total received</ShipmentFieldLabel>
                          <Input
                            ref={(node) => { totalRefs.current[line.id] = node; }}
                            className="h-9 sm:h-10"
                            type={isMobileEntry ? "text" : "number"}
                            inputMode="numeric"
                            min={0}
                            readOnly={isMobileEntry}
                            value={line.total_quantity}
                            onFocus={(e) => { if (isMobileEntry) openNumberPad(line.id, "total"); else e.currentTarget.select(); }}
                            onClick={() => isMobileEntry && openNumberPad(line.id, "total")}
                            onKeyDown={(e) => { if (e.key === "Enter") moveToNextShipmentField(line.id, "total"); }}
                            onChange={(e) => updateLine(line.id, { total_quantity: e.currentTarget.valueAsNumber || Number(e.currentTarget.value) || 0 }, "total")}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Qty per pallet</ShipmentFieldLabel>
                          <Input
                            ref={(node) => { perPalletRefs.current[line.id] = node; }}
                            className="h-9 sm:h-10"
                            type={isMobileEntry ? "text" : "number"}
                            inputMode="numeric"
                            min={1}
                            readOnly={isMobileEntry}
                            value={line.quantity_per_pallet}
                            onFocus={(e) => { if (isMobileEntry) openNumberPad(line.id, "perPallet"); else e.currentTarget.select(); }}
                            onClick={() => isMobileEntry && openNumberPad(line.id, "perPallet")}
                            onKeyDown={(e) => { if (e.key === "Enter") moveToNextShipmentField(line.id, "perPallet"); }}
                            onChange={(e) => updateLine(line.id, { quantity_per_pallet: e.currentTarget.valueAsNumber || Number(e.currentTarget.value) || 1 }, "perPallet")}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Pallets</ShipmentFieldLabel>
                          <Input
                            ref={(node) => { palletCountRefs.current[line.id] = node; }}
                            className="h-9 sm:h-10"
                            type={isMobileEntry ? "text" : "number"}
                            inputMode="numeric"
                            min={1}
                            readOnly={isMobileEntry}
                            value={line.pallet_count}
                            onFocus={(e) => { if (isMobileEntry) openNumberPad(line.id, "count"); else e.currentTarget.select(); }}
                            onClick={() => isMobileEntry && openNumberPad(line.id, "count")}
                            onKeyDown={(e) => { if (e.key === "Enter") moveToNextShipmentField(line.id, "count"); }}
                            onChange={(e) => updateLine(line.id, { pallet_count: e.currentTarget.valueAsNumber || Number(e.currentTarget.value) || 1 }, "count")}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Expiry{expiryRequired ? " *" : ""}</ShipmentFieldLabel>
                          <Input
                            ref={(node) => { expiryRefs.current[line.id] = node; }}
                            className={cn("h-9 sm:h-10", expiryRequired && !line.expiry_date && "border-amber-500")}
                            type="date"
                            required={expiryRequired}
                            aria-invalid={expiryRequired && !line.expiry_date}
                            value={line.expiry_date}
                            onClick={(e) => openDatePicker(e.currentTarget)}
                            onFocus={(e) => isMobileEntry && openDatePicker(e.currentTarget)}
                            onChange={(e) => updateLine(line.id, { expiry_date: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Lot</ShipmentFieldLabel>
                          <Input className="h-9 sm:h-10" value={line.lot_number} onChange={(e) => updateLine(line.id, { lot_number: normalizeScannerText(e.target.value) })} />
                        </div>
                        <div className="grid gap-1.5">
                          <ShipmentFieldLabel>Batch</ShipmentFieldLabel>
                          <Input className="h-9 sm:h-10" value={line.batch_number} onChange={(e) => updateLine(line.id, { batch_number: normalizeScannerText(e.target.value) })} />
                        </div>
                        <div className="col-span-2 grid gap-1.5 md:col-span-1">
                          <ShipmentFieldLabel>Packaging</ShipmentFieldLabel>
                          <Select value={line.packaging_profile_id || undefined} onValueChange={(value) => updateLine(line.id, { packaging_profile_id: value })}>
                            <SelectTrigger className="h-9 sm:h-10"><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {packagingProfiles.length === 0 ? <SelectItem value="__no_packaging" disabled>No packaging profiles</SelectItem> : null}
                              {packagingProfiles.filter((profile: any) => Boolean(profile.id)).map((profile: any) => <SelectItem key={profile.id} value={profile.id}>{profile.profile_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {remainder > 0 && (
                        <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                          <p className="font-medium">{remainder} unit{remainder === 1 ? "" : "s"} will be left after creating {line.pallet_count} pallet{Number(line.pallet_count) === 1 ? "" : "s"} of {line.quantity_per_pallet}.</p>
                          <p className="text-xs">Allocated in WMS: {allocatedQuantity}. Total received: {line.total_quantity}.</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {[
                              ["waive", "Waive remainder"],
                              ["manual", "Manage outside WMS"],
                              ["special", "Create special pallet"],
                            ].map(([value, label]) => (
                              <label key={value} className="flex items-center gap-2 rounded-md border border-amber-300 bg-background px-3 py-2">
                                <input type="radio" name={`remainder-${line.id}`} checked={line.remainder_action === value} onChange={() => updateLine(line.id, { remainder_action: value as ReceivingShipmentLineState["remainder_action"] })} />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!editingDraft && (
                  <Button
                    className="h-9 sm:h-10"
                    type="button"
                    variant="outline"
                    disabled={!canAddSkuLine}
                    title={canAddSkuLine ? "Add SKU line" : "Enter a SKU and quantity before adding another line"}
                    onClick={() => setShipmentForm((cur) => ({ ...cur, lines: [...cur.lines, newShipmentLine()] }))}
                  >
                    <Plus data-icon="inline-start" />
                    Add SKU line
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
          {isMobileEntry && numberPad && numberPadLine && (
            <div className="border-t border-border bg-popover p-3 text-popover-foreground">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{numberPadLabel}</p>
                  <p className="font-mono text-2xl font-bold tabular-nums">{numberPadValue || "0"}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNumberPad(null)}>Done</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <Button key={digit} type="button" variant="outline" className="h-11 text-lg" onClick={() => appendNumberPadDigit(digit)}>
                    {digit}
                  </Button>
                ))}
                <Button type="button" variant="outline" className="h-11" onClick={() => setNumberPadValue("")}>Clear</Button>
                <Button type="button" variant="outline" className="h-11 text-lg" onClick={() => appendNumberPadDigit("0")}>0</Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => setNumberPadValue(numberPadValue.slice(0, -1))}>Back</Button>
              </div>
              <Button type="button" data-testid="shipment-number-next" className="mt-2 h-10 w-full" onClick={() => moveToNextShipmentField(numberPad.lineId, numberPad.field)}>
                Next
              </Button>
            </div>
          )}
          <DialogFooter className={cn("flex-row flex-wrap justify-end gap-2 border-t border-border px-3 py-2 sm:px-4 sm:py-3", isMobileEntry && numberPad && "hidden")}>
            {saveBlockedReason && (
              <p className="mr-auto w-full text-xs font-medium text-amber-500 sm:w-auto sm:self-center">{saveBlockedReason}</p>
            )}
            <Button variant="outline" onClick={() => setShipmentOpen(false)}>Cancel</Button>
            {!editingDraft && (
              <Button variant="outline" disabled={saveShipmentMutation.isPending || !canSaveShipment} onClick={() => saveShipment("new")}>
                {saveShipmentMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save & New
              </Button>
            )}
            <Button disabled={saveShipmentMutation.isPending || !canSaveShipment} onClick={() => saveShipment("receive")}>
              {saveShipmentMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {editingDraft ? "Save Draft" : "Save & Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Print Draft Labels</DialogTitle>
            <DialogDescription>Filter by container, select draft pallets, then print the selected labels together.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <div className="flex gap-2">
                <Input
                  value={printContainer}
                  onChange={(e) => {
                    const next = normalizeContainerNumber(e.target.value);
                    setPrintContainer(next);
                    if (next.length >= 11) {
                      const validation = validateIso6346ContainerNumber(next);
                      setPrintContainerWarning(validation.valid ? null : validation.message);
                    } else {
                      setPrintContainerWarning(null);
                    }
                  }}
                  className={cn(printContainerWarning && "border-destructive focus-visible:ring-destructive")}
                  placeholder="Filter by container number"
                  aria-invalid={Boolean(printContainerWarning)}
                />
                <BarcodeScanButton title="Scan container number" enableTextRecognition onScan={applyPrintContainerScan} />
              </div>
              <p className={cn("text-xs", printContainerWarning ? "text-destructive" : "text-muted-foreground")}>
                {printContainerWarning ?? "Enter or scan an ISO 6346 container number to narrow this label batch."}
              </p>
            </div>
            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="grid gap-2">
                {printDrafts.map((draft) => {
                  const meta = parseDraftMeta(draft.notes);
                  const product = productOptions.find((p) => p.id === (draft.product_id ?? meta.product_id));
                  const checked = selectedDraftIds.has(draft.id);
                  return (
                    <label key={draft.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
                      <Checkbox checked={checked} onCheckedChange={(value) => {
                        setSelectedDraftIds((current) => {
                          const next = new Set(current);
                          if (value) next.add(draft.id); else next.delete(draft.id);
                          return next;
                        });
                      }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{draft.draft_pallet_barcode ?? draft.receipt_number} · {product?.sku ?? "Unknown SKU"}</span>
                        <span className="block text-xs text-muted-foreground">Container {draft.container_number ?? "—"} · Qty {draft.quantity ?? "?"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDraftIds(new Set(printDrafts.map((draft) => draft.id)))}>Select all shown</Button>
            <Button disabled={batchReceiveMutation.isPending || selectedPrintDrafts.length === 0} onClick={() => printAndReceiveDrafts(selectedPrintDrafts)}>
              {batchReceiveMutation.isPending ? <Loader2 className="animate-spin" /> : <Printer data-icon="inline-start" />}
              Print selected & send to Put-Away
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TextField({
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

function SelectField({
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
    staleTime: 10_000,
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

function BayOccupancyGrid({
  locationCode,
  onSelect,
}: {
  locationCode: string;
  onSelect: (locationCode: string) => void;
}) {
  const isBayScan = isBaySelectorCode(locationCode);
  const { data, isFetching } = useQuery({
    queryKey: ["bay-occupancy", locationCode],
    queryFn: () => getBayOccupancy(locationCode),
    enabled: locationCode.length >= 2,
    staleTime: 10_000,
  });

  if (isFetching) {
    return (
      <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
        Loading bay locations…
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

  if (!isBayScan && data.cells.length <= 1) return null;

  return (
    <div className="grid gap-2 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Bay {data.aisle ?? "?"}-{data.bay ?? "?"}</span>
        <span>{data.cells.filter((cell) => cell.status === "active" && !cell.isFull).length} open</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.cells.map((cell) => {
          const available = cell.status === "active" && !cell.isFull;
          return (
            <button
              key={cell.locationId}
              type="button"
              disabled={!available}
              onClick={() => onSelect(cell.locationCode)}
              className={cn(
                "min-h-16 rounded-md border px-2 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                available
                  ? "border-green-500 bg-green-50 text-green-950 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-100"
                  : "cursor-not-allowed border-muted bg-muted text-muted-foreground opacity-70",
              )}
            >
              <span className="block font-mono font-semibold">{cell.locationCode}</span>
              <span className="mt-1 block">{cell.occupiedPallets}/{cell.maxPallets} pallets</span>
              <span className="block">{available ? "Available" : cell.status !== "active" ? cell.status : "Full"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PutawayTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  // Managers and above see all open tasks; operators/clerks only see their own + unassigned
  const canSeeAllTasks = roles.some((r) => ["developer", "admin", "warehouse_manager", "warehouse_supervisor"].includes(r));
  const putawayUserId = canSeeAllTasks ? undefined : user?.id;
  const { data = [], isLoading } = useQuery({
    queryKey: ["putaway-tasks", putawayUserId],
    queryFn: () => getPutawayTasks(putawayUserId),
  });
  const { data: putawayHistory = [] } = useQuery({
    queryKey: ["putaway-task-history", putawayUserId],
    queryFn: () => getPutawayTaskHistory(putawayUserId),
  });
  const [scanState, setScanState] = useState<Record<string, { pallet: string; location: string; override: boolean; reason: string }>>({});
  const [bayScanState, setBayScanState] = useState<Record<string, string>>({});
  const [violations, setViolations] = useState<Record<string, string>>({});
  const [taskSearch, setTaskSearch] = useState("");
  const palletRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const locationRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const confirmRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [revertedIds, setRevertedIds] = useState<Set<string>>(new Set());
  const [returnTask, setReturnTask] = useState<any | null>(null);

  const revertMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: string; openReceiving?: boolean }) => revertPutawayToDraft(taskId),
    onSuccess: async (_, vars) => {
      toast.success("Task saved as draft");
      setReturnTask(null);
      setRevertedIds((prev) => new Set([...prev, vars.taskId]));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-task-history"] }),
        queryClient.invalidateQueries({ queryKey: ["draft-receipts"] }),
      ]);
      if (vars.openReceiving) navigate("/receiving");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revert failed"),
  });

  const mutation = useMutation({
    meta: { offlineQueueable: true },
    mutationFn: async ({ taskId, pallet, location, override, reason }: { taskId: string; pallet: string; location: string; override?: boolean; reason?: string }) =>
    {
      // If we're offline at submit time, buffer immediately — no network call.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await enqueueOfflineWork("putaway", { taskId, pallet, location, override, reason });
        return { queued: true as const };
      }
      try {
        await confirmPutaway(taskId, pallet, location, { override, overrideReason: reason });
        return { queued: false as const };
      } catch (err) {
        // Network drop mid-submit → buffer and surface as queued, not as a failure.
        if (isLikelyNetworkError(err)) {
          await enqueueOfflineWork("putaway", { taskId, pallet, location, override, reason });
          return { queued: true as const };
        }
        throw err;
      }
    },
    onSuccess: async (result, vars) => {
      if (result?.queued) {
        playBarcodeBeep();
        toast.message("Saved offline — will sync when reconnected", {
          description: `Pallet ${vars.pallet} → ${vars.location} buffered locally.`,
          duration: 6000,
        });
        setCompletedIds((prev) => new Set([...prev, vars.taskId]));
        setScanState((current) => {
          const next = { ...current };
          delete next[vars.taskId];
          return next;
        });
        setViolations((current) => {
          const next = { ...current };
          delete next[vars.taskId];
          return next;
        });
        setBayScanState((current) => {
          const next = { ...current };
          delete next[vars.taskId];
          return next;
        });
        return;
      }
      playBarcodeBeep();
      toast.success(vars.override ? "Put-Away locked in with override" : "Put-Away locked in", {
        description: `Pallet ${vars.pallet} stored at ${vars.location}.`,
        duration: 7000,
        className: "border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-50",
      });
      setCompletedIds((prev) => new Set([...prev, vars.taskId]));
      setScanState((current) => {
        const next = { ...current };
        delete next[vars.taskId];
        return next;
      });
      setViolations((current) => {
        const next = { ...current };
        delete next[vars.taskId];
        return next;
      });
      setBayScanState((current) => {
        const next = { ...current };
        delete next[vars.taskId];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-task-history"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
      ]);
    },
    onError: (error, vars) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.startsWith("RULE_VIOLATION:")) {
        const reason = msg.replace(/^RULE_VIOLATION:\s*/, "");
        setViolations((current) => ({ ...current, [vars.taskId]: reason }));
        toast.warning(`Location rule violation: ${reason}. Tick "Override" to put away anyway.`);
      } else {
        toast.error(msg || "Put-Away failed");
      }
    },
  });

  const openPutawayStatuses = new Set(["queued", "assigned", "in_progress", "exception"]);
  const pendingTasks = data.filter((task: any) => openPutawayStatuses.has(task.status) && !completedIds.has(task.id) && !revertedIds.has(task.id));
  const taskSearchTerm = taskSearch.trim().toLowerCase();
  const visibleTasks = taskSearchTerm
    ? pendingTasks.filter((task: any) =>
      [
        task.task_number,
        task.status,
        task.pallets?.pallet_barcode,
        task.pallets?.pallet_code,
        task.pallets?.products?.sku,
        task.pallets?.products?.name,
        task.locations?.code,
      ].some((value) => String(value ?? "").toLowerCase().includes(taskSearchTerm)),
    )
    : pendingTasks;
  const activeTasks = visibleTasks.filter((t: any) => openPutawayStatuses.has(t.status));

  function applyLocationScan(task: any, scannedValue: string) {
    const value = normalizeScannerText(scannedValue);
    if (!value) return;
    const localState = scanState[task.id] ?? { pallet: task.pallets?.pallet_barcode ?? "", location: "", override: false, reason: "" };
    if (isBaySelectorCode(value)) {
      setBayScanState((current) => ({ ...current, [task.id]: value }));
      setScanState((current) => ({ ...current, [task.id]: { ...localState, location: "" } }));
      void logPutawayBaySelection({ taskId: task.id, scannedCode: value });
      playBarcodeBeep();
      flashInput(locationRefs.current[task.id], "orange");
      return;
    }
    setBayScanState((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    setScanState((current) => ({ ...current, [task.id]: { ...localState, location: value } }));
    playBarcodeBeep();
    flashInput(locationRefs.current[task.id], "blue");
    setTimeout(() => confirmRefs.current[task.id]?.focus(), 50);
  }

  // Auto-focus first pallet field on desktop when tasks load
  const isMobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  useEffect(() => {
    if (isMobile || isLoading || activeTasks.length === 0) return;
    const firstId = activeTasks[0].id;
    const timer = setTimeout(() => palletRefs.current[firstId]?.focus(), 120);
    return () => clearTimeout(timer);
  }, [isLoading, activeTasks.length, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div className="shrink-0 rounded-lg border border-border bg-background/95 p-4 shadow-sm backdrop-blur sm:flex sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Put-Away Tasks</h2>
          <p className="text-sm text-muted-foreground">Scan pallet barcode, then location barcode, and confirm.</p>
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:mt-0 sm:min-w-80 sm:items-end">
          {pendingTasks.length > 0 && (
            <Badge variant="secondary" className="w-fit text-sm">{pendingTasks.length} pending</Badge>
          )}
          <div className="flex w-full min-w-0 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="pl-9"
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
                placeholder="Search pallet barcode or task"
              />
            </div>
            <BarcodeScanButton title="Scan pallet barcode" onScan={(value) => setTaskSearch(normalizeScannerText(value))} />
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1">
        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading putaway tasks…</CardContent></Card>
        ) : visibleTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="font-medium">{pendingTasks.length === 0 ? "All putaway tasks complete" : "No putaway tasks matched"}</p>
            </CardContent>
          </Card>
        ) : (
          visibleTasks.map((task: any) => {
            const localState = scanState[task.id] ?? { pallet: "", location: "", override: false, reason: "" };
            const bayScan = bayScanState[task.id] ?? "";
            const binOccupancy = localState.location.length >= 2;
            const bayOccupancy = Boolean(bayScan || binOccupancy);
            const violation = violations[task.id];
            const suggested = (task.locations as any)?.code;
            const taskPallet = task.pallets as any;
            const palletBarcode = taskPallet?.pallet_barcode ?? taskPallet?.pallet_code ?? "";
            const isOverridingSuggestion = Boolean(suggested && localState.location && localState.location !== suggested);

            return (
              <Card key={task.id} className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-4 text-base">
                    <span className="font-mono">{task.task_number}</span>
                    <Badge>{task.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    <span className="font-medium text-foreground">
                      {(task.pallets as any)?.products?.sku ?? ""} · {(task.pallets as any)?.products?.name ?? ""}
                    </span>
                    {" — "}
                    {(task.pallets as any)?.quantity ?? "?"} units
                    <br />
                    Pallet: <span className="font-mono">{palletBarcode || "No pallet assigned"}</span>
                    <br />
                    Suggested: <span className="font-mono">{(task.locations as any)?.code ?? "Request alternative"}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid items-start gap-3 lg:grid-cols-2">
                    {/* Pallet barcode field */}
                    <div className="grid gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        Confirm pallet <span className="font-mono font-medium text-foreground">{palletBarcode || "assigned to task"}</span>
                      </p>
                      <div className="flex gap-2">
                        <Input
                          ref={(el) => { palletRefs.current[task.id] = el; }}
                          className="min-h-12 min-w-0 flex-1 text-base transition-shadow duration-300"
                          placeholder="Scan pallet barcode"
                          value={localState.pallet}
                          onChange={(event) => {
                            const val = normalizeScannerText(event.target.value);
                            setScanState((current) => ({
                              ...current,
                              [task.id]: { ...localState, pallet: val },
                            }));
                            if (val.endsWith("\n") || val.endsWith("\r")) {
                              const trimmed = normalizeScannerText(val);
                              setScanState((current) => ({
                                ...current,
                                [task.id]: { ...localState, pallet: trimmed },
                              }));
                              playBarcodeBeep();
                              flashInput(palletRefs.current[task.id], "blue");
                              setTimeout(() => {
                                flashInput(locationRefs.current[task.id], "orange");
                                locationRefs.current[task.id]?.focus();
                              }, 50);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              playBarcodeBeep();
                              flashInput(palletRefs.current[task.id], "blue");
                              setTimeout(() => {
                                flashInput(locationRefs.current[task.id], "orange");
                                locationRefs.current[task.id]?.focus();
                              }, 50);
                            }
                          }}
                        />
                        <BarcodeScanButton
                          title="Scan pallet barcode"
                          onScan={(v) => {
                            setScanState((cur) => ({ ...cur, [task.id]: { ...localState, pallet: normalizeScannerText(v) } }));
                            playBarcodeBeep();
                            flashInput(palletRefs.current[task.id], "blue");
                            setTimeout(() => {
                              flashInput(locationRefs.current[task.id], "orange");
                              locationRefs.current[task.id]?.focus();
                            }, 50);
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <p className="text-xs text-muted-foreground">Confirm location</p>
                      <div className="flex gap-2">
                        <Input
                          ref={(el) => { locationRefs.current[task.id] = el; }}
                          className="min-h-12 min-w-0 flex-1 text-base transition-shadow duration-300"
                          placeholder="Scan location barcode"
                          value={localState.location}
                          onChange={(event) => {
                            const val = normalizeScannerText(event.target.value.replace(/[\r\n]/g, ""));
                            if (/^BAY:[^:]+:[^:]+:[^:]+:[^:]+$/i.test(val.trim())) {
                              applyLocationScan(task, val);
                              return;
                            }
                            if (!val.toUpperCase().startsWith("BAY:")) {
                              setBayScanState((current) => {
                                const next = { ...current };
                                delete next[task.id];
                                return next;
                              });
                            }
                            setScanState((current) => ({
                              ...current,
                              [task.id]: { ...localState, location: val },
                            }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              applyLocationScan(task, e.currentTarget.value);
                            }
                          }}
                        />
                        <BarcodeScanButton
                          title="Scan location barcode"
                          onScan={(v) => applyLocationScan(task, normalizeScannerText(v))}
                        />
                      </div>
                    </div>
                  </div>
                  {bayOccupancy && (
                    <>
                      {binOccupancy && <BinCapacityBar locationCode={localState.location} taskId={task.id} />}
                      {bayScan && (
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                          Bay scan <span className="font-mono font-semibold text-foreground">{bayScan}</span> loaded. Select a bin below.
                        </div>
                      )}
                      <BayOccupancyGrid
                        locationCode={bayScan || localState.location}
                        onSelect={(location) => {
                          setScanState((current) => ({ ...current, [task.id]: { ...localState, location } }));
                          setBayScanState((current) => {
                            const next = { ...current };
                            delete next[task.id];
                            return next;
                          });
                          if (bayScan) void logPutawayBaySelection({ taskId: task.id, scannedCode: bayScan, selectedLocationCode: location });
                          flashInput(locationRefs.current[task.id], "blue");
                          setTimeout(() => confirmRefs.current[task.id]?.focus(), 50);
                        }}
                      />
                    </>
                  )}
                  {isOverridingSuggestion && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      Operator override: scanned <span className="font-mono font-semibold">{localState.location}</span> instead of suggested <span className="font-mono font-semibold">{suggested}</span>. The audit log will record the change.
                    </div>
                  )}
                  {violation && (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                      Rule violation: {violation}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={localState.override}
                      onChange={(e) =>
                        setScanState((current) => ({
                          ...current,
                          [task.id]: { ...localState, override: e.target.checked },
                        }))
                      }
                    />
                    Override location rules (warn only — logs reason)
                  </label>
                  {localState.override && (
                    <Input
                      className="min-h-10 text-sm"
                      placeholder="Reason for override (e.g. lane blocked, urgent ship)"
                      value={localState.reason}
                      onChange={(e) =>
                        setScanState((current) => ({
                          ...current,
                          [task.id]: { ...localState, reason: e.target.value },
                        }))
                      }
                    />
                  )}
                  <Button
                    ref={(el) => { confirmRefs.current[task.id] = el; }}
                    className="min-h-12 w-full text-base"
                    disabled={mutation.isPending || !localState.pallet || !localState.location}
                    onClick={() =>
                      mutation.mutate({
                        taskId: task.id,
                        pallet: localState.pallet,
                        location: localState.location,
                        override: localState.override,
                        reason: localState.reason,
                      })
                    }
                  >
                    {mutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
                    {localState.override ? "Override & Confirm Put-Away" : "Confirm Put-Away"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-muted-foreground"
                    disabled={revertMutation.isPending}
                    onClick={() => setReturnTask(task)}
                  >
                    {revertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                    Save as Draft / Return to Receiving
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
        {putawayHistory.length > 0 ? (
          <details className="group rounded-lg border border-border bg-background/60 px-3 py-2">
            <summary className="cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">Show {putawayHistory.length} completed / returned</span>
              <span className="hidden group-open:inline">Hide completed / returned</span>
            </summary>
            <div className="mt-3 grid gap-2">
              {putawayHistory.map((task: any) => {
                const pallet = task.pallets as any;
                const product = pallet?.products as any;
                const suggestedLocation = task.locations?.code ?? "No suggestion";
                const palletCode = pallet?.pallet_barcode ?? pallet?.pallet_code ?? "No pallet";
                return (
                  <details key={task.id} className="rounded-md border border-border px-3 py-2 text-sm opacity-85">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate font-mono text-xs">{task.task_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {palletCode} · {suggestedLocation}
                        </span>
                      </div>
                      <Badge variant={statusBadgeVariant(task.status)} className="shrink-0 text-xs">{task.status}</Badge>
                    </summary>
                    <div className="mt-3 grid gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-medium">{product?.name ?? "Product"}</p>
                        <p className="font-mono text-muted-foreground">{product?.sku ?? "No SKU"}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-mono">Pallet {palletCode}</p>
                        <p className="text-muted-foreground">Suggested {suggestedLocation}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>
      <AlertDialog open={Boolean(returnTask)} onOpenChange={(open) => { if (!open) setReturnTask(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return this task to Receiving?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {returnTask?.task_number ?? "this task"} from Put-Away Tasks and creates a Saved Draft in Receiving. To find it later, open Receiving and use the Draft Pallets list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep task here</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              disabled={revertMutation.isPending || !returnTask}
              onClick={() => returnTask && revertMutation.mutate({ taskId: returnTask.id })}
            >
              Save draft
            </AlertDialogAction>
            <AlertDialogAction
              disabled={revertMutation.isPending || !returnTask}
              onClick={() => returnTask && revertMutation.mutate({ taskId: returnTask.id, openReceiving: true })}
            >
              Save draft & open Receiving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function InventorySearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<string>(searchParams.get("status") ?? "all");
  const [ageBucket, setAgeBucket] = useState(searchParams.get("age") ?? "");
  const [expiryWindow, setExpiryWindow] = useState(searchParams.get("expiry") ?? "");
  const lastDetailTapRef = useRef<{ id: string; time: number } | null>(null);
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", "inventory", restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouse") ?? (restrictedToDefaultWarehouse ? profile?.default_warehouse_id ?? "" : ""));
  const hasInventoryFilters = Boolean(searchTerm || warehouseId || status !== "all" || ageBucket || expiryWindow);

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-search", searchTerm, status, warehouseId, ageBucket, expiryWindow],
    queryFn: () => searchInventory({ search: searchTerm, status, warehouseId: warehouseId || undefined, ageBucket: ageBucket as any, expiryWindow: expiryWindow as any }),
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (searchTerm) next.set("q", searchTerm);
    if (status !== "all") next.set("status", status);
    if (warehouseId) next.set("warehouse", warehouseId);
    if (ageBucket) next.set("age", ageBucket);
    if (expiryWindow) next.set("expiry", expiryWindow);
    setSearchParams(next, { replace: true });
  }, [ageBucket, expiryWindow, searchTerm, setSearchParams, status, warehouseId]);

  function clearInventoryFilters() {
    setSearchTerm("");
    setStatus("all");
    setWarehouseId("");
    setAgeBucket("");
    setExpiryWindow("");
  }

  function openInventoryDetail(balanceId: string) {
    navigate(`/inventory/${balanceId}`);
  }

  function prefetchInventoryDetail(balanceId: string) {
    void queryClient.prefetchQuery({
      queryKey: ["inventory-detail", balanceId],
      queryFn: () => getInventoryDetail(balanceId),
    });
  }

  function handleInventoryRowPointerUp(balanceId: string) {
    if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
    const now = Date.now();
    if (lastDetailTapRef.current?.id === balanceId && now - lastDetailTapRef.current.time < 450) {
      openInventoryDetail(balanceId);
      lastDetailTapRef.current = null;
      return;
    }
    lastDetailTapRef.current = { id: balanceId, time: now };
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div>
        <h2 className="text-2xl font-semibold">Inventory Search</h2>
        <p className="text-sm text-muted-foreground">Search by SKU, pallet, container, PO, lot, batch, expiry, owner, or location.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex min-w-[17rem] flex-1 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3 text-muted-foreground" />
                <Input type="search" className="min-w-0 pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search SKU, pallet, container, PO, or location" />
              </div>
              <BarcodeScanButton title="Scan SKU, pallet, container, PO, or location barcode" onScan={(value) => setSearchTerm(normalizeScannerText(value))} />
            </div>
            <Button className="h-9 min-w-20" variant="outline" onClick={clearInventoryFilters} disabled={!hasInventoryFilters}>
              Clear
            </Button>
          </div>
          {(options?.warehouses?.length ?? 0) > 1 && !restrictedToDefaultWarehouse ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warehouse</span>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                variant={warehouseId === "" ? "default" : "outline"}
                onClick={() => setWarehouseId("")}
              >
                All
              </Button>
              {(options?.warehouses ?? []).map((warehouse) => (
                <Button
                  key={warehouse.id}
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  variant={warehouseId === warehouse.id ? "default" : "outline"}
                  onClick={() => setWarehouseId(warehouse.id)}
                >
                  {warehouse.name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              variant={status === "all" ? "default" : "outline"}
              onClick={() => setStatus("all")}
            >
              All
            </Button>
            {["available", "receiving", "reserved", "hold", "quarantine", "damaged"].map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                variant={status === item ? "default" : "outline"}
                onClick={() => setStatus(item)}
              >
                {item}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Age</span>
            <Button type="button" size="sm" className="h-7 px-2 text-xs" variant={ageBucket === "" ? "default" : "outline"} onClick={() => setAgeBucket("")}>
              All
            </Button>
            {[
              ["3m", "3+ months"],
              ["6m", "6+ months"],
              ["12m", "12+ months"],
            ].map(([value, label]) => (
              <Button key={value} type="button" size="sm" className="h-7 px-2 text-xs" variant={ageBucket === value ? "default" : "outline"} onClick={() => setAgeBucket(value)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry</span>
            <Button type="button" size="sm" className="h-7 px-2 text-xs" variant={expiryWindow === "" ? "default" : "outline"} onClick={() => setExpiryWindow("")}>
              All
            </Button>
            {[
              ["60d", "Next 60 days"],
              ["30d", "Next 30 days"],
            ].map(([value, label]) => (
              <Button key={value} type="button" size="sm" className="h-7 px-2 text-xs" variant={expiryWindow === value ? "default" : "outline"} onClick={() => setExpiryWindow(value)}>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 min-w-0 flex-1 p-0">
          <TableFrame className="h-full min-w-0 flex-1">
            <Table className="min-w-[72rem] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Pallet</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={9}>Searching…</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={9}>No inventory matched.</TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow
                      key={row.inventory_balance_id}
                      className="cursor-pointer even:bg-muted/30 hover:bg-muted/50"
                      onMouseEnter={() => prefetchInventoryDetail(row.inventory_balance_id)}
                      onFocus={() => prefetchInventoryDetail(row.inventory_balance_id)}
                      onDoubleClick={() => openInventoryDetail(row.inventory_balance_id)}
                      onPointerUp={() => handleInventoryRowPointerUp(row.inventory_balance_id)}
                      title="Double-click or double-tap to open details"
                    >
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.pallet_code}</TableCell>
                      <TableCell>{row.container_number ?? "—"}</TableCell>
                      <TableCell>{row.po_number ?? "—"}</TableCell>
                      <TableCell>{row.location_code ?? "Receiving"}</TableCell>
                      <TableCell>{row.warehouse_code}</TableCell>
                      <TableCell><Badge variant={row.status === "available" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
                      <TableCell>{formatNumber(row.available_quantity)}</TableCell>
                      <TableCell>{formatDate(row.expiry_date)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableFrame>
        </CardContent>
      </Card>
    </div>
  );
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "exception" || status === "cancelled") return "destructive";
  if (status === "in_progress" || status === "queued") return "secondary";
  return "outline";
}

export function PickListsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [pickSearch, setPickSearch] = useState("");
  const [activeTab, setActiveTab] = useState("lists");
  const clientTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pickProductRefs = useRef<Record<number, ProductSearchHandle | null>>({});
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: pickLists = [] } = useQuery({ queryKey: ["pick-lists"], queryFn: listPickLists });
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelPickList(id, reason),
    onSuccess: () => {
      toast.success("Pick list cancelled");
      queryClient.invalidateQueries({ queryKey: ["pick-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to cancel pick list"),
  });
  const form = useForm<z.infer<typeof pickListSchema>>({
    resolver: zodResolver(pickListSchema),
    defaultValues: {
      warehouse_id: profile?.default_warehouse_id || undefined,
      client_id: undefined,
      order_number: "",
      requested_ship_date: new Date().toISOString().slice(0, 10),
      notes: "",
      lines: [{ product_id: "", quantity: 1 }],
    },
  });

  useEffect(() => {
    const warehouseId = form.getValues("warehouse_id");
    const defaultWarehouseId = profile?.default_warehouse_id || (options?.warehouses?.length === 1 ? options.warehouses[0].id : "");
    if (!warehouseId && defaultWarehouseId) {
      form.setValue("warehouse_id", defaultWarehouseId);
    }
  }, [form, options?.warehouses, profile?.default_warehouse_id]);

  useEffect(() => {
    if (!form.getValues("requested_ship_date")) {
      form.setValue("requested_ship_date", new Date().toISOString().slice(0, 10));
    }
  }, [form]);

  useEffect(() => {
    if (activeTab !== "create") return;
    const timer = setTimeout(() => clientTriggerRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof pickListSchema>) => createPickListFlow(values),
    onSuccess: async () => {
      toast.success("Pick list released");
      form.reset({
        warehouse_id: profile?.default_warehouse_id || undefined,
        client_id: undefined,
        order_number: "",
        requested_ship_date: new Date().toISOString().slice(0, 10),
        notes: "",
        lines: [{ product_id: "", quantity: 1 }],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pick-lists"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
      ]);
      setActiveTab("lists");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Pick list failed"),
  });

  const selectedWarehouseId = form.watch("warehouse_id");
  const { data: pickableStock } = useQuery({
    queryKey: ["pickable-stock-summary", selectedWarehouseId],
    queryFn: () => getPickableStockSummary(selectedWarehouseId || undefined),
    staleTime: 30_000,
  });

  const lines = form.watch("lines");
  const pickSearchTerm = pickSearch.trim().toLowerCase();
  const matchesPickSearch = (pickList: any) => {
    if (!pickSearchTerm) return true;
    const taskValues = (pickList.pick_tasks ?? []).flatMap((task: any) => [
      task.status,
      task.short_reason,
      task.quantity,
      task.pallets?.pallet_barcode,
      task.pallets?.pallet_code,
      task.pallets?.products?.sku,
      task.pallets?.products?.name,
    ]);
    return [
      pickList.pick_list_number,
      pickList.status,
      pickList.notes,
      pickList.order_number,
      ...taskValues,
    ].some((value) => String(value ?? "").toLowerCase().includes(pickSearchTerm));
  };
  const allActive = (pickLists as any[]).filter((pl) => !["completed", "cancelled"].includes(pl.status));
  const active = allActive.filter(matchesPickSearch);
  const done = (pickLists as any[]).filter((pl) => ["completed", "cancelled"].includes(pl.status)).filter(matchesPickSearch);
  // Only show products that have available qty in a known location for the
  // selected warehouse. While pickableStock is still loading (undefined) all
  // products are shown as a fallback so the form is never blank on first paint.
  const productOptions = (options?.products ?? [])
    .filter((product: any) => !pickableStock || pickableStock.has(product.id))
    .map((product: any) => {
      const summary = pickableStock?.get(product.id);
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        barcode: product.barcode,
        meta: summary
          ? {
              totalQty: summary.totalAvailable,
              palletCount: summary.palletCount,
              palletCode: summary.topPallet?.pallet_code,
              palletQty: summary.topPallet?.available_quantity,
              locationCode: summary.topPallet?.location_code,
            }
          : undefined,
      };
    });

  function prefetchPickExecution(pickListId: string) {
    void queryClient.prefetchQuery({
      queryKey: ["pick-execution", pickListId],
      queryFn: () => getPickExecution(pickListId),
    });
  }

  return (
    <Tabs className="flex flex-col gap-6" value={activeTab} onValueChange={setActiveTab}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Pick Lists</h2>
          <p className="text-sm text-muted-foreground">Release outbound work and execute scan-confirmed picks.</p>
        </div>
        <div className="flex min-w-0 gap-2 sm:min-w-80">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-9"
              value={pickSearch}
              onChange={(event) => setPickSearch(event.target.value)}
              placeholder="Search pick lists or barcodes"
            />
          </div>
          <BarcodeScanButton title="Scan pick list, pallet, or product barcode" onScan={(value) => setPickSearch(normalizeScannerText(value))} />
        </div>
      </div>
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
        <TabsTrigger value="lists" className="gap-2">
          Active Lists
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{allActive.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="create">Create Pick List</TabsTrigger>
      </TabsList>
      <TabsContent value="lists" className="grid gap-4">
        {active.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No active pick lists</p>
            <p className="mt-1 text-sm text-muted-foreground">Release a pick list from the Create tab, or go to Receiving to check inbound stock.</p>
            <Button className="mt-4" variant="outline" asChild>
              <Link to="/receiving">Go to Receiving</Link>
            </Button>
          </div>
        )}
        {active.map((pickList: any) => {
          const tasks: any[] = pickList.pick_tasks ?? [];
          const exceptionCount = tasks.filter((t) => t.status === "exception").length;
          const completedCount = tasks.filter((t) => t.status === "completed").length;
          return (
            <Card key={pickList.id} className={exceptionCount > 0 ? "border-destructive/60" : ""}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-base">{pickList.pick_list_number}</span>
                  <div className="flex items-center gap-2">
                    {exceptionCount > 0 && (
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {exceptionCount} short
                      </Badge>
                    )}
                    <Badge variant={statusBadgeVariant(pickList.status)}>{pickList.status}</Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  {pickList.notes || "Released outbound work"} · {completedCount}/{tasks.length} tasks done
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {tasks.map((task: any) => {
                  const product = task.pallets?.products as any;
                  return (
                    <div
                      key={task.id}
                      className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm ${task.status === "exception" ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{product?.name ?? "—"}</p>
                        {product?.sku && <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>}
                        {task.pallets?.pallet_barcode && (
                          <p className="font-mono text-xs text-muted-foreground">Pallet: {task.pallets.pallet_barcode}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">Qty {formatNumber(task.quantity)}</span>
                        <Badge variant={statusBadgeVariant(task.status)} className="text-xs">{task.status}</Badge>
                      </div>
                      {task.short_reason && (
                        <p className="w-full text-xs text-destructive">Short: {task.short_reason}</p>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/pick-lists/${pickList.id}`}
                      onMouseEnter={() => prefetchPickExecution(pickList.id)}
                      onFocus={() => prefetchPickExecution(pickList.id)}
                    >
                      Execute picks
                    </Link>
                  </Button>
                  {exceptionCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.warning("Short pick detected — check inventory levels or reassign stock from another location.", {
                        action: { label: "Inventory", onClick: () => navigate("/inventory-search") },
                        duration: 8000,
                      })}
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Resolve shortage
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        Cancel pick
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel pick list {pickList.pick_list_number}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This closes the pick list and cancels any open pick tasks. Completed picks remain recorded. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep pick list</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelMutation.mutate({ id: pickList.id })}
                        >
                          Cancel pick
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {done.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">▶ Show {done.length} completed / cancelled</span>
              <span className="hidden group-open:inline">▼ Hide completed / cancelled</span>
            </summary>
            <div className="mt-2 grid gap-2">
              {done.map((pl: any) => {
                const tasks: any[] = pl.pick_tasks ?? [];
                const completedCount = tasks.filter((task) => task.status === "completed").length;
                return (
                  <details key={pl.id} className="group rounded-md border border-border px-3 py-2 text-sm opacity-80">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate font-mono text-xs">{pl.pick_list_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {completedCount}/{tasks.length} tasks completed{pl.order_number ? ` · ${pl.order_number}` : ""}
                        </span>
                      </div>
                      <Badge variant={statusBadgeVariant(pl.status)} className="shrink-0 text-xs">{pl.status}</Badge>
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {tasks.length === 0 ? (
                        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">No task detail recorded.</p>
                      ) : (
                        tasks.map((task: any) => {
                          const product = task.pallets?.products as any;
                          const palletCode = task.pallets?.pallet_barcode ?? task.pallets?.pallet_code ?? "—";
                          return (
                            <div key={task.id} className="grid gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{product?.name ?? "—"}</p>
                                <p className="font-mono text-muted-foreground">
                                  {product?.sku ?? "No SKU"} · Pallet {palletCode} · {task.locations?.code ?? "No location"}
                                </p>
                                {task.short_reason ? <p className="text-destructive">Short: {task.short_reason}</p> : null}
                              </div>
                              <div className="flex items-center gap-2 sm:justify-end">
                                <span className="font-semibold">Qty {formatNumber(task.confirmed_quantity ?? task.quantity ?? task.requested_quantity ?? 0)}</span>
                                <Badge variant={statusBadgeVariant(task.status)} className="text-xs">{task.status}</Badge>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        )}
      </TabsContent>
      <TabsContent value="create">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <Form {...form}>
              <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <SelectField form={form} name="warehouse_id" label="Warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                        value={(field.value as string | undefined) ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger ref={clientTriggerRef}>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No client</SelectItem>
                          {(options?.clients ?? []).map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="order_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order number</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input {...field} value={field.value ?? ""} onChange={(event) => field.onChange(normalizeScannerText(event.target.value))} />
                          <BarcodeScanButton title="Scan order number" onScan={(value) => field.onChange(normalizeScannerText(value))} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <TextField form={form} name="requested_ship_date" label="Requested ship date" type="date" />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Order lines</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {lines.map((_, index) => (
                      <div key={index} className="grid gap-2">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_auto]">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.product_id`}
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel>Product</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <div className="min-w-0 flex-1">
                                    <ProductSearch
                                      ref={(node) => {
                                        pickProductRefs.current[index] = node;
                                      }}
                                      value={(field.value as string) ?? ""}
                                      onChange={field.onChange}
                                      options={productOptions}
                                      error={Boolean(fieldState.error)}
                                    />
                                  </div>
                                  <BarcodeScanButton
                                    title="Scan product barcode"
                                    onScan={(value) => {
                                      const matched = pickProductRefs.current[index]?.scanBarcode(value);
                                      if (matched) playBarcodeBeep();
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Qty</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                                  >
                                    −
                                  </Button>
                                  <Input
                                    {...field}
                                    type="number"
                                    className="text-center text-lg font-semibold"
                                    value={(field.value as number) ?? 1}
                                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => field.onChange(Number(field.value) + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          className="w-full lg:mt-auto lg:w-auto"
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("lines", lines.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          Remove
                        </Button>
                        </div>
                        {(() => {
                          const productId = lines[index]?.product_id as string | undefined;
                          const qty = Number(lines[index]?.quantity ?? 0);
                          const summary = productId ? pickableStock?.get(productId) : undefined;
                          if (!summary || !summary.topPallet) return null;
                          const over = qty > summary.totalAvailable;
                          return (
                            <div
                              className={`rounded-md border px-3 py-2 text-xs ${over ? "border-destructive/60 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}
                            >
                              <span className="font-mono">
                                Picks: {summary.topPallet.pallet_code} · Qty {summary.topPallet.available_quantity}
                                {summary.topPallet.location_code ? ` @ ${summary.topPallet.location_code}` : ""}
                                {summary.topPallet.expiry_date ? ` · Exp ${summary.topPallet.expiry_date}` : ""}
                              </span>
                              <span className="ml-2">
                                · {summary.palletCount} pallet{summary.palletCount === 1 ? "" : "s"} in stock (total {summary.totalAvailable})
                              </span>
                              {over && (
                                <p className="mt-1 font-medium">
                                  Only {summary.totalAvailable} in pickable locations — reduce qty or split the line.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => form.setValue("lines", [...lines, { product_id: "", quantity: 1 }])}>
                      Add line
                    </Button>
                  </CardContent>
                </Card>
                <Button
                  className="w-full lg:col-span-2"
                  type="submit"
                  disabled={
                    mutation.isPending ||
                    lines.some((line) => {
                      const summary = line.product_id ? pickableStock?.get(line.product_id) : undefined;
                      if (!summary) return false;
                      return Number(line.quantity ?? 0) > summary.totalAvailable;
                    })
                  }
                >
                  {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Release pick list
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}


export function TransfersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: transfers = [] } = useQuery({ queryKey: ["transfers"], queryFn: listTransfers });
  const [signoffCodes, setSignoffCodes] = useState<Record<string, string>>({});
  // Per-transfer cancel panel state
  const [cancelState, setCancelState] = useState<Record<string, { open: boolean; reason: string }>>({});
  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof transferSchema>) => createTransferFlow(values),
    onSuccess: async () => {
      toast.success("Transfer request created");
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Create transfer failed"),
  });

  const dispatchMutation = useMutation({
    mutationFn: async (transferId: string) => dispatchTransfer(transferId, signoffCodes[transferId] ?? ""),
    onSuccess: async () => {
      toast.success("Driver departure signed off — transfer dispatched");
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Transfer dispatch failed"),
  });

  const receiveMutation = useMutation({
    mutationFn: async (transferId: string) => receiveTransfer(transferId),
    onSuccess: async () => {
      toast.success("Transfer received — putaway task created", {
        action: { label: "Go to Put-Away", onClick: () => navigate("/putaway-tasks") },
        duration: 8000,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transfers"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Transfer receive failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ transferId, reason }: { transferId: string; reason: string }) =>
      cancelTransfer(transferId, reason),
    onSuccess: async (_data, variables) => {
      setCancelState((s) => ({ ...s, [variables.transferId]: { open: false, reason: "" } }));
      toast.warning("Transfer cancelled — stock returned to receiving", {
        action: { label: "Go to Receiving", onClick: () => navigate("/receiving") },
        duration: 8000,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transfers"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Cancel failed"),
  });

  const active = (transfers as any[]).filter((t) => !["completed", "cancelled"].includes(t.status));
  const done = (transfers as any[]).filter((t) => ["completed", "cancelled"].includes(t.status));

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Create Transfer</CardTitle>
          <CardDescription>Preserve pallet identity, lot data, ownership, and audit history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
              <SelectField form={form} name="transfer_type" label="Transfer type" options={[
                { label: "Inter-warehouse", value: "inter_warehouse" },
                { label: "Intra-warehouse", value: "intra_warehouse" },
              ]} />
              <SelectField form={form} name="source_warehouse_id" label="Source warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
              <SelectField form={form} name="destination_warehouse_id" label="Destination warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
              <SelectField form={form} name="pallet_id" label="Pallet" options={(options?.pallets ?? []).map((pallet) => ({ label: `${pallet.pallet_code} · ${pallet.status}`, value: pallet.id }))} />
              <TextField form={form} name="quantity" label="Quantity" type="number" />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button className="w-full sm:w-auto" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create transfer
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid min-w-0 content-start gap-4">
        {active.length === 0 && done.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Truck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No transfers yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a transfer to move pallets between warehouses or zones.</p>
          </div>
        )}
        {active.map((transfer: any) => {
          const lines: any[] = transfer.transfer_lines ?? [];
          const cs = cancelState[transfer.id] ?? { open: false, reason: "" };
          const codeEntered = !!(signoffCodes[transfer.id] ?? "").trim();
          return (
            <Card key={transfer.id} className={transfer.status === "exception" ? "border-destructive/60" : ""}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 font-mono text-base break-all">{transfer.transfer_number}</span>
                  <Badge variant={statusBadgeVariant(transfer.status)}>{transfer.status}</Badge>
                </CardTitle>
                <CardDescription>
                  {transfer.notes || "Pallet transfer"}
                  {transfer.dispatch_signed_off_at ? ` · departed ${formatDate(transfer.dispatch_signed_off_at)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {/* Pallet / product summary */}
                {lines.map((line: any) => {
                  const product = line.pallets?.products as any;
                  return (
                    <div key={line.id} className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2 text-sm">
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{product?.name ?? "—"}</p>
                        {product?.sku && <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>}
                        {line.pallets?.pallet_barcode && (
                          <p className="font-mono text-xs text-muted-foreground">Pallet: {line.pallets.pallet_barcode}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold">Qty {formatNumber(line.quantity)}</span>
                    </div>
                  );
                })}

                {/* Dispatch sign-off */}
                {transfer.status !== "completed" && transfer.status !== "cancelled" && (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <div>
                      <label className="text-sm font-medium" htmlFor={`signoff-${transfer.id}`}>Driver departure code</label>
                      <Input
                        id={`signoff-${transfer.id}`}
                        className="mt-1"
                        placeholder="Scan badge or enter user code"
                        value={signoffCodes[transfer.id] ?? ""}
                        onChange={(event) => setSignoffCodes((current) => ({ ...current, [transfer.id]: event.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => dispatchMutation.mutate(transfer.id)}
                      disabled={!codeEntered || transfer.status === "in_progress"}
                      title={!codeEntered ? "Enter driver code first" : undefined}
                    >
                      Dispatch
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => receiveMutation.mutate(transfer.id)}
                      disabled={transfer.status === "queued"}
                      title={transfer.status === "queued" ? "Dispatch before receiving" : undefined}
                    >
                      Receive
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Departure requires the signed-in driver/admin/manager to scan their badge or enter their user code.</p>

                {/* Cancel / reroute panel */}
                {!["completed", "cancelled"].includes(transfer.status) && !cs.open && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setCancelState((s) => ({ ...s, [transfer.id]: { open: true, reason: "" } }))}
                  >
                    <PackageX className="mr-1 h-3.5 w-3.5" />
                    Cancel transfer
                  </Button>
                )}
                {cs.open && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 grid gap-2">
                    <p className="text-sm font-medium text-destructive">Cancel this transfer?</p>
                    <p className="text-xs text-muted-foreground">Stock will be returned to Receiving and a new putaway task created.</p>
                    <Input
                      placeholder="Reason for cancellation (required)"
                      value={cs.reason}
                      onChange={(e) => setCancelState((s) => ({ ...s, [transfer.id]: { ...cs, reason: e.target.value } }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!cs.reason.trim() || cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate({ transferId: transfer.id, reason: cs.reason })}
                      >
                        Confirm cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCancelState((s) => ({ ...s, [transfer.id]: { open: false, reason: "" } }))}
                      >
                        Keep transfer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {done.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">▶ Show {done.length} completed / cancelled</span>
              <span className="hidden group-open:inline">▼ Hide completed / cancelled</span>
            </summary>
            <div className="mt-2 grid gap-2">
              {done.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm opacity-60">
                  <span className="font-mono text-xs">{t.transfer_number}</span>
                  <Badge variant={statusBadgeVariant(t.status)} className="text-xs">{t.status}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export function CycleCountsPage() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: counts = [] } = useQuery({ queryKey: ["cycle-counts"], queryFn: listCycleCounts });
  // Per-line "can't count" exception state
  const [exState, setExState] = useState<Record<string, { open: boolean; reason: string }>>({});

  const form = useForm<z.infer<typeof cycleCountSchema>>({
    resolver: zodResolver(cycleCountSchema),
    defaultValues: { scope: "spot", variance_threshold_percent: 5 },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof cycleCountSchema>) => createCycleCountFlow(values),
    onSuccess: async () => {
      toast.success("Count sheet generated");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Count creation failed"),
  });

  const submitMutation = useMutation({
    mutationFn: async ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      submitCycleCountLine(lineId, quantity),
    onSuccess: async (_data, variables) => {
      // Re-fetch to show variance badge immediately
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
      toast.success(`Count submitted for line`);
      void variables;
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Submit failed"),
  });

  const exceptionMutation = useMutation({
    mutationFn: async ({ lineId, reason }: { lineId: string; reason: string }) =>
      flagCountLineException(lineId, reason),
    onSuccess: async (_data, variables) => {
      setExState((s) => ({ ...s, [variables.lineId]: { open: false, reason: "" } }));
      toast.warning("Count line flagged as exception — supervisor review required");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Flag failed"),
  });

  const active = (counts as any[]).filter((c) => !["completed", "cancelled"].includes(c.status));
  const done = (counts as any[]).filter((c) => ["completed", "cancelled"].includes(c.status));

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Create Count</CardTitle>
          <CardDescription>Generate location, zone, SKU, or spot counts with approval thresholds.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
              <SelectField form={form} name="warehouse_id" label="Warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
              <SelectField form={form} name="scope" label="Scope" options={[
                { label: "Location", value: "location" },
                { label: "Zone", value: "zone" },
                { label: "SKU", value: "sku" },
                { label: "Spot", value: "spot" },
              ]} />
              <SelectField form={form} name="zone_id" label="Zone" options={(options?.zones ?? []).map((zone) => ({ label: zone.name, value: zone.id }))} />
              <SelectField form={form} name="location_id" label="Location" options={(options?.locations ?? []).map((location) => ({ label: location.code, value: location.id }))} />
              <SelectField form={form} name="product_id" label="Product" options={(options?.products ?? []).map((product) => ({ label: product.sku, value: product.id }))} />
              <TextField form={form} name="variance_threshold_percent" label="Variance threshold %" type="number" />
              <Button className="w-full sm:w-auto" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate count
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid min-w-0 content-start gap-4">
        {active.length === 0 && done.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No active counts</p>
            <p className="mt-1 text-sm text-muted-foreground">Generate a count sheet from the form to start a cycle count.</p>
          </div>
        )}
        {active.map((count: any) => {
          const lines: any[] = count.cycle_count_lines ?? [];
          const threshold = count.variance_threshold_percent ?? 5;
          const exceptionLines = lines.filter((l) => l.status === "exception").length;
          return (
            <Card key={count.id} className={exceptionLines > 0 ? "border-amber-500/60" : ""}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 font-mono text-base break-all">{count.count_number}</span>
                  <div className="flex items-center gap-2">
                    {exceptionLines > 0 && (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {exceptionLines} flagged
                      </Badge>
                    )}
                    <Badge variant={statusBadgeVariant(count.status)}>{count.status}</Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Scope: {count.scope} · Threshold: ±{threshold}% · {lines.filter((l) => l.status === "completed").length}/{lines.length} lines done
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {lines.map((line: any) => {
                  const product = line.products as any;
                  const loc = line.locations as any;
                  const counted = line.counted_quantity ?? line.expected_quantity;
                  const variance = line.variance_quantity ?? 0;
                  const varPct = line.variance_percent ?? 0;
                  const overThreshold = Math.abs(varPct) > threshold && line.status === "completed";
                  const es = exState[line.id] ?? { open: false, reason: "" };
                  const isException = line.status === "exception";

                  return (
                    <div
                      key={line.id}
                      className={`rounded-md border px-3 py-2 grid gap-2 text-sm ${isException ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" : overThreshold ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
                    >
                      {/* Product + location header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {product?.name && <p className="font-medium truncate">{product.name}</p>}
                          {product?.sku && <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>}
                          {loc?.code && <p className="text-xs text-muted-foreground">Location: {loc.code}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {overThreshold && (
                            <Badge variant="destructive" className="text-xs">
                              {variance > 0 ? "+" : ""}{variance} ({varPct.toFixed(1)}%)
                            </Badge>
                          )}
                          <Badge variant={statusBadgeVariant(line.status)} className="text-xs">{line.status}</Badge>
                        </div>
                      </div>

                      {/* Count input */}
                      {!isException && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground shrink-0">Expected {formatNumber(line.expected_quantity)}</span>
                          <Input
                            className="w-28"
                            defaultValue={counted}
                            type="number"
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (!isNaN(val)) submitMutation.mutate({ lineId: line.id, quantity: val });
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Flag as unable to count"
                            onClick={() => setExState((s) => ({ ...s, [line.id]: { open: true, reason: "" } }))}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {isException && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="inline mr-1 h-3 w-3" />
                          {(line as any).notes ?? "Flagged — supervisor review required"}
                        </p>
                      )}

                      {/* Exception panel */}
                      {es.open && (
                        <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 grid gap-2">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Why can't this line be counted?</p>
                          <Input
                            placeholder="e.g. Location blocked, pallet damaged, goods in use"
                            value={es.reason}
                            onChange={(e) => setExState((s) => ({ ...s, [line.id]: { ...es, reason: e.target.value } }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-500 text-amber-700"
                              disabled={!es.reason.trim() || exceptionMutation.isPending}
                              onClick={() => exceptionMutation.mutate({ lineId: line.id, reason: es.reason })}
                            >
                              Flag exception
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExState((s) => ({ ...s, [line.id]: { open: false, reason: "" } }))}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
        {done.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">▶ Show {done.length} completed / cancelled</span>
              <span className="hidden group-open:inline">▼ Hide completed / cancelled</span>
            </summary>
            <div className="mt-2 grid gap-2">
              {done.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm opacity-60">
                  <span className="font-mono text-xs">{c.count_number}</span>
                  <Badge variant={statusBadgeVariant(c.status)} className="text-xs">{c.status}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// ── Location Moves Page ────────────────────────────────────────────────────────
export function LocationMovesPage() {
  const queryClient = useQueryClient();
  const [newPallet, setNewPallet] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newReason, setNewReason] = useState("");
  const newPalletRef = useRef<HTMLInputElement | null>(null);
  const newLocationRef = useRef<HTMLInputElement | null>(null);
  const [scanState, setScanState] = useState<Record<string, { pallet: string; location: string }>>({});
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const invalidateMoveData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["move-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
    ]);
  }, [queryClient]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["move-tasks"],
    queryFn: listMoveTasks,
  });

  const directMoveMutation = useMutation({
    mutationFn: ({ pallet, location, reason }: { pallet: string; location: string; reason?: string }) =>
      completeDirectMove(pallet, location, reason),
    onSuccess: async () => {
      toast.success("Move confirmed — pallet relocated");
      setNewPallet(""); setNewLocation(""); setNewReason("");
      await invalidateMoveData();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Move failed"),
  });

  const completeMutation = useMutation({
    mutationFn: ({ taskId, pallet, location }: { taskId: string; pallet: string; location: string }) =>
      completeMoveTask(taskId, pallet, location),
    onSuccess: async (_, vars) => {
      toast.success("Move confirmed — pallet relocated");
      setCompletedIds((prev) => new Set([...prev, vars.taskId]));
      await invalidateMoveData();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Move failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => cancelMoveTask(taskId),
    onSuccess: async (_, taskId) => {
      toast.warning("Move task cancelled");
      setCancelledIds((prev) => new Set([...prev, taskId]));
      await invalidateMoveData();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Cancel failed"),
  });

  function completeNewMove(pallet = newPallet, location = newLocation) {
    const trimmedPallet = pallet.trim();
    const trimmedLocation = location.trim().toUpperCase();
    if (!trimmedPallet || !trimmedLocation || directMoveMutation.isPending) return;
    directMoveMutation.mutate({
      pallet: trimmedPallet,
      location: trimmedLocation,
      reason: newReason.trim() || undefined,
    });
  }

  function applyNewPalletScan(value: unknown) {
    const pallet = normalizeScannerText(value);
    setNewPallet(pallet);
    playBarcodeBeep();
    flashInput(newPalletRef.current, "blue");
    setTimeout(() => newLocationRef.current?.focus(), 50);
  }

  function applyNewLocationScan(value: unknown) {
    if (!newPallet.trim()) {
      toast.error("Scan the pallet first.");
      flashInput(newPalletRef.current, "orange");
      newPalletRef.current?.focus();
      return;
    }
    const location = normalizeScannerText(value);
    setNewLocation(location);
    playBarcodeBeep();
    flashInput(newLocationRef.current, isBaySelectorCode(location) ? "orange" : "blue");
    if (!isBaySelectorCode(location)) {
      completeNewMove(newPallet, location);
    }
  }

  function selectNewMoveLocation(locationCode: string) {
    setNewLocation(locationCode);
    playBarcodeBeep();
    flashInput(newLocationRef.current, "blue");
    completeNewMove(newPallet, locationCode);
  }

  const pending = (tasks as any[]).filter((t) => !completedIds.has(t.id) && !cancelledIds.has(t.id) && !["completed", "cancelled"].includes(t.status));
  const done    = (tasks as any[]).filter((t) =>  completedIds.has(t.id) || cancelledIds.has(t.id) || ["completed", "cancelled"].includes(t.status));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Location Moves</h2>
        <p className="text-sm text-muted-foreground">Relocate a pallet within the warehouse — inventory quantity is unchanged.</p>
      </div>

      {/* Create new move task */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Move Task</CardTitle>
          <CardDescription>Scan the pallet barcode and target location to complete a move.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2">
              <Input
                ref={newPalletRef}
                className="flex-1"
                placeholder="Pallet barcode"
                value={newPallet}
                onChange={(e) => setNewPallet(normalizeScannerText(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    newLocationRef.current?.focus();
                  }
                }}
              />
              <BarcodeScanButton title="Scan pallet" onScan={applyNewPalletScan} />
            </div>
            <div className="flex gap-2">
              <Input
                ref={newLocationRef}
                className="flex-1"
                placeholder="Target location (e.g. A-01-01)"
                value={newLocation}
                disabled={!newPallet.trim()}
                onChange={(e) => setNewLocation(normalizeScannerText(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && completeNewMove()}
              />
              <BarcodeScanButton
                title="Scan target location"
                onScan={applyNewLocationScan}
              />
            </div>
          </div>
          {newPallet.trim() && isBaySelectorCode(newLocation) ? (
            <BayOccupancyGrid locationCode={newLocation} onSelect={selectNewMoveLocation} />
          ) : null}
          <Input
            placeholder="Reason (optional — e.g. aisle blocked, consolidation)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={directMoveMutation.isPending || !newPallet || !newLocation}
            onClick={() => completeNewMove()}
          >
            {directMoveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Complete Move
          </Button>
        </CardContent>
      </Card>

      {/* Pending tasks */}
      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : pending.length === 0 && done.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium">No move tasks yet</p>
            <p>Use the form above to queue a pallet relocation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((task: any) => {
            const local = scanState[task.id] ?? { pallet: "", location: "" };
            const fromLoc = (task.from_location as any)?.code ?? "—";
            const toLoc   = (task.to_location   as any)?.code ?? "—";
            const sku     = (task.pallets as any)?.products?.sku ?? "";
            const name    = (task.pallets as any)?.products?.name ?? "";
            const pBarcode = (task.pallets as any)?.pallet_barcode ?? "";

            return (
              <Card key={task.id} className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="font-mono">{task.task_number}</span>
                    <Badge variant={task.status === "queued" ? "secondary" : "default"}>{task.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    <span className="font-medium text-foreground">{sku}{sku && name ? " · " : ""}{name}</span>
                    {sku || name ? " — " : ""}<span className="font-mono">{pBarcode}</span>
                    <br />
                    <span className="font-mono text-xs">{fromLoc}</span>
                    <ArrowLeftRight className="inline mx-1 h-3 w-3" />
                    <span className="font-mono text-xs font-semibold">{toLoc}</span>
                    {task.reason && <span className="ml-2 text-xs text-muted-foreground">· {task.reason}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="flex gap-2">
                      <Input
                        className="min-h-12 flex-1 text-base"
                        placeholder={`Scan pallet (${pBarcode})`}
                        value={local.pallet}
                        onChange={(e) => setScanState((s) => ({ ...s, [task.id]: { ...local, pallet: normalizeScannerText(e.target.value) } }))}
                      />
                      <BarcodeScanButton
                        title="Scan pallet barcode"
                        onScan={(v) => setScanState((s) => ({ ...s, [task.id]: { ...local, pallet: normalizeScannerText(v) } }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        className="min-h-12 flex-1 text-base"
                        placeholder={`Scan target location (${toLoc})`}
                        value={local.location}
                        onChange={(e) => setScanState((s) => ({ ...s, [task.id]: { ...local, location: normalizeScannerText(e.target.value) } }))}
                      />
                      <BarcodeScanButton
                        title="Scan target location"
                        onScan={(v) => setScanState((s) => ({ ...s, [task.id]: { ...local, location: normalizeScannerText(v) } }))}
                      />
                    </div>
                  </div>
                  <Button
                    className="min-h-12 w-full text-base"
                    disabled={completeMutation.isPending || !local.pallet || !local.location}
                    onClick={() => completeMutation.mutate({ taskId: task.id, pallet: local.pallet, location: local.location })}
                  >
                    {completeMutation.isPending ? <Loader2 className="animate-spin" /> : <ArrowLeftRight data-icon="inline-start" />}
                    Confirm Move
                  </Button>
                  {["queued", "in_progress"].includes(task.status) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                          <PackageX className="mr-2 h-4 w-4" />
                          Cancel move
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel move {task.task_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This clears the queued move from active work and dashboard counts. The pallet will stay in its current location.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep move</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelMutation.mutate(task.id)}>
                            Cancel move
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground select-none">
                {done.length} completed move{done.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {done.map((task: any) => {
                  const fromLoc = (task.from_location as any)?.code ?? "—";
                  const toLoc   = (task.to_location   as any)?.code ?? "—";
                  const pBarcode = (task.pallets as any)?.pallet_barcode ?? "";
                  const isCancelled = cancelledIds.has(task.id) || task.status === "cancelled";
                  return (
                    <Card key={task.id} className="opacity-60">
                      <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
                        <div className="text-sm">
                          <span className="font-mono text-xs">{task.task_number}</span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="font-mono text-xs">{pBarcode}</span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="font-mono text-xs">{fromLoc}</span>
                          <ArrowLeftRight className="inline mx-1 h-3 w-3" />
                          <span className="font-mono text-xs">{toLoc}</span>
                        </div>
                        <Badge variant={isCancelled ? "destructive" : "default"}>{isCancelled ? "cancelled" : "completed"}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function StatusPage() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["status-pallets"], queryFn: listStatusPallets });
  const form = useForm<z.infer<typeof statusChangeSchema>>({
    resolver: zodResolver(statusChangeSchema),
  });
  const mutation = useMutation({
    mutationFn: changePalletStatus,
    onSuccess: async () => {
      toast.success("Status updated");
      form.reset({ pallet_id: "", reason: "" } as any);
      await queryClient.invalidateQueries({ queryKey: ["status-pallets"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Status update failed"),
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Status Controls</CardTitle>
          <CardDescription>Move pallets into hold, quarantine, damage, available, or missing with audit logging.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <TextField form={form} name="pallet_id" label="Pallet barcode or ID" />
              <SelectField form={form} name="new_status" label="New status" options={[
                { label: "Hold", value: "hold" },
                { label: "Quarantine", value: "quarantine" },
                { label: "Damaged", value: "damaged" },
                { label: "Available", value: "available" },
                { label: "Missing", value: "missing" },
              ]} />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit">Apply status</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Controlled stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.map((row: any) => (
            <div key={row.inventory_balance_id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">{row.sku}</p>
                <p className="text-sm text-muted-foreground">{row.pallet_code} · {row.location_code ?? "No location"}</p>
              </div>
              <Badge>{row.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: getReportData });
  const { data: metrics } = useQuery({ queryKey: ["dashboard-metrics", "reports"], queryFn: () => getDashboardMetrics() });
  const snapshot = useMemo(() => buildEnterpriseDashboard(metrics, data), [metrics, data]);
  const exportRows = useMemo(() => buildCsvReportRows(data), [data]);

  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data?.inventory ?? []) {
      map.set(row.warehouse_code, (map.get(row.warehouse_code) ?? 0) + row.available_quantity);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">Saved-style operational reporting, CSV export, AI recommendations, and Six Sigma signals.</p>
        </div>
        <Button variant="outline" onClick={() => downloadCsv("enterprise-inventory-report.csv", exportRows)}>
          <Download data-icon="inline-start" />
          Export inventory CSV
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.officeWidgets.map((widget) => (
          <Card key={widget.label} className={cn("border-l-4", toneBorder(widget.tone))}>
            <CardHeader>
              <CardDescription>{widget.label}</CardDescription>
              <CardTitle className="text-3xl">{widget.value}</CardTitle>
              <CardDescription>{widget.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock by warehouse</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : stockByWarehouse.map(([warehouse, quantity]) => (
              <div key={warehouse} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span>{warehouse}</span>
                <span>{formatNumber(quantity)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Occupancy view</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(data?.occupancy ?? []).slice(0, 12).map((location: any) => (
              <div key={location.location_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p>{location.location_code}</p>
                  <p className="text-xs text-muted-foreground">{location.temperature_class}</p>
                </div>
                <Badge variant={location.is_full ? "destructive" : "secondary"}>
                  {location.occupied_pallets}/{location.max_pallets}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Saved report catalog</CardTitle>
            <CardDescription>Decision-ready report outputs for managers, clerks, and auditors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["Expiration risk", "Lots approaching FEFO cutoff by SKU, warehouse, and customer owner", "CSV"],
              ["Low stock warnings", "Balances at or below replenishment threshold with NetSuite sync status", "CSV"],
              ["Low turn stock", "Slow-moving inventory candidates for slotting or commercial review", "CSV"],
              ["Dock performance", "Staged, loaded, blocked, delayed, and route handoff timings", "CSV"],
              ["Six Sigma variance", "Cycle-count defects, DPMO, root cause, and corrective action fields", "CSV"],
            ].map(([title, description, output]) => (
              <div key={title} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Badge variant="outline">{output}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <WarehouseBrainPanel recommendations={snapshot.recommendations} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(data?.audits ?? []).map((audit: any) => (
            <div key={audit.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{audit.event_type}</span>
                <span className="text-xs text-muted-foreground">{formatDate(audit.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{audit.entity_table} · {audit.entity_id}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const inviteUserSchema = z.object({
  email: z.string().email("Valid email required"),
  full_name: z.string().min(2, "Name required"),
  password: z.string().min(8, "Min 8 characters"),
  role_code: z.string().optional(),
  warehouse_id: z.string().optional(),
});

function AddUserDialog({
  roles,
  warehouses,
  onSuccess,
}: {
  roles: Array<{ id: string; code: string; name: string }>;
  warehouses: WarehouseOption[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof inviteUserSchema>>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", full_name: "", password: "", role_code: "", warehouse_id: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof inviteUserSchema>) =>
      adminInviteUser({
        email: values.email,
        full_name: values.full_name,
        password: values.password,
        role_code: values.role_code || undefined,
        warehouse_id: values.warehouse_id || undefined,
      } as AdminInviteUserInput),
    onSuccess: () => {
      toast.success("User created and approved");
      form.reset();
      setOpen(false);
      onSuccess();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create user"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>Create a new warehouse user. They will be pre-approved and can sign in immediately.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Jane Smith" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="jane@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary Password</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="Min 8 characters" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="role_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value ? field.value : "__none__"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No role assigned</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.code} value={role.code}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="warehouse_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse (optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__all__" ? "" : v)} value={field.value ? field.value : "__all__"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All warehouses" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">All warehouses</SelectItem>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create User
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersRolesPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const canOperateRoles = roles.some((r) => ["developer", "admin"].includes(r));
  const canOperateDeveloperRole = roles.includes("developer");
  const [includeHidden, setIncludeHidden] = useState(false);
  const { data: options } = useQuery({ queryKey: ["options", includeHidden], queryFn: () => fetchOptions(includeHidden) });
  const { data: activities = [] } = useQuery({ queryKey: ["user-activities"], queryFn: () => listUserActivities() });
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [activeTab, setActiveTab] = useState("users");

  const invalidateOptions = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["options"] }),
      queryClient.invalidateQueries({ queryKey: ["user-activities"] }),
    ]);
  }, [queryClient]);

  const assignMutation = useMutation({
    mutationFn: async () => upsertRecord("user_roles", { user_id: selectedProfile, role_id: selectedRole }),
    onSuccess: async () => {
      toast.success("Role assigned");
      setSelectedProfile("");
      setSelectedRole("");
      await invalidateOptions();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to assign role"),
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ userRoleId, hidden }: { userRoleId: string; hidden: boolean }) =>
      setUserRoleVisibility(userRoleId, hidden, hidden ? "Access hidden from user management" : undefined),
    onSuccess: async (_, variables) => {
      toast.success(variables.hidden ? "Role assignment hidden" : "Role assignment restored");
      await invalidateOptions();
    },
  });

  const profileMutation = useMutation({
    mutationFn: async ({ profileId, active }: { profileId: string; active: boolean }) => setProfileActive(profileId, active),
    onSuccess: async (_, variables) => {
      toast.success(variables.active ? "Profile enabled" : "Profile disabled");
      await invalidateOptions();
    },
  });

  const profileEditMutation = useMutation({
    mutationFn: async ({
      values,
      newPassword,
      badgePin,
    }: {
      values: Parameters<typeof updateProfileDetails>[0];
      newPassword?: string;
      badgePin?: string;
    }) => {
      await updateProfileDetails(values);
      if (newPassword) {
        await adminUpdateUserPassword(values.profileId, newPassword);
      }
      if (badgePin) {
        await adminUpdateUserPin(values.profileId, badgePin);
      }
    },
    onSuccess: async () => {
      toast.success("User updated");
      await invalidateOptions();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const profiles = (options?.profiles ?? []) as ProfileRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage warehouse users, roles, and access permissions.</p>
        </div>
        <AddUserDialog
          roles={(options?.roles ?? []) as Array<{ id: string; code: string; name: string }>}
          warehouses={(options?.warehouses ?? []) as WarehouseOption[]}
          onSuccess={invalidateOptions}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap items-stretch justify-start gap-1 sm:w-fit">
          <TabsTrigger value="users" className="min-h-9 flex-1 gap-1.5 sm:flex-none">
            <Users className="h-3.5 w-3.5" />
            Users ({profiles.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="min-h-9 flex-1 gap-1.5 sm:flex-none">
            <ShieldCheck className="h-3.5 w-3.5" />
            Access
          </TabsTrigger>
          <TabsTrigger value="role-matrix" className="min-h-9 flex-1 gap-1.5 sm:flex-none">
            <ShieldCheck className="h-3.5 w-3.5" />
            Role Matrix
          </TabsTrigger>
          <TabsTrigger value="activity" className="min-h-9 flex-1 gap-1.5 sm:flex-none">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="text-sm text-muted-foreground">{profiles.length} user{profiles.length !== 1 ? "s" : ""}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIncludeHidden((c) => !c)}
              className="text-xs"
            >
              {includeHidden ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
              {includeHidden ? "Hide inactive" : "Show inactive"}
            </Button>
          </div>
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <UserProfileRow
                key={profile.id}
                profile={profile}
                warehouses={(options?.warehouses ?? []) as WarehouseOption[]}
                userRoles={(options?.userRoles ?? []).filter((ur: any) => ur.user_id === profile.id)}
                onSave={(values, credentials) => profileEditMutation.mutate({ values, ...credentials })}
                onToggleActive={() =>
                  profileMutation.mutate({ profileId: profile.id, active: !(profile.active ?? true) })
                }
              />
            ))}
            {profiles.length === 0 && (
              <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No users found. Use "Add User" to create the first one.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            {canOperateRoles && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assign Role</CardTitle>
                  <CardDescription>Add a role to an existing user account.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name ?? profile.email ?? profile.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {(options?.roles ?? [])
                        .filter((role: any) => canOperateDeveloperRole || role.code !== "developer")
                        .map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!selectedProfile || !selectedRole || assignMutation.isPending}
                    onClick={() => assignMutation.mutate()}
                    className="w-full"
                  >
                    {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Assign role
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className={canOperateRoles ? "" : "xl:col-span-full"}>
              <CardHeader>
                <CardTitle className="text-base">Current Access</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(options?.userRoles ?? [])
                  .filter((userRole: any) => canOperateDeveloperRole || (userRole.roles as { code?: string } | null)?.code !== "developer")
                  .map((userRole: any) => {
                    const profile = profiles.find((p) => p.id === userRole.user_id);
                    return (
                      <div key={userRole.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-muted text-xs">
                              {(profile?.full_name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{profile?.full_name ?? userRole.user_id}</p>
                            <p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={userRole.is_hidden ? "secondary" : "default"} className="text-xs">
                            {(userRole.roles as { name?: string } | null)?.name ?? "Role"}
                          </Badge>
                          {canOperateRoles && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => visibilityMutation.mutate({ userRoleId: userRole.id, hidden: !userRole.is_hidden })}
                            >
                              {userRole.is_hidden ? "Restore" : "Revoke"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="role-matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Matrix</CardTitle>
              <CardDescription>Your current role assignments and their access scope.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {roles
                .filter((role) => canOperateRoles || role !== "developer")
                .map((role) => (
                  <div key={role} className="rounded-lg border border-border px-3 py-2">
                    <p className="font-medium">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS] ?? "Warehouse system access"}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Sign-ins, profile changes, and role assignments.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(activities as UserActivityRow[]).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
              )}
              {(activities as UserActivityRow[]).map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{activity.event_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.profiles?.full_name ?? activity.actor_user_id ?? "System"} · {activity.entity_table}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(activity.created_at)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isWeakBadgePin(pin: string) {
  const easyPins = new Set([
    "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
    "1234", "12345", "123456", "1234567", "4321", "54321", "654321", "7654321",
    "2580", "0852", "1212", "1122", "6969", "1010", "2020", "1230", "7890",
  ]);
  if (!/^\d{4,7}$/.test(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true;
  if (easyPins.has(pin)) return true;
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return true;
  return false;
}

function printUserBadge({
  badgeCode,
  fullName,
  phone,
  roles,
}: {
  badgeCode: string;
  fullName: string;
  phone: string;
  roles: string[];
}) {
  const qrSvg = renderToStaticMarkup(
    <QRCodeSVG value={badgeCode} size={210} bgColor="#ffffff" fgColor="#000000" level="M" />,
  );
  const roleText = roles.length > 0 ? roles.join(", ") : "No assigned role";
  const printWindow = window.open("", "_blank", "width=420,height=360");
  if (!printWindow) {
    toast.error("Popup blocked. Allow popups to print the badge.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(fullName || "User badge")}</title>
        <style>
          @page { size: 3in 2.5in; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 3in;
            height: 2.5in;
            font-family: Arial, sans-serif;
            color: #102033;
            background: #ffffff;
          }
          .badge {
            width: 3in;
            height: 2.5in;
            display: grid;
            grid-template-columns: 1fr 0.95in;
            gap: 0.12in;
            padding: 0.18in;
            border: 1px solid #102033;
          }
          .brand {
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #0f766e;
          }
          .name {
            margin-top: 0.18in;
            font-size: 17pt;
            line-height: 1.05;
            font-weight: 800;
          }
          .meta {
            margin-top: 0.08in;
            font-size: 8.5pt;
            line-height: 1.25;
          }
          .qr {
            align-self: center;
            justify-self: center;
            width: 0.95in;
            height: 0.95in;
          }
          .code {
            grid-column: 1 / -1;
            align-self: end;
            font-family: "Courier New", monospace;
            font-size: 8pt;
            letter-spacing: 0.08em;
            color: #334155;
          }
          svg { width: 100%; height: 100%; display: block; }
        </style>
      </head>
      <body>
        <main class="badge">
          <section>
            <div class="brand">Warehouse Wizard</div>
            <div class="name">${escapeHtml(fullName || "Warehouse User")}</div>
            <div class="meta">
              <strong>Phone</strong><br>${escapeHtml(phone || "Not set")}<br><br>
              <strong>Role</strong><br>${escapeHtml(roleText)}
            </div>
          </section>
          <section class="qr">${qrSvg}</section>
          <div class="code">${escapeHtml(badgeCode)}</div>
        </main>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function UserProfileRow({
  profile,
  warehouses,
  userRoles,
  onSave,
  onToggleActive,
}: {
  profile: ProfileRow;
  warehouses: WarehouseOption[];
  userRoles: any[];
  onSave: (
    values: Parameters<typeof updateProfileDetails>[0],
    credentials?: { newPassword?: string; badgePin?: string },
  ) => void;
  onToggleActive: () => void;
}) {
  const { roles: viewerRoles } = useAuth();
  const targetIsDeveloper = userRoles.some((ur: any) => (ur.roles as { code?: string } | null)?.code === "developer");
  const canChangePassword = viewerRoles.includes("developer") || !targetIsDeveloper;

  const [open, setOpen] = useState(false);
  const fallbackWarehouseId = !profile.default_warehouse_id && warehouses.length === 1 ? warehouses[0]?.id ?? "" : "";
  const [values, setValues] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    default_warehouse_id: profile.default_warehouse_id ?? fallbackWarehouseId,
    active: profile.active ?? true,
    approved: profile.approved ?? false,
    user_code: profile.user_code ?? "",
    badge_code: profile.badge_code ?? "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [badgePin, setBadgePin] = useState("");

  useEffect(() => {
    if (!profile.default_warehouse_id && warehouses.length === 1 && !values.default_warehouse_id) {
      setValues((current) => ({ ...current, default_warehouse_id: warehouses[0]?.id ?? "" }));
    }
  }, [profile.default_warehouse_id, values.default_warehouse_id, warehouses]);

  const initials = (profile.full_name ?? profile.email ?? "?")
    .split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

  const roleNames = userRoles
    .filter((ur) => !ur.is_hidden)
    .map((ur) => (ur.roles as { name?: string } | null)?.name ?? "")
    .filter(Boolean);
  const hasBadgeCode = values.badge_code.trim().length > 0;

  const handlePrintBadge = () => {
    if (!hasBadgeCode) return;
    printUserBadge({
      badgeCode: values.badge_code.trim(),
      fullName: values.full_name.trim(),
      phone: values.phone.trim(),
      roles: roleNames,
    });
  };

  const handleSave = () => {
    const trimmedPassword = newPassword.trim();
    const trimmedBadgePin = badgePin.trim();
    if (trimmedPassword && trimmedBadgePin) {
      toast.error("Set either a new password or a badge PIN, not both.");
      return;
    }
    if (trimmedPassword && trimmedPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (trimmedBadgePin && isWeakBadgePin(trimmedBadgePin)) {
      toast.error("Badge PIN must be 4-7 digits and not an easy sequence or repeated code.");
      return;
    }
    onSave(
      { profileId: profile.id, ...values },
      {
        newPassword: trimmedPassword || undefined,
        badgePin: trimmedBadgePin || undefined,
      },
    );
    setOpen(false);
  };

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card transition-colors",
      !profile.active && "opacity-60"
    )}>
      <div className="flex items-center gap-3 p-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className={cn(
            "text-sm font-semibold",
            profile.approved ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{profile.full_name ?? profile.email ?? profile.id}</p>
            <Badge
              variant={profile.approved ? "default" : "secondary"}
              className="text-xs"
            >
              {profile.approved ? "Approved" : "Pending"}
            </Badge>
            {!profile.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{profile.email}</span>
            {profile.user_code && <span>· {profile.user_code}</span>}
            {roleNames.length > 0 && (
              <span className="flex items-center gap-1">
                ·
                {roleNames.map((name) => (
                  <Badge key={name} variant="outline" className="text-xs px-1.5 py-0">{name}</Badge>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={onToggleActive}
          >
            {profile.active ? "Disable" : "Enable"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update operational access, codes, and approval status.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Full name</label>
                      <Input value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Phone</label>
                      <Input value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">User code</label>
                      <Input value={values.user_code} placeholder="e.g. OPR02" onChange={(e) => setValues((v) => ({ ...v, user_code: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Badge code</label>
                      <Input value={values.badge_code} placeholder="e.g. BADGE-OPR02" onChange={(e) => setValues((v) => ({ ...v, badge_code: e.target.value }))} />
                    </div>
                    {canChangePassword && (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <label className="text-sm font-medium">Badge sign-in PIN</label>
                        <Input
                          value={badgePin}
                          inputMode="numeric"
                          maxLength={7}
                          placeholder="Leave blank to keep current PIN"
                          onChange={(e) => setBadgePin(e.target.value.replace(/\D/g, "").slice(0, 7))}
                        />
                        <p className="text-xs text-muted-foreground">Use 4-7 digits. Repeated or sequential codes are blocked.</p>
                      </div>
                    )}
                    <div className="grid gap-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Default warehouse</label>
                      <Select
                        value={values.default_warehouse_id || "none"}
                        onValueChange={(val) => setValues((v) => ({ ...v, default_warehouse_id: val === "none" ? "" : val }))}
                      >
                        <SelectTrigger><SelectValue placeholder="No default" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No default warehouse</SelectItem>
                          {warehouses.map((wh) => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent">
                      <Checkbox
                        checked={values.active}
                        onCheckedChange={(c) => setValues((v) => ({ ...v, active: Boolean(c) }))}
                      />
                      <div>
                        <p className="font-medium">Active</p>
                        <p className="text-xs text-muted-foreground">Can sign in</p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent">
                      <Checkbox
                        checked={values.approved}
                        onCheckedChange={(c) => setValues((v) => ({ ...v, approved: Boolean(c) }))}
                      />
                      <div>
                        <p className="font-medium">Approved</p>
                        <p className="text-xs text-muted-foreground">Admin confirmed</p>
                      </div>
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {canChangePassword ? (
                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">New password</label>
                        <Input
                          type="password"
                          value={newPassword}
                          placeholder="Leave blank to keep current"
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                    ) : (
                      <p className="self-center text-xs text-muted-foreground">Password changes for developer accounts are restricted.</p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="self-end"
                      disabled={!hasBadgeCode}
                      title={hasBadgeCode ? "Print badge" : "Enter a badge code before printing"}
                      onClick={handlePrintBadge}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print badge
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSave}
                  >
                    Save changes
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

const MODULE_GROUPS: { label: string; keys: ModuleKey[] }[] = [
  {
    label: "Core Operations",
    keys: ["receiving", "putaway", "inventory", "pick-lists", "location-moves", "transfers"],
  },
  {
    label: "Master Data",
    keys: ["products", "warehouses", "zones", "locations", "users", "settings", "clients", "packaging"],
  },
  {
    label: "Advanced",
    keys: ["cycle-counts", "reports", "status", "system-log", "email-log"],
  },
];

function ModulesSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { flags, toolbarModules, isToolbarModule, setModule, setToolbarModule, resetToStarter } = useFeatureFlags();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Module Visibility</CardTitle>
            <CardDescription>
              Hide modules that aren't needed for your operation. Hidden modules remain fully functional — they just won't appear in the navigation.
              {!isAdmin && " Admin access required to change module settings."}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={resetToStarter}>
              Reset to Starter defaults
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {MODULE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="flex flex-col gap-3">
                {group.keys.map((key) => {
                  const meta = MODULE_LABELS[key];
                  const enabled = flags[key] ?? STARTER_MODULES[key];
                  const pinned = isToolbarModule(key);
                  const toolbarDisabled = !isAdmin || (!pinned && (!enabled || toolbarModules.length >= 4));
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant={pinned ? "secondary" : "ghost"}
                          className="h-8 w-8"
                          disabled={toolbarDisabled}
                          onClick={() => setToolbarModule(key, !pinned)}
                          title={pinned ? `Remove ${meta.label} from mobile toolbar` : `Add ${meta.label} to mobile toolbar`}
                          aria-label={pinned ? `Remove ${meta.label} from mobile toolbar` : `Add ${meta.label} to mobile toolbar`}
                        >
                          <Star className={cn("h-4 w-4", pinned && "fill-current")} />
                        </Button>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => setModule(key, v)}
                          disabled={!isAdmin}
                          aria-label={`Toggle ${meta.label}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const { roles } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const canViewUsersRoles = roles.some((r) => ["developer", "admin", "warehouse_manager", "warehouse_supervisor"].includes(r));
  const isDeveloperOrAdmin = roles.some((r) => ["developer", "admin"].includes(r));
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: resetWmsData,
    onSuccess: async (result) => {
      const removed =
        (result as { deleted_users?: number; removed_users?: number } | null)?.removed_users ??
        (result as { deleted_users?: number; removed_users?: number } | null)?.deleted_users ??
        0;
      toast.success(`Reset complete. Removed ${removed} user account${removed === 1 ? "" : "s"}.`);
      await invalidateWarehouseData(queryClient);
      navigate("/setup-wizard");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reset failed"),
  });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetChallenge, setResetChallenge] = useState("");
  const resetReady = resetChallenge.trim() === "RESET ALL";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Warehouse environment, client configuration, and system management.</p>
      </div>
      <Tabs defaultValue={canViewUsersRoles ? "users-roles" : "modules"}>
        <TabsList className="flex h-auto w-full flex-wrap items-stretch justify-start gap-1 sm:w-fit">
          {canViewUsersRoles && (
            <TabsTrigger value="users-roles" className="min-h-9 flex-1 gap-1.5 sm:flex-none"><Users className="h-3.5 w-3.5" />Users & Roles</TabsTrigger>
          )}
          <TabsTrigger value="modules" className="min-h-9 flex-1 sm:flex-none">Modules</TabsTrigger>
          <TabsTrigger value="environment" className="min-h-9 flex-1 sm:flex-none">Environment</TabsTrigger>
          {isEnabled("clients") && (
            <TabsTrigger value="client-vars" className="min-h-9 flex-1 sm:flex-none">Client Variables</TabsTrigger>
          )}
          <TabsTrigger value="about" className="min-h-9 flex-1 gap-1.5 sm:flex-none"><Info className="h-3.5 w-3.5" />About</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-4">
          <ModulesSettingsPanel isAdmin={isDeveloperOrAdmin} />
        </TabsContent>

        <TabsContent value="environment" className="mt-4 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Environment & Setup</CardTitle>
              <CardDescription>Use the setup wizard to build the warehouse structure. Forms start blank; nothing is seeded automatically.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>1. Keep users and role assignments in place.</p>
              <p>2. Launch the warehouse setup wizard to define warehouses, zones, and location rules.</p>
              <p>3. Demo operational data (clients, products, pallets, receipts) is opt-in for developers only on the final step.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild>
                  <Link to="/setup-wizard">Open warehouse setup wizard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/system-log">View system log</Link>
                </Button>
                <Button variant="destructive" onClick={() => { setResetChallenge(""); setResetOpen(true); }} disabled={resetMutation.isPending || !isDeveloperOrAdmin}>
                  {resetMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
                  Reset all
                </Button>
              </div>
              {!isDeveloperOrAdmin ? <p>Only admins and developers can run Reset All.</p> : null}
            </CardContent>
          </Card>
          <Dialog open={resetOpen} onOpenChange={(o) => { if (!resetMutation.isPending) setResetOpen(o); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-destructive">Reset all warehouse data</DialogTitle>
                <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm">
                <p className="font-medium">What will happen:</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>All warehouses, zones, locations, and products will be deleted.</li>
                  <li>All clients, pallets, inventory, orders, picks, transfers, and counts will be deleted.</li>
                  <li>All printed labels, templates, integrations, AI recommendations, and reports will be cleared.</li>
                  <li>All audit history and system logs will be cleared.</li>
                  <li><strong>All users except developer accounts</strong> will be removed and must be re-created by an Admin or Dev user.</li>
                </ul>
                <div className="grid gap-1.5 pt-2">
                  <label htmlFor="reset-challenge" className="text-sm font-medium">Type <span className="font-mono font-semibold">RESET ALL</span> to confirm</label>
                  <Input id="reset-challenge" value={resetChallenge} onChange={(e) => setResetChallenge(e.target.value)} autoComplete="off" autoFocus />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetMutation.isPending}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={!resetReady || resetMutation.isPending}
                  onClick={() => { resetMutation.mutate(undefined, { onSettled: () => setResetOpen(false) }); }}
                >
                  {resetMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                  Reset everything
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {isEnabled("clients") && (
          <TabsContent value="client-vars" className="mt-4">
            <ClientVariablesPanel />
          </TabsContent>
        )}

        {canViewUsersRoles && (
          <TabsContent value="users-roles" className="mt-4">
            <UsersRolesPage />
          </TabsContent>
        )}

        <TabsContent value="about" className="mt-4 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Warehouse Wizard Enterprise WMS
              </CardTitle>
              <CardDescription>Version history and feature register.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="font-medium">Current version</span>
                <span className="font-mono text-xs font-semibold text-primary">v{__APP_VERSION__}</span>
              </div>
              {[
                {
                  version: "1.1.8 Beta",
                  date: "June 2026",
                  changes: [
                    "Put-Away and Pick: shortened bay codes open the bay selector while full location scans still confirm directly",
                    "Bin Locations table: Warehouse and Zone now appear before Aisle, and Label appears before Max Pallets",
                    "Location labels: batch printing now matches the per-row beam label design on Avery 99 x 38 mm labels",
                    "Bay labels: shortened location codes without level numbers print on Avery 99 x 93 mm labels",
                    "Zone labels: warehouse-zone-aisle codes print on Avery 99 x 93 mm labels",
                    "Badge sign-in: trusted-device PIN shortcut is limited to previously authenticated mobile/tablet devices",
                    "Access control: public Request Access is hidden; Admin and Dev users add accounts from Settings",
                  ],
                },
                {
                  version: "1.1.7",
                  date: "May 2026",
                  changes: [
                    "Labels: every printed code is now a QR (pallet, location, zone, warehouse) for faster, more reliable scans",
                    "Inventory Search: horizontal scrolling restored so all columns are reachable on narrow screens",
                    "Products: total on-hand quantity shown beside each product name (read-only)",
                    "Navigation: desktop sidebar only mounts in landscape; portrait and tablets use the top slide-in nav. Help is always the last item",
                    "Sidebar: squishy press feedback on nav buttons and tighter responsive width before the scrollbar kicks in",
                    "Bin Locations: Edit Location now saves Notes and Max height correctly (field-name mismatch fixed)",
                    "Bin Locations & Zones: bulk label sheets — filter the table, then Print labels sheet (paper size, grid, start cell)",
                    "Access requests: admins, supervisors, and managers see a full-screen prompt when pending users are awaiting approval, with a one-click jump to Users & Roles",
                  ],
                },
                {
                  version: "1.1.6",
                  date: "May 2026",
                  changes: [
                    "Pick Lists: product selector now only shows items with available quantity assigned to a location — zero-qty and unlocated stock are hidden",
                    "Inventory Search: removed the secondary location/zone scan filter bar (warehouse filter remains)",
                    "Dashboard: put-away count now matches what managers see on the Put-Away page; all roles see tasks correctly",
                    "Seeded task data (putaway, move tasks, cycle counts) cleaned up via migration",
                    "Password: all users can change their own password from the nav header; admin cannot change developer passwords",
                    "Developer and Warehouse Supervisor roles added; password RPCs extended to allow developer role",
                  ],
                },
                {
                  version: "1.1.3",
                  date: "May 2026",
                  changes: [
                    "Command Center: all Floor, Dock, and Office tiles are draggable and resizable",
                    "Command Center: summary metrics and workflow tiles now share one dynamic layout surface per view",
                    "Command Center: tile size and position preferences are remembered per signed-in user when available",
                    "Navigation: Users shortcut removed from the sidebar while admin user management remains in Settings",
                    "Dashboard: pallet dials, workflow queues, Warehouse Intelligence, Dock lanes, Office widgets, and Warehouse Brain use the same tile controls",
                  ],
                },
                {
                  version: "1.1.2",
                  date: "May 2026",
                  changes: [
                    "Inventory Search: fixed header and filter shell with row-only result scrolling",
                    "Inventory Search: warehouse scope matching now includes live warehouse, zone, aisle, and location codes",
                    "Bin Locations: generated and migrated codes now preserve warehouse, zone, and location hierarchy",
                    "Location Labels: full hierarchy codes with QR output for complex location codes",
                    "Put-Away: clearer location confirmation fields and aligned desktop task confirmation",
                    "Tables: editable and detail rows now require double-click or double-tap before opening",
                  ],
                },
                {
                  version: "1.1.1",
                  date: "May 2026",
                  changes: [
                    "Fix: Draft receipts now save correctly (notes column, not metadata)",
                    "Fix: Receive & Create Pallet works without expanding Show More — client field always visible",
                    "Fix: Pick list creation initialises all required fields correctly",
                    "Fix: Move to Picking correctly resolves pallet barcodes",
                    "Admin: Pick lists can now be cleared, archived, or deleted",
                    "Settings: Users & Roles management accessible from Settings (admin tab)",
                    "Help: Articles filtered by your role and enabled modules",
                  ],
                },
                {
                  version: "1.1.0",
                  date: "May 2026",
                  changes: [
                    "Inline row editing — double-click or click the pencil icon on any resource table row",
                    "Compact table rows with alternating shading on all data tables",
                    "Sticky table headers — column headers remain visible while scrolling",
                    "Full horizontal overflow scrolling on wide tables",
                    "Bin Locations table: operational columns (Code, Aisle, Bay, Type, Status) promoted to front; Warehouse/Zone moved to overflow",
                    "Mobile menu: nav item click now dismisses the menu automatically",
                    "Mobile menu: sign-out button moved to its own row, no longer clashes with the close control",
                    "Back button on Inventory Detail and Pick Execution pages",
                    "Settings — new About tab with version history and feature register",
                  ],
                },
                {
                  version: "1.0.0",
                  date: "May 2026",
                  changes: [
                    "Full warehouse master data — Warehouses, Zones, Bin Locations (bulk wizard), Clients, Products, Packaging Profiles",
                    "Receiving workflow — manual, purchase order, and transfer receipt types with lot/expiry capture",
                    "Directed putaway with temperature and capacity validation",
                    "Inventory search and pallet-level detail with full movement history",
                    "Pick lists with FIFO/FEFO rotation allocation and shortage capture",
                    "Inter-warehouse transfers with driver sign-off",
                    "Cycle counts — location, zone, SKU, and spot scope with variance thresholds",
                    "Pallet status controls — hold, quarantine, damaged, missing",
                    "Multi-mode dashboard — Floor, Dock, and Office views with drag-reorder metric cards",
                    "Reports with inventory, occupancy, and cycle count variance exports",
                    "Role-based access — Admin, Warehouse Manager, Inventory Clerk, Warehouse Operator, Dispatch Driver",
                    "Barcode label printing with QR code preview",
                    "Complete audit trail on all operational events",
                    "Setup wizard for warehouse, zone, and location bulk creation",
                    "Help centre with contextual sidebar and searchable articles",
                    "PWA — installable on mobile and desktop with offline indicator",
                  ],
                },
              ].map((release) => (
                <div key={release.version} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold bg-primary/10 text-primary rounded px-1.5 py-0.5">v{release.version}</span>
                    <span className="text-xs text-muted-foreground">{release.date}</span>
                  </div>
                  <ul className="grid gap-1">
                    {release.changes.map((c) => (
                      <li key={c} className="text-xs text-muted-foreground flex gap-2">
                        <span className="mt-0.5 shrink-0 text-primary">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feature Register</CardTitle>
              <CardDescription>All active feature areas in this deployment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {[
                ["Warehouses", "Multi-facility master data with cool zone flags"],
                ["Zones", "Temperature-classed storage and workflow zones per warehouse"],
                ["Bin Locations", "Rack, staging, dispatch, quarantine, and floor slots with capacity rules"],
                ["Clients", "3PL customer master with stock-sharing and expiry policies"],
                ["Products", "SKU master with rotation method, temperature class, and lot tracking"],
                ["Packaging Profiles", "Unit, carton, pallet pack forms with dimensions and barcodes"],
                ["Receiving", "Manual, PO, and transfer inbound with lot/expiry capture and putaway queuing"],
                ["Put-Away", "Directed put-away with temperature, capacity, and height validation"],
                ["Inventory Search", "Live pallet lookup by SKU, barcode, lot, location, or pallet code"],
                ["Pick Lists", "Rotation-aware pick wave creation with shortage capture"],
                ["Transfers", "Inter-warehouse moves with pallet identity preservation and driver sign-off"],
                ["Cycle Counts", "Periodic counts by location, zone, SKU, or spot with variance reporting"],
                ["Status Controls", "Pallet hold, quarantine, damaged, missing with reason audit"],
                ["Dashboard", "Floor, Dock, and Office modes with draggable metric cards"],
                ["Reports", "Inventory, occupancy, and cycle count exports"],
                ["Users & Roles", "Admin/Dev user creation, role scope, and trusted-device badge login"],
                ["System Log", "Full audit trail viewer with severity filtering and resolve workflow"],
                ["Help Centre", "Contextual help sidebar and searchable article wiki"],
              ].map(([feature, desc]) => (
                <div key={feature} className="flex items-start gap-2 rounded border border-border px-3 py-1.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                  <div>
                    <p className="font-medium leading-snug">{feature}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientVariablesPanel() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: variables = [], isLoading } = useQuery({
    queryKey: ["client-variables"],
    queryFn: () => listClientVariables(),
  });
  const [open, setOpen] = useState(false);
  const [editVar, setEditVar] = useState<any | null>(null);
  const form = useForm({
    defaultValues: { client_id: "", key: "", value: "", variable_type: "text", description: "" },
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => upsertClientVariable({ ...(editVar ? { id: editVar.id } : {}), ...values }),
    onSuccess: () => {
      toast.success("Variable saved");
      queryClient.invalidateQueries({ queryKey: ["client-variables"] });
      form.reset({ client_id: "", key: "", value: "", variable_type: "text", description: "" });
      setEditVar(null);
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClientVariable,
    onSuccess: () => {
      toast.success("Variable removed");
      queryClient.invalidateQueries({ queryKey: ["client-variables"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed"),
  });

  function openAdd() {
    setEditVar(null);
    form.reset({ client_id: "", key: "", value: "", variable_type: "text", description: "" });
    setOpen(true);
  }

  function openEdit(v: any) {
    setEditVar(v);
    form.reset({ client_id: v.client_id, key: v.key, value: v.value, variable_type: v.variable_type, description: v.description ?? "" });
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Client Variables</p>
          <p className="text-sm text-muted-foreground">Per-client configuration values such as rates, thresholds, and operational flags.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus data-icon="inline-start" />
          Add variable
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>Loading…</TableCell></TableRow>
                ) : variables.length === 0 ? (
                  <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>No client variables configured. Add one to get started.</TableCell></TableRow>
                ) : (
                  variables.map((v: any) => (
                    <TableRow key={v.id} className="even:bg-muted/30">
                      <TableCell className="font-medium">{v.clients?.code ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{v.key}</TableCell>
                      <TableCell className="max-w-xs truncate">{v.value}</TableCell>
                      <TableCell><Badge variant="secondary">{v.variable_type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{v.description ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(v.id)}>Remove</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableFrame>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editVar ? "Edit variable" : "Add client variable"}</DialogTitle>
            <DialogDescription>Configure a key/value setting for a specific client.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
              <FormField control={form.control} name="client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(options?.clients ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="key" render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. handling_rate_per_pallet" className="font-mono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="variable_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "text"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["text", "number", "boolean", "date", "json"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="What this variable controls" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save variable
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MobileActionBar() {
  const { pathname } = useLocation();
  const { roles } = useAuth();
  const { isEnabled, toolbarModules } = useFeatureFlags();
  const dashboard = NAVIGATION.find((item) => item.to === "/dashboard");
  const pinnedItems = toolbarModules
    .map((key) => NAVIGATION.find((item) => item.moduleKey === key))
    .filter((item): item is (typeof NAVIGATION)[number] => Boolean(item));
  const items = [dashboard, ...pinnedItems]
    .filter((item): item is (typeof NAVIGATION)[number] => Boolean(item))
    .filter(
      (item) =>
        item.roles.some((role) => roles.includes(role)) &&
        (!item.moduleKey || isEnabled(item.moduleKey as ModuleKey)),
    )
    .slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-teal-400 bg-teal-500 px-1 md:hidden">
      {items.map((item) => {
        const Icon = navIcons[item.to] ?? LayoutDashboard;
        const isActive = pathname === item.to;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-900/80 hover:bg-teal-400/70 hover:text-slate-950",
            )}
            aria-label={item.label}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate max-w-[56px]">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function SystemLogPage() {
  const queryClient = useQueryClient();
  const [logType, setLogType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["system-logs", logType, severity, showResolved],
    queryFn: () => listSystemLogs({ log_type: logType === "all" ? undefined : logType, severity: severity === "all" ? undefined : severity, resolved: showResolved ? undefined : false }),
  });
  const resolveMutation = useMutation({
    mutationFn: resolveSystemLog,
    onSuccess: () => { toast.success("Log entry resolved"); queryClient.invalidateQueries({ queryKey: ["system-logs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to resolve"),
  });
  const snapshotMutation = useMutation({
    mutationFn: snapshotRecordCounts,
    onSuccess: (rows) => { toast.success(`Record count snapshot saved for ${rows.length} tables`); queryClient.invalidateQueries({ queryKey: ["system-logs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Snapshot failed"),
  });
  const addMutation = useMutation({
    mutationFn: (values: { log_type: string; severity: string; title: string; message: string }) =>
      writeSystemLog({ log_type: values.log_type as Parameters<typeof writeSystemLog>[0]["log_type"], severity: values.severity as Parameters<typeof writeSystemLog>[0]["severity"], title: values.title, message: values.message, source: "manual" }),
    onSuccess: () => { toast.success("Log entry created"); queryClient.invalidateQueries({ queryKey: ["system-logs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Log failed"),
  });
  const [addOpen, setAddOpen] = useState(false);
  const form = useForm({ defaultValues: { title: "", message: "", log_type: "system_change", severity: "info" } });
  const severityVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "critical" || s === "error" ? "destructive" : s === "warning" ? "secondary" : "default";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">System Log</h2>
          <p className="text-sm text-muted-foreground">Software errors, bugs, system changes, infrastructure events, and record count snapshots.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
            {snapshotMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
            Snapshot counts
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus data-icon="inline-start" />
            Add entry
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <Select onValueChange={setLogType} value={logType}>
            <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {["error", "bug", "system_change", "infrastructure", "record_count", "info"].map((t) => (
                <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSeverity} value={severity}>
            <SelectTrigger><SelectValue placeholder="All severities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {["debug", "info", "warning", "error", "critical"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox checked={showResolved} onCheckedChange={(v) => setShowResolved(Boolean(v))} id="show-resolved" />
            <label htmlFor="show-resolved" className="cursor-pointer text-sm">Show resolved</label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-24">Table</TableHead>
                  <TableHead className="w-24 text-right">Count</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Loading logs…</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No log entries found.</TableCell></TableRow>
                ) : logs.map((log: any) => (
                  <TableRow key={log.id} className={cn("even:bg-muted/30", log.resolved ? "opacity-50" : "")}>
                    <TableCell><Badge variant="outline">{log.log_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge variant={severityVariant(log.severity)}>{log.severity}</Badge></TableCell>
                    <TableCell>
                      <p className="font-medium leading-tight">{log.title}</p>
                      {log.message ? <p className="text-xs text-muted-foreground">{log.message}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.source ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{log.table_name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{log.record_count != null ? formatNumber(log.record_count) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    <TableCell>
                      {log.resolved ? (
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => resolveMutation.mutate(log.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add log entry</DialogTitle>
            <DialogDescription>Manually record a system change, bug, or infrastructure event.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((values) => addMutation.mutate(values, { onSuccess: () => { form.reset(); setAddOpen(false); } }))}>
              <FormField control={form.control} name="log_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "system_change"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["error", "bug", "system_change", "infrastructure", "info"].map((t) => (
                        <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "info"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["debug", "info", "warning", "error", "critical"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} placeholder="Brief summary of the event" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl><Textarea {...field} rows={3} placeholder="Full description, steps to reproduce, or change notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save entry
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmailLogPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["email-send-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_send_log" as any).select("id,message_id,template_name,recipient_email,status,error_message,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const filtered = (rows as any[]).filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!row.recipient_email.toLowerCase().includes(q) && !row.template_name.toLowerCase().includes(q) && !(row.message_id ?? "").toLowerCase().includes(q) && !(row.error_message ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const counts = (rows as any[]).reduce((acc: any, row: any) => { acc.total += 1; acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, { total: 0 });
  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "sent" ? "default" : s === "failed" || s === "dlq" || s === "bounced" ? "destructive" : s === "pending" || s === "rate_limited" ? "secondary" : "outline";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Email Log</h2>
          <p className="text-sm text-muted-foreground">Recent email send attempts with statuses and error messages for troubleshooting.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[{ label: "Total", value: counts.total ?? 0 }, { label: "Sent", value: counts.sent ?? 0 }, { label: "Pending", value: counts.pending ?? 0 }, { label: "Failed", value: (counts.failed ?? 0) + (counts.dlq ?? 0) }, { label: "Suppressed", value: counts.suppressed ?? 0 }].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-semibold">{formatNumber(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr]">
          <Select onValueChange={setStatus} value={status}>
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["pending", "sent", "failed", "dlq", "rate_limited", "suppressed", "bounced", "complained"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="search" placeholder="Search recipient, template, message id, error…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-48">Template</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-40">Message ID</TableHead>
                  <TableHead className="w-40">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading email log…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No email log entries found.</TableCell></TableRow>
                ) : filtered.map((row: any) => (
                  <TableRow key={row.id} className="even:bg-muted/30 align-top">
                    <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{row.template_name}</TableCell>
                    <TableCell className="text-sm">{row.recipient_email}</TableCell>
                    <TableCell className="max-w-md text-xs text-destructive">
                      {row.error_message ? <span title={row.error_message} className="block break-words">{row.error_message}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.message_id ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        </CardContent>
      </Card>
    </div>
  );
}
