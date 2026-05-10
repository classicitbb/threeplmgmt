import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, BarChart3, Bot, Boxes, Building2, Camera, CheckCircle2, ClipboardCheck, ClipboardList, Download, Eye, EyeOff, FileDown, Forklift, GripVertical, HelpCircle, Home, LayoutDashboard, Loader2, LogOut, Maximize2, MapPinned, Menu, Minimize2, Package, PanelLeftClose, PanelLeftOpen, Plus, Printer, QrCode, RadioTower, RotateCcw, Search, Settings, ShieldCheck, Tags, Truck, Upload, UserPlus, Users, Warehouse } from "lucide-react";
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
import {
  NAVIGATION,
  ROLE_LABELS,
  type AdminInviteUserInput,
  type AppRoute,
  type FieldDefinition,
  type ResourceDefinition,
  type SystemLogEntry,
  adminInviteUser,
  changePalletStatus,
  confirmPutaway,
  createCycleCountFlow,
  createPickListFlow,
  createReceiptFlow,
  createTransferFlow,
  deleteClientVariable,
  dispatchTransfer,
  cycleCountSchema,
  resetWmsData,
  downloadCsv,
  downloadCsvTemplate,
  fetchOptions,
  formatDate,
  formatNumber,
  getDashboardMetrics,
  getWarehouseForLocationBarcode,
  getPutawayTasks,
  getReportData,
  importCsvToResource,
  listClientVariables,
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
  statusChangeSchema,
  setResourceVisibility,
  setUserRoleVisibility,
  submitCycleCountLine,
  transferSchema,
  upsertClientVariable,
  upsertRecord,
  writeSystemLog,
} from "@/lib/wms-core";

import { cn } from "@/lib/utils";
import {
  buildCsvReportRows,
  buildEnterpriseDashboard,
  generateZplLabel,
  type DashboardMode,
  type DockHandoffLoad,
  type EnterpriseDashboardSnapshot,
  type WarehouseBrainRecommendation,
} from "@/lib/enterprise-wms";
import { HelpSidebar } from "@/components/help-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const baseFormSchema = z.record(z.any());
const appTitle = "Warehouse Wizard Enterprise WMS";

type DashboardMetricKey =
  | "totalPallets"
  | "availablePallets"
  | "coolZoneOccupancy"
  | "openReceipts"
  | "openPutawayTasks"
  | "openPickLists"
  | "holdStock"
  | "quarantineStock";

type DashboardCardSize = "sm" | "lg";

type DashboardCardConfig = {
  id: string;
  label: string;
  metricKey: DashboardMetricKey;
  size: DashboardCardSize;
};

const DEFAULT_DASHBOARD_CARDS: DashboardCardConfig[] = [
  { id: "totalPallets", label: "Total Pallets", metricKey: "totalPallets", size: "sm" },
  { id: "availablePallets", label: "Available Pallets", metricKey: "availablePallets", size: "sm" },
  { id: "openReceipts", label: "Open Receipts", metricKey: "openReceipts", size: "sm" },
  { id: "openPickLists", label: "Open Pick Lists", metricKey: "openPickLists", size: "sm" },
];

const DASHBOARD_LAYOUT_KEY = "wms.dashboard.layout.v1";

function loadLayout(): DashboardCardConfig[] {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_CARDS;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!raw) return DEFAULT_DASHBOARD_CARDS;
    const parsed = JSON.parse(raw) as DashboardCardConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DASHBOARD_CARDS;
    return parsed;
  } catch {
    return DEFAULT_DASHBOARD_CARDS;
  }
}

function saveLayout(cards: DashboardCardConfig[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

function SortableMetricCard({
  card,
  value,
  isLoading,
  onResize,
}: {
  card: DashboardCardConfig;
  value: number;
  isLoading: boolean;
  onResize: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn(card.size === "lg" ? "sm:col-span-2" : undefined)}>
      <Card className="relative">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onResize(card.id)}
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Resize card"
            >
              {card.size === "sm" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className="cursor-grab text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
              aria-label="Drag card"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatNumber(value)}
          </div>
        </CardContent>
      </Card>
    </div>
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
  "/cycle-counts": ClipboardCheck,
  "/status": ShieldCheck,
  "/reports": BarChart3,
  "/users": Users,
  "/settings": Settings,
  "/system-log": Activity,
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
    <ScrollArea className={cn("h-[calc(100svh-14rem)] min-h-48 w-full", className)}>
      <div className="min-w-0">{children}</div>
    </ScrollArea>
  );
}

function renderField(
  field: FieldDefinition,
  form: ReturnType<typeof useForm<Record<string, unknown>>>,
  options: Array<{ label: string; value: string }> = field.options ?? [],
) {
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
}: {
  resource: ResourceDefinition;
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
    mutationFn: async (values: Record<string, unknown>) => upsertRecord(resource.table, normalizeResourceValues(resource, values)),
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
        <Button>
          <Plus data-icon="inline-start" />
          Add {resource.singular}
        </Button>
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

const locationWizardSchema = z
  .object({
    warehouse_id: z.string().uuid({ message: "Select a warehouse" }),
    zone_id: z.string().uuid({ message: "Select a zone" }),
    prefix: z.string().trim().min(1, "Prefix required").max(8, "Max 8 chars"),
    start_bay: z.coerce.number().int().min(1),
    end_bay: z.coerce.number().int().min(1),
    levels: z.coerce.number().int().min(1).max(20),
    depth: z.coerce.number().int().min(1).max(5),
    max_pallets: z.coerce.number().int().min(1),
    location_type: z.enum(["rack", "staging", "quarantine", "dispatch", "receiving", "floor", "returns"]),
    temperature_class: z.enum(["ambient", "cool", "frozen"]),
    mixed_sku_allowed: z.boolean(),
    mixed_lot_allowed: z.boolean(),
  })
  .refine((v) => v.end_bay >= v.start_bay, { path: ["end_bay"], message: "End bay must be ≥ start bay" });

export type LocationWizardValues = z.infer<typeof locationWizardSchema>;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { profile, roles, signOut, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const items = NAVIGATION.filter((item) => item.roles.some((role) => roles.includes(role)));
  const displayName = profile?.full_name?.trim() || user?.email || "Warehouse User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "WU";

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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Warehouse className="h-4 w-4" />
        </div>
        {!sidebarCollapsed && (
          <span className="truncate text-sm font-semibold text-foreground">Warehouse Wizard</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = navIcons[item.to] ?? LayoutDashboard;
            const isActive = pathname === item.to;
            const link = (
              <NavLink
                key={item.to}
                className={({ isActive: navActive }) =>
                  cn(
                    "group flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-all duration-100",
                    sidebarCollapsed && "h-11 w-11 justify-center p-0",
                    navActive || isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
                to={item.to}
                aria-label={item.label}
              >
                <Icon className={cn("shrink-0", sidebarCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                {sidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : link;
          })}
        </div>
      </nav>

      {/* Collapse/expand toggle at bottom */}
      <div className={cn("mt-2 hidden border-t border-sidebar-border pt-2 lg:flex", sidebarCollapsed ? "justify-center" : "justify-end")}>
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
          "grid h-full w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-rows-1",
          "lg:grid-cols-[240px_minmax(0,1fr)]",
          sidebarCollapsed && "lg:grid-cols-[64px_minmax(0,1fr)]",
        )}
      >
        {/* Mobile header */}
        <header className="col-span-full flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Warehouse className="h-4 w-4" />
            </div>
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
            <HelpSidebar pathname={pathname} />
            <Sheet>
              <SheetTrigger asChild>
                <Button className="h-9 w-9" size="icon" variant="outline">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-svh w-screen max-w-full flex-col p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">v{__APP_VERSION__}</p>
                  </div>
                  <Button className="h-8 text-xs" variant="ghost" size="sm" onClick={() => void signOut()}>
                    <LogOut className="mr-1 h-3 w-3" />
                    Sign out
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">{navigation}</div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <aside className="hidden h-full overflow-hidden border-r border-border lg:block">{navigation}</aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Desktop top bar */}
          <div className="hidden items-center justify-between gap-3 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur lg:flex">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                <span className="truncate">{items.find((item) => item.to === pathname)?.label ?? "Warehouse Wizard Enterprise WMS"}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">v{__APP_VERSION__}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <HelpSidebar pathname={pathname} />
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-sm">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden truncate text-xs font-medium sm:block">{displayName}</span>
                <Button className="h-7 shrink-0 text-xs" variant="ghost" size="sm" onClick={() => void signOut()}>
                  <LogOut className="mr-1 h-3 w-3" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-5 sm:px-5 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function ResourcePage({
  resource,
}: {
  resource: ResourceDefinition;
}) {
  const [includeHidden, setIncludeHidden] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: [resource.table, includeHidden],
    queryFn: () => listRecords(resource.table, resource.select ?? "*", resource.orderBy, {
      includeHidden,
      archiveField: resource.archiveField,
    }),
  });
  const queryClient = useQueryClient();
  const extraColumnCount = (resource.supportsHide ? 1 : 0) + (["warehouses", "zones"].includes(resource.table) ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{resource.title}</h2>
          <p className="text-sm text-muted-foreground">{resource.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  {resource.fields.map((field) => (
                    <TableHead key={field.name}>{field.label}</TableHead>
                  ))}
                  {["warehouses", "zones"].includes(resource.table) ? <TableHead className="w-28">Barcode</TableHead> : null}
                  {resource.supportsHide ? <TableHead className="w-32">Visibility</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={resource.fields.length + extraColumnCount}>
                      Loading {resource.title.toLowerCase()}...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={resource.fields.length + extraColumnCount}>
                      No {resource.title.toLowerCase()} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={(row as { id?: string }).id ?? JSON.stringify(row)}>
                      {resource.fields.map((field) => {
                        const rawValue = (row as Record<string, unknown>)[field.name];
                        let displayValue: React.ReactNode;
                        if (rawValue == null || rawValue === "") {
                          displayValue = <span className="text-muted-foreground">—</span>;
                        } else if (field.type === "boolean") {
                          displayValue = <Badge variant={rawValue ? "default" : "secondary"}>{rawValue ? "Yes" : "No"}</Badge>;
                        } else if (field.type === "date") {
                          displayValue = formatDate(String(rawValue));
                        } else if (field.type === "select" && field.options) {
                          displayValue = field.options.find((o) => o.value === String(rawValue))?.label ?? String(rawValue);
                        } else if (field.type === "textarea") {
                          const text = String(rawValue);
                          displayValue = text.length > 60 ? <span title={text}>{text.slice(0, 60)}…</span> : text;
                        } else {
                          displayValue = String(rawValue);
                        }
                        return <TableCell key={field.name}>{displayValue}</TableCell>;
                      })}
                      {["warehouses", "zones"].includes(resource.table) ? (
                        <TableCell>
                          <BarcodePrintDialog
                            labelType={resource.table === "warehouses" ? "warehouse" : "zone"}
                            code={String((row as Record<string, unknown>).code ?? "")}
                            title={String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).code ?? resource.singular)}
                          />
                        </TableCell>
                      ) : null}
                      {resource.supportsHide ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const record = row as Record<string, unknown> & { id?: string };
                              const id = record.id;
                              if (!id || !resource.archiveField) return;
                              const hidden = resource.archiveField === "active" ? record.active !== false : record.is_hidden === true;
                              await setResourceVisibility(resource.table, id, resource.archiveField, !hidden, !hidden ? "Hidden from UI" : undefined);
                              toast.success(hidden ? `${resource.singular} restored` : `${resource.singular} hidden`);
                              queryClient.invalidateQueries({ queryKey: [resource.table] });
                            }}
                          >
                            {((resource.archiveField === "active" ? (row as Record<string, unknown>).active !== false : (row as Record<string, unknown>).is_hidden === true))
                              ? "Restore"
                              : "Hide"}
                          </Button>
                        </TableCell>
                      ) : null}
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

function ImportButton({ resource }: { resource: ResourceDefinition }) {
  return (
    <>
      <Button variant="outline" onClick={() => downloadCsvTemplate(resource)}>
        <FileDown data-icon="inline-start" />
        Template
      </Button>
      <Button
        variant="outline"
        onClick={() => {
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
        }}
      >
        <Upload data-icon="inline-start" />
        Import CSV
      </Button>
    </>
  );
}

function LocationWizardDialog() {
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
      depth: 1,
      max_pallets: 1,
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
    Math.max(form.watch("levels") ?? 1, 1);

  const mutation = useMutation({
    mutationFn: async (values: LocationWizardValues) => {
      const locations = [];

      for (let bay = values.start_bay; bay <= values.end_bay; bay += 1) {
        for (let level = 1; level <= values.levels; level += 1) {
          locations.push({
            warehouse_id: values.warehouse_id,
            zone_id: values.zone_id,
            code: `${values.prefix}-${String(bay).padStart(2, "0")}-L${String(level).padStart(2, "0")}`,
            aisle: values.prefix,
            bay: String(bay).padStart(2, "0"),
            level,
            depth: values.depth,
            max_pallets: values.max_pallets,
            location_type: values.location_type,
            temperature_class: values.temperature_class,
            mixed_sku_allowed: values.mixed_sku_allowed,
            mixed_lot_allowed: values.mixed_lot_allowed,
            status: "active",
          });
        }
      }

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
        <Button variant="outline">
          <MapPinned data-icon="inline-start" />
          Location wizard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create locations by range</DialogTitle>
          <DialogDescription>Generate repeated bay and level locations without typing every record.</DialogDescription>
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
              <TextField form={form} name="levels" label="Levels" type="number" hint="How many vertical levels per bay (1–20)." />
              <TextField form={form} name="depth" label="Depth" type="number" hint="Pallet positions deep (1–5)." />
              <TextField form={form} name="max_pallets" label="Max pallets" type="number" hint="Capacity per location." />
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
    "^FO288,220^A0N,18,18^FDWarehouse Wizard^FS",
    "^XZ",
  ].join("\n");

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
          <DialogDescription>QR-style scan label with human-readable code.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="mx-auto grid h-44 w-44 grid-cols-7 gap-1 rounded-md border border-border bg-white p-3" aria-label={`${labelType} QR preview`}>
            {Array.from({ length: 49 }).map((_, index) => (
              <span
                key={index}
                className={cn("rounded-[1px]", (index + code.length + code.charCodeAt(index % code.length)) % 3 === 0 ? "bg-black" : "bg-white")}
              />
            ))}
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">{labelType}</p>
            <p className="break-all text-xl font-semibold">{code}</p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Print label
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard?.writeText(zpl);
                toast.success("ZPL copied");
              }}
            >
              Copy ZPL
            </Button>
          </div>
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

function normalizeResourceValues(resource: ResourceDefinition, values: Record<string, unknown>) {
  return resource.fields.reduce<Record<string, unknown>>((payload, field) => {
    const value = values[field.name];
    if (value === "") {
      payload[field.name] = field.required ? value : null;
      return payload;
    }
    payload[field.name] = field.type === "number" && value != null ? Number(value) : value;
    return payload;
  }, {});
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
  const [mode, setMode] = useState<DashboardMode>("floor");
  const [cards, setCards] = useState<DashboardCardConfig[]>(loadLayout);
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
    queryKey: ["dashboard-metrics"],
    queryFn: getDashboardMetrics,
  });
  const { data: reports } = useQuery({ queryKey: ["reports", "enterprise-dashboard"], queryFn: getReportData });
  const snapshot = useMemo(() => buildEnterpriseDashboard(metrics, reports), [metrics, reports]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCards((prev) => {
        const oldIdx = prev.findIndex((c) => c.id === active.id);
        const newIdx = prev.findIndex((c) => c.id === over.id);
        const next = arrayMove(prev, oldIdx, newIdx);
        saveLayout(next);
        return next;
      });
    }
  }, []);

  const handleResize = useCallback((id: string) => {
    setCards((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const nextSize: DashboardCardSize = c.size === "sm" ? "lg" : "sm";
        return { ...c, size: nextSize };
      });
      saveLayout(next);
      return next;
    });
  }, []);

  return (
    <div
      ref={dashboardRef}
      className={cn(
        "flex flex-col gap-6",
        (isFullscreen || fitToScreen) && "h-screen overflow-auto bg-background p-4",
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Command Center</h2>
          <p className="text-sm text-muted-foreground">Live warehouse metrics. Drag cards to reorder, hover to resize.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as DashboardMode)}>
            <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
              <TabsTrigger value="floor" className="gap-1.5"><Forklift className="h-3.5 w-3.5" /> Floor</TabsTrigger>
              <TabsTrigger value="dock" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Dock</TabsTrigger>
              <TabsTrigger value="office" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Office</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={() => setFitToScreen((v) => !v)} aria-pressed={fitToScreen}>
            {fitToScreen ? "Reset fit" : "Fit to screen"}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <SortableMetricCard
                key={card.id}
                card={card}
                value={metrics?.[card.metricKey] ?? 0}
                isLoading={isLoading}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {mode === "floor" ? <WarehouseFloorMode snapshot={snapshot} /> : null}
      {mode === "dock" ? <DockHandoffBoard loads={snapshot.dockLoads} recommendations={snapshot.recommendations} /> : null}
      {mode === "office" ? <OfficeMonitoringMode snapshot={snapshot} /> : null}
    </div>
  );
}

function WarehouseFloorMode({ snapshot }: { snapshot: EnterpriseDashboardSnapshot }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        {snapshot.floorQueues.map((queue) => (
          <Card key={queue.label} className={cn("border-l-4", toneBorder(queue.tone))}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>{queue.label}</span>
                <span className="text-4xl">{formatNumber(queue.count)}</span>
              </CardTitle>
              <CardDescription>{queue.action}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="h-14 w-full text-base" asChild>
                <Link to={queue.route}>Open workflow</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RadioTower /> Andon & Lean Status</CardTitle>
          <CardDescription>5S, Kanban, DPMO, and exception signals for the current shift.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {snapshot.leanMetrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{metric.label}</span>
                <Badge variant={metric.status === "off_target" ? "destructive" : metric.status === "watch" ? "secondary" : "default"}>
                  {metric.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DockHandoffBoard({
  loads,
  recommendations,
}: {
  loads: DockHandoffLoad[];
  recommendations: WarehouseBrainRecommendation[];
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-5">
        {["ready", "called", "loading", "blocked", "loaded"].map((status) => (
          <Card key={status} className={cn("min-h-72", status === "blocked" ? "border-destructive/50" : "")}>
            <CardHeader>
              <CardTitle className="capitalize">{status}</CardTitle>
              <CardDescription>Dock handoff lane</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {loads.filter((load) => load.status === status).map((load) => (
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
        ))}
      </div>
      <WarehouseBrainPanel recommendations={recommendations} />
    </div>
  );
}

function OfficeMonitoringMode({ snapshot }: { snapshot: EnterpriseDashboardSnapshot }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        {snapshot.officeWidgets.map((widget) => (
          <Card key={widget.label} className={cn("border-l-4", toneBorder(widget.tone))}>
            <CardHeader>
              <CardDescription>{widget.label}</CardDescription>
              <CardTitle className="text-4xl">{widget.value}</CardTitle>
              <CardDescription>{widget.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
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
        <WarehouseBrainPanel recommendations={snapshot.recommendations} />
      </div>
    </div>
  );
}

function WarehouseBrainPanel({ recommendations }: { recommendations: WarehouseBrainRecommendation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot /> Warehouse Brain</CardTitle>
        <CardDescription>Explainable recommendations using live WMS context and role-aware next actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.id} className={cn("rounded-lg border border-border p-3", recommendation.severity === "critical" ? "bg-destructive/10" : recommendation.severity === "warning" ? "bg-warning/10" : "bg-secondary/30")}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{recommendation.title}</p>
              <Badge variant={recommendation.severity === "critical" ? "destructive" : "secondary"}>{recommendation.severity}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{recommendation.reason}</p>
            <p className="mt-2 text-sm">{recommendation.nextAction}</p>
          </div>
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

export function ReceivingPage() {
  const queryClient = useQueryClient();
  const { roles, profile } = useAuth();
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", "receiving", restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });
  const form = useForm<z.infer<typeof receivingSchema>>({
    resolver: zodResolver(receivingSchema),
    defaultValues: {
      receipt_type: "manual",
      reference_number: "",
      quantity: 1,
    },
  });
  const [reuseEnabled, setReuseEnabled] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const receivedQuantity = form.watch("quantity");
  const zplPreview = useMemo(
    () =>
      manualBarcode
        ? generateZplLabel({
            labelType: "pallet",
            code: manualBarcode,
            title: "Pallet Label",
            subtitle: "Zebra ZPL queue-ready",
            quantity: Number(receivedQuantity ?? 1),
          })
        : "",
    [manualBarcode, receivedQuantity],
  );

  const mutation = useMutation({
    mutationFn: createReceiptFlow,
    onSuccess: async (result) => {
      toast.success(`Receipt posted. Putaway task ${result.putawayTask.task_number} ready.`);
      form.reset({ receipt_type: "manual", reference_number: "", quantity: 1 });
      setManualBarcode(result.pallet.pallet_barcode);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Receiving failed"),
  });

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Receive Stock</CardTitle>
          <CardDescription>Create a pallet, print the label, and launch directed putaway in one flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <SelectField form={form} name="receipt_type" label="Receipt type" options={[
                { label: "Manual", value: "manual" },
                { label: "Purchase Order", value: "po" },
                { label: "Transfer", value: "transfer" },
              ]} />
              <TextField form={form} name="reference_number" label="Reference number" />
              <SelectField form={form} name="warehouse_id" label="Warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
              <SelectField form={form} name="client_id" label="Client / Owner" options={(options?.clients ?? []).map((client) => ({ label: `${client.code} · ${client.name}`, value: client.id }))} />
              <SelectField form={form} name="product_id" label="Product (SKU)" options={(options?.products ?? []).map((product) => ({ label: `${product.sku} · ${product.name}`, value: product.id }))} />
              <SelectField form={form} name="packaging_profile_id" label="Packaging profile" options={(options?.packagingProfiles ?? []).map((profile) => ({ label: profile.profile_name, value: profile.id }))} />
              <TextField form={form} name="quantity" label="Quantity received" type="number" />
              <TextField form={form} name="lot_number" label="Lot number" />
              <TextField form={form} name="batch_number" label="Batch number" />
              <TextField form={form} name="expiry_date" label="Expiry date" type="date" />
              <TextField form={form} name="manufacture_date" label="Manufacture date" type="date" />
              <TextField form={form} name="loading_date" label="Loading date" type="date" />

              {/* Pallet reuse */}
              <div className="sm:col-span-2">
                <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <Switch checked={reuseEnabled} onCheckedChange={(checked) => {
                    setReuseEnabled(checked);
                    if (!checked) form.setValue("reuse_pallet_barcode", "");
                  }} id="reuse-toggle" />
                  <label htmlFor="reuse-toggle" className="cursor-pointer text-sm">
                    Reuse existing blank pallet (scan a labelled empty pallet)
                  </label>
                </div>
              </div>
              {reuseEnabled ? (
                <TextField form={form} name="reuse_pallet_barcode" label="Existing pallet barcode" hint="Scan or enter the barcode of an empty pallet to reuse its label." />
              ) : null}

              {/* Dimension overrides – collapsed by default */}
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Dimension overrides (optional – leave blank to use packaging profile defaults)</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <TextField form={form} name="override_length" label="Length (cm)" type="number" />
                  <TextField form={form} name="override_width" label="Width (cm)" type="number" />
                  <TextField form={form} name="override_height" label="Height (cm)" type="number" />
                  <TextField form={form} name="override_weight" label="Weight (kg)" type="number" />
                </div>
              </div>

              <Button className="w-full sm:col-span-2" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {reuseEnabled ? "Receive onto existing pallet" : "Receive and create pallet"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Scan & Zebra Print</CardTitle>
          <CardDescription>ZPL-first label output with a browser print fallback for office workstations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera />
              Camera scanning can be added by enabling `BarcodeDetector` on supported mobile browsers.
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input className="min-w-0" value={manualBarcode} onChange={(event) => setManualBarcode(event.target.value)} placeholder="Latest pallet barcode" />
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Print
            </Button>
          </div>
          {zplPreview ? (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">ZPL payload</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(zplPreview);
                    toast.success("ZPL copied for printer queue");
                  }}
                >
                  Copy ZPL
                </Button>
              </div>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{zplPreview}</pre>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Each receipt creates a pallet label record, inventory balance, queued putaway task, and queue-ready Zebra label payload.
          </p>
        </CardContent>
      </Card>
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

export function PutawayTasksPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["putaway-tasks", user?.id],
    queryFn: () => getPutawayTasks(user?.id),
  });
  const [scanState, setScanState] = useState<Record<string, { pallet: string; location: string }>>({});

  const mutation = useMutation({
    mutationFn: async ({ taskId, pallet, location }: { taskId: string; pallet: string; location: string }) =>
      confirmPutaway(taskId, pallet, location),
    onSuccess: async () => {
      toast.success("Putaway confirmed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-search"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Putaway failed"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Putaway Tasks</h2>
        <p className="text-sm text-muted-foreground">Scan pallet barcode, scan location barcode, and confirm storage.</p>
      </div>
      <div className="grid gap-4">
        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading putaway tasks…</CardContent></Card>
        ) : data.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No putaway tasks ready.</CardContent></Card>
        ) : (
          data.map((task: any) => {
            const localState = scanState[task.id] ?? { pallet: "", location: "" };
            return (
              <Card key={task.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-4">
                    <span>{task.task_number}</span>
                    <Badge>{task.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Suggested location: {(task.locations as any)?.code ?? "Request alternative"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    className="min-w-0"
                    placeholder="Scan pallet barcode"
                    value={localState.pallet}
                    onChange={(event) =>
                      setScanState((current) => ({
                        ...current,
                        [task.id]: { ...localState, pallet: event.target.value },
                      }))
                    }
                  />
                  <Input
                    className="min-w-0"
                    placeholder="Scan location barcode"
                    value={localState.location}
                    onChange={(event) =>
                      setScanState((current) => ({
                        ...current,
                        [task.id]: { ...localState, location: event.target.value },
                      }))
                    }
                  />
                  <Button
                    className="w-full lg:w-auto"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ taskId: task.id, pallet: localState.pallet, location: localState.location })}
                  >
                    Confirm
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export function InventorySearchPage() {
  const { roles, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState<string>("all");
  const restrictedToDefaultWarehouse = shouldRestrictToDefaultWarehouse(roles);
  const { data: options } = useQuery({
    queryKey: ["options", "inventory", restrictedToDefaultWarehouse, profile?.default_warehouse_id],
    queryFn: () => fetchOptions(false, { restrictToWarehouse: restrictedToDefaultWarehouse, warehouseId: profile?.default_warehouse_id }),
  });
  const [warehouseId, setWarehouseId] = useState(restrictedToDefaultWarehouse ? profile?.default_warehouse_id ?? "" : "");
  const [locationScan, setLocationScan] = useState("");

  const scanMutation = useMutation({
    mutationFn: getWarehouseForLocationBarcode,
    onSuccess: (location) => {
      setWarehouseId(location.warehouse_id);
      toast.success(`Warehouse visibility switched to ${location.warehouses?.name ?? location.warehouses?.code ?? "scanned warehouse"}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Location scan failed"),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-search", searchTerm, status, warehouseId],
    queryFn: () => searchInventory({ search: searchTerm, status, warehouseId: warehouseId || undefined }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Inventory Search</h2>
        <p className="text-sm text-muted-foreground">Search by SKU, pallet, barcode, lot, batch, expiry, owner, or location.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(16rem,1fr)]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground" />
            <Input className="min-w-0 pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search inventory" />
          </div>
          <Select onValueChange={setWarehouseId} value={warehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="All warehouses" />
            </SelectTrigger>
            <SelectContent>
              {(options?.warehouses ?? []).map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-w-0 gap-2">
            <Input className="min-w-0" value={locationScan} onChange={(event) => setLocationScan(event.target.value)} placeholder="Scan location barcode" />
            <Button size="icon" variant="outline" onClick={() => scanMutation.mutate(locationScan)} aria-label="Use scanned location warehouse">
              <QrCode />
            </Button>
          </div>
          <Select onValueChange={(value) => setStatus(value as typeof status)} value={status}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["receiving", "available", "reserved", "picked", "staged", "in_transit", "hold", "quarantine", "damaged", "missing"].map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Pallet</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>Searching…</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>No inventory matched.</TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.inventory_balance_id}>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.pallet_code}</TableCell>
                      <TableCell>{row.location_code ?? "Receiving"}</TableCell>
                      <TableCell>{row.warehouse_code}</TableCell>
                      <TableCell><Badge variant={row.status === "available" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
                      <TableCell>{formatNumber(row.available_quantity)}</TableCell>
                      <TableCell>{formatDate(row.expiry_date)}</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/inventory/${row.inventory_balance_id}`}>Detail</Link>
                        </Button>
                      </TableCell>
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

export function PickListsPage() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: pickLists = [] } = useQuery({ queryKey: ["pick-lists"], queryFn: listPickLists });
  const form = useForm<z.infer<typeof pickListSchema>>({
    resolver: zodResolver(pickListSchema),
    defaultValues: { lines: [{ product_id: "", quantity: 1 }] },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof pickListSchema>) => createPickListFlow(values),
    onSuccess: async () => {
      toast.success("Pick list released");
      form.reset({ lines: [{ product_id: "", quantity: 1 }] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pick-lists"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Pick list failed"),
  });

  const lines = form.watch("lines");

  return (
    <Tabs className="flex flex-col gap-6" defaultValue="lists">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Pick Lists</h2>
        <p className="text-sm text-muted-foreground">Release outbound work and execute scan-confirmed picks.</p>
      </div>
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
        <TabsTrigger value="lists">Active Lists</TabsTrigger>
        <TabsTrigger value="create">Create Pick List</TabsTrigger>
      </TabsList>
      <TabsContent value="lists" className="grid gap-4">
        {pickLists.map((pickList: any) => (
          <Card key={pickList.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>{pickList.pick_list_number}</span>
                <Badge>{pickList.status}</Badge>
              </CardTitle>
              <CardDescription>{pickList.notes || "Released outbound work"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {(pickList.pick_tasks as any[] | undefined)?.length ?? 0} tasks
              </div>
              <Button asChild className="w-full sm:w-auto" variant="outline">
                <Link to={`/pick-lists/${pickList.id}`}>Execute</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="create">
        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <SelectField form={form} name="warehouse_id" label="Warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
                <SelectField form={form} name="client_id" label="Client" options={(options?.clients ?? []).map((client) => ({ label: client.name, value: client.id }))} />
                <TextField form={form} name="order_number" label="Order number" />
                <TextField form={form} name="requested_ship_date" label="Requested ship date" type="date" />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} />
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
                      <div key={index} className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_auto]">
                        <SelectField
                          form={form}
                          name={`lines.${index}.product_id`}
                          label="Product"
                          options={(options?.products ?? []).map((product) => ({ label: `${product.sku} · ${product.name}`, value: product.id }))}
                        />
                        <TextField form={form} name={`lines.${index}.quantity`} label="Qty" type="number" />
                        <Button
                          className="w-full lg:mt-auto lg:w-auto"
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("lines", lines.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => form.setValue("lines", [...lines, { product_id: "", quantity: 1 }])}>
                      Add line
                    </Button>
                  </CardContent>
                </Card>
                <Button className="w-full lg:col-span-2" type="submit" disabled={mutation.isPending}>
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
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: transfers = [] } = useQuery({ queryKey: ["transfers"], queryFn: listTransfers });
  const [signoffCodes, setSignoffCodes] = useState<Record<string, string>>({});
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
  });

  const dispatchMutation = useMutation({
    mutationFn: async (transferId: string) => dispatchTransfer(transferId, signoffCodes[transferId] ?? ""),
    onSuccess: async () => {
      toast.success("Driver departure signed off and transfer dispatched");
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Transfer dispatch failed"),
  });

  const receiveMutation = useMutation({
    mutationFn: async (transferId: string) => receiveTransfer(transferId),
    onSuccess: async () => {
      toast.success("Transfer received into destination");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transfers"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
      ]);
    },
  });

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              <Button className="w-full sm:w-auto" type="submit" disabled={createMutation.isPending}>Create transfer</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-4">
        {transfers.map((transfer: any) => (
          <Card key={transfer.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span className="min-w-0 break-all">{transfer.transfer_number}</span>
                <Badge>{transfer.status}</Badge>
              </CardTitle>
              <CardDescription>
                {transfer.notes || "Pallet transfer"}
                {transfer.dispatch_signed_off_at ? ` · departed ${formatDate(transfer.dispatch_signed_off_at)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
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
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => dispatchMutation.mutate(transfer.id)} disabled={transfer.status === "completed"}>
                  Dispatch
                </Button>
                <Button className="w-full sm:w-auto" onClick={() => receiveMutation.mutate(transfer.id)}>Receive</Button>
              </div>
              <p className="text-xs text-muted-foreground">Departure requires the signed-in driver/admin/manager to scan their badge or enter their user code before stock can leave.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CycleCountsPage() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const { data: counts = [] } = useQuery({ queryKey: ["cycle-counts"], queryFn: listCycleCounts });
  const form = useForm<z.infer<typeof cycleCountSchema>>({
    resolver: zodResolver(cycleCountSchema),
    defaultValues: {
      scope: "spot",
      variance_threshold_percent: 5,
    },
  });
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof cycleCountSchema>) => createCycleCountFlow(values),
    onSuccess: async () => {
      toast.success("Count sheet generated");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
  });
  const submitMutation = useMutation({
    mutationFn: async ({ lineId, quantity }: { lineId: string; quantity: number }) => submitCycleCountLine(lineId, quantity),
    onSuccess: async () => {
      toast.success("Count line submitted");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
  });

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              <Button className="w-full sm:w-auto" type="submit">Generate count</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-4">
        {counts.map((count: any) => (
          <Card key={count.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span className="min-w-0 break-all">{count.count_number}</span>
                <Badge>{count.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {((count.cycle_count_lines as any[] | undefined) ?? []).map((line: any) => (
                <div key={line.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">Expected {formatNumber(line.expected_quantity)}</span>
                  <Input
                    className="w-full sm:w-28"
                    defaultValue={line.counted_quantity}
                    type="number"
                    onBlur={(event) => submitMutation.mutate({ lineId: line.id, quantity: Number(event.target.value) })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
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
  const { data: metrics } = useQuery({ queryKey: ["dashboard-metrics", "reports"], queryFn: getDashboardMetrics });
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No role assigned</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All warehouses" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All warehouses</SelectItem>
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
    mutationFn: updateProfileDetails,
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Users ({profiles.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Access
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
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
                onSave={(values) => profileEditMutation.mutate(values)}
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
                    {(options?.roles ?? []).map((role: any) => (
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Access</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(options?.userRoles ?? []).map((userRole: any) => {
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => visibilityMutation.mutate({ userRoleId: userRole.id, hidden: !userRole.is_hidden })}
                        >
                          {userRole.is_hidden ? "Restore" : "Revoke"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
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
  onSave: (values: Parameters<typeof updateProfileDetails>[0]) => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    default_warehouse_id: profile.default_warehouse_id ?? "",
    active: profile.active ?? true,
    approved: profile.approved ?? false,
    user_code: profile.user_code ?? "",
    badge_code: profile.badge_code ?? "",
  });

  const initials = (profile.full_name ?? profile.email ?? "?")
    .split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

  const roleNames = userRoles
    .filter((ur) => !ur.is_hidden)
    .map((ur) => (ur.roles as { name?: string } | null)?.name ?? "")
    .filter(Boolean);

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
                  <Button
                    className="w-full"
                    onClick={() => {
                      onSave({ profileId: profile.id, ...values });
                      setOpen(false);
                    }}
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

export function SettingsPage() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: resetWmsData,
    onSuccess: async () => {
      toast.success("Environment reset complete. Launching the warehouse setup wizard.");
      await queryClient.invalidateQueries();
      navigate("/setup-wizard");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reset failed"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Warehouse environment, client configuration, and system management.</p>
      </div>
      <Tabs defaultValue="environment">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="client-vars">Client Variables</TabsTrigger>
          <TabsTrigger value="roles">Role Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="environment" className="mt-4 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Environment & Setup</CardTitle>
              <CardDescription>Use the setup wizard to build the warehouse structure and seed operational starter data.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>1. Keep users and role assignments in place.</p>
              <p>2. Launch the warehouse setup wizard to define warehouses, zones, and location rules.</p>
              <p>3. Seed starter operational data so receiving, putaway, picking, transfers, and counts can be tested immediately.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild>
                  <Link to="/setup-wizard">Open warehouse setup wizard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/system-log">View system log</Link>
                </Button>
                <Button variant="destructive" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || !roles.includes("admin")}>
                  {resetMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
                  Reset all
                </Button>
              </div>
              {!roles.includes("admin") ? <p>Only admins can run Reset All.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client-vars" className="mt-4">
          <ClientVariablesPanel />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Matrix</CardTitle>
              <CardDescription>Your current role assignments and their access scope.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {roles.map((role) => (
                <div key={role} className="rounded-lg border border-border px-3 py-2">
                  <p className="font-medium">{ROLE_LABELS[role]}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === "admin"
                      ? "Full system access including reset, user management, and all configuration"
                      : role === "warehouse_manager"
                        ? "Operational control across all warehouse functions and reporting"
                        : role === "inventory_clerk"
                          ? "Receiving, cycle counts, inventory search, and routine stock moves"
                          : role === "dispatch_driver"
                            ? "Transfer sign-off and inter-warehouse handoff visibility"
                            : "Assigned task execution and limited inventory search"}
                  </p>
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
              <TableHeader>
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
                    <TableRow key={v.id}>
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

export function SystemLogPage() {
  const queryClient = useQueryClient();
  const [logType, setLogType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [showResolved, setShowResolved] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["system-logs", logType, severity, showResolved],
    queryFn: () => listSystemLogs({ log_type: logType, severity, resolved: showResolved ? undefined : false }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveSystemLog,
    onSuccess: () => {
      toast.success("Log entry resolved");
      queryClient.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to resolve"),
  });

  const snapshotMutation = useMutation({
    mutationFn: snapshotRecordCounts,
    onSuccess: (counts) => {
      toast.success(`Record count snapshot saved for ${counts.length} tables`);
      queryClient.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Snapshot failed"),
  });

  const logMutation = useMutation({
    mutationFn: (values: { title: string; message: string; log_type: string; severity: string }) =>
      writeSystemLog({
        log_type: values.log_type as SystemLogEntry["log_type"],
        severity: values.severity as SystemLogEntry["severity"],
        title: values.title,
        message: values.message,
        source: "manual",
      }),
    onSuccess: () => {
      toast.success("Log entry created");
      queryClient.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Log failed"),
  });

  const [addOpen, setAddOpen] = useState(false);
  const addForm = useForm({ defaultValues: { title: "", message: "", log_type: "system_change", severity: "info" } });

  const severityBadge = (s: string) => {
    if (s === "critical" || s === "error") return "destructive" as const;
    if (s === "warning") return "secondary" as const;
    return "default" as const;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">System Log</h2>
          <p className="text-sm text-muted-foreground">Software errors, bugs, system changes, infrastructure events, and record count snapshots.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
            {snapshotMutation.isPending ? <Loader2 className="animate-spin" /> : <BarChart3 data-icon="inline-start" />}
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
            <Switch checked={showResolved} onCheckedChange={setShowResolved} id="show-resolved" />
            <label htmlFor="show-resolved" className="cursor-pointer text-sm">Show resolved</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableFrame>
            <Table>
              <TableHeader>
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
                  <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>Loading logs…</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>No log entries found.</TableCell></TableRow>
                ) : (
                  (logs as any[]).map((log) => (
                    <TableRow key={log.id} className={log.resolved ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge variant="outline">{log.log_type.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityBadge(log.severity)}>{log.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium leading-tight">{log.title}</p>
                          {log.message ? <p className="text-xs text-muted-foreground">{log.message}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.source ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{log.table_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{log.record_count != null ? formatNumber(log.record_count) : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                      <TableCell>
                        {!log.resolved ? (
                          <Button size="sm" variant="ghost" onClick={() => resolveMutation.mutate(log.id)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
          <Form {...addForm}>
            <form className="grid gap-4" onSubmit={addForm.handleSubmit((v) => logMutation.mutate(v, { onSuccess: () => { addForm.reset(); setAddOpen(false); } }))}>
              <FormField control={addForm.control} name="log_type" render={({ field }) => (
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
              <FormField control={addForm.control} name="severity" render={({ field }) => (
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
              <FormField control={addForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} placeholder="Brief summary of the event" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addForm.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl><Textarea {...field} rows={3} placeholder="Full description, steps to reproduce, or change notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={logMutation.isPending}>
                {logMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save entry
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MobileActionBar({ primaryTo, primaryLabel }: { primaryTo: AppRoute; primaryLabel: string }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button className="fixed bottom-4 right-4 lg:hidden">
          <Plus data-icon="inline-start" />
          Quick actions
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick actions</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-2 p-4">
          <Button asChild>
            <Link to={primaryTo}>{primaryLabel}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inventory-search">Search inventory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/putaway-tasks">Putaway queue</Link>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
