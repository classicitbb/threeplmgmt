import { useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Download, Eye, EyeOff, Loader2, LogOut, Menu, Plus, Printer, RotateCcw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import {
  NAVIGATION,
  ROLE_LABELS,
  type AppRoute,
  type FieldDefinition,
  type ResourceDefinition,
  changePalletStatus,
  confirmPutaway,
  createCycleCountFlow,
  createPickListFlow,
  createReceiptFlow,
  createTransferFlow,
  dispatchTransfer,
  cycleCountSchema,
  resetWmsData,
  downloadCsv,
  fetchOptions,
  formatDate,
  formatNumber,
  getDashboardMetrics,
  getPutawayTasks,
  getReportData,
  importCsvToResource,
  listCycleCounts,
  listPickLists,
  listRecords,
  listStatusPallets,
  listTransfers,
  pickListSchema,
  receivingSchema,
  receiveTransfer,
  searchInventory,
  setProfileActive,
  statusChangeSchema,
  setResourceVisibility,
  setUserRoleVisibility,
  submitCycleCountLine,
  transferSchema,
  upsertRecord,
} from "@/lib/wms-core";

import { cn } from "@/lib/utils";
import { HelpSidebar } from "@/components/help-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const baseFormSchema = z.record(z.any());

function TableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ScrollArea className={cn("h-[min(65vh,36rem)] w-full", className)}>
      <div className="min-w-0">{children}</div>
    </ScrollArea>
  );
}

function renderField(field: FieldDefinition, form: ReturnType<typeof useForm<Record<string, unknown>>>) {
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
                defaultValue={(controllerField.value as string | undefined) ?? undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
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
  const [open, setOpen] = useState(false);
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: resource.fields.reduce<Record<string, unknown>>((accumulator, field) => {
      accumulator[field.name] = field.type === "boolean" ? false : "";
      return accumulator;
    }, {}),
  });

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => upsertRecord(resource.table, values),
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
              {resource.fields.map((field) => renderField(field, form))}
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { profile, roles, signOut } = useAuth();
  const items = NAVIGATION.filter((item) => item.roles.some((role) => roles.includes(role)));

  const navigation = (
    <div className="flex h-full flex-col gap-4 bg-card/60 p-4 backdrop-blur">
      <div className="rounded-xl border border-border bg-background/80 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Warehouse Wizard</p>
        <h1 className="mt-2 text-xl font-semibold">WMS Lite</h1>
        <p className="mt-1 text-sm text-muted-foreground">2-warehouse, scan-first control room</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                isActive || pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm font-medium">{profile?.full_name ?? "Warehouse User"}</p>
          <p className="text-xs text-muted-foreground">{roles.map((role) => ROLE_LABELS[role]).join(" • ")}</p>
          <Button className="justify-start" variant="outline" onClick={() => void signOut()}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border lg:block">{navigation}</aside>
        <main className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:items-center lg:px-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Internal Operations</p>
              <p className="text-sm text-muted-foreground">All critical actions are audit-backed and role-gated.</p>
            </div>
            <div className="flex items-center gap-2">
              <HelpSidebar pathname={pathname} />
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="lg:hidden" size="icon" variant="outline">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  {navigation}
                </SheetContent>
              </Sheet>
            </div>
          </header>
          <div className="flex-1 min-w-0 px-4 py-4 sm:px-5 lg:px-6">{children}</div>
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
                  {resource.supportsHide ? <TableHead className="w-32">Visibility</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={resource.fields.length + (resource.supportsHide ? 1 : 0)}>
                      Loading {resource.title.toLowerCase()}...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={resource.fields.length + (resource.supportsHide ? 1 : 0)}>
                      No {resource.title.toLowerCase()} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={(row as { id?: string }).id ?? JSON.stringify(row)}>
                      {resource.fields.map((field) => (
                        <TableCell key={field.name}>{String((row as Record<string, unknown>)[field.name] ?? "—")}</TableCell>
                      ))}
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
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: getDashboardMetrics,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Live activity across receiving, storage, and outbound work.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total pallets", data?.totalPallets ?? 0],
          ["Available pallets", data?.availablePallets ?? 0],
          ["Open putaway", data?.openPutawayTasks ?? 0],
          ["Open pick lists", data?.openPickLists ?? 0],
          ["Hold stock", data?.holdStock ?? 0],
          ["Quarantine stock", data?.quarantineStock ?? 0],
          ["Open receipts", data?.openReceipts ?? 0],
          ["Cool occupancy", data?.coolZoneOccupancy ?? 0],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "…" : formatNumber(Number(value))}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ReceivingPage() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const form = useForm<z.infer<typeof receivingSchema>>({
    resolver: zodResolver(receivingSchema),
    defaultValues: {
      receipt_type: "manual",
      reference_number: "",
      quantity: 1,
    },
  });
  const [manualBarcode, setManualBarcode] = useState("");

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
                { label: "PO", value: "po" },
                { label: "Transfer", value: "transfer" },
              ]} />
              <TextField form={form} name="reference_number" label="Reference" />
              <SelectField form={form} name="warehouse_id" label="Warehouse" options={(options?.warehouses ?? []).map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))} />
              <SelectField form={form} name="client_id" label="Client" options={(options?.clients ?? []).map((client) => ({ label: client.name, value: client.id }))} />
              <SelectField form={form} name="product_id" label="Product" options={(options?.products ?? []).map((product) => ({ label: `${product.sku} · ${product.name}`, value: product.id }))} />
              <SelectField form={form} name="packaging_profile_id" label="Packaging profile" options={(options?.packagingProfiles ?? []).map((profile) => ({ label: profile.profile_name, value: profile.id }))} />
              <TextField form={form} name="quantity" label="Quantity" type="number" />
              <TextField form={form} name="lot_number" label="Lot" />
              <TextField form={form} name="batch_number" label="Batch" />
              <TextField form={form} name="manufacture_date" label="Manufacture date" type="date" />
              <TextField form={form} name="expiry_date" label="Expiry date" type="date" />
              <TextField form={form} name="loading_date" label="Loading date" type="date" />
              <TextField form={form} name="rotation_date" label="Rotation date" type="date" />
              <TextField form={form} name="override_length" label="Override length" type="number" />
              <TextField form={form} name="override_width" label="Override width" type="number" />
              <TextField form={form} name="override_height" label="Override height" type="number" />
              <TextField form={form} name="override_weight" label="Override weight" type="number" />
              <Button className="w-full sm:col-span-2" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Receive and create pallet
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Scan & Print</CardTitle>
          <CardDescription>Browser camera scan is device-dependent. Manual fallback is always available.</CardDescription>
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
          <p className="text-xs text-muted-foreground">
            Each receipt creates a pallet label record, inventory balance, and a queued putaway task.
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
}: {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  type?: string;
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
}: {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  options: Array<{ label: string; value: string }>;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState<string>("all");
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: () => fetchOptions() });
  const [warehouseId, setWarehouseId] = useState("");

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
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
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
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: fetchOptions });
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
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: fetchOptions });
  const { data: transfers = [] } = useQuery({ queryKey: ["transfers"], queryFn: listTransfers });
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
    mutationFn: async (transferId: string) => dispatchTransfer(transferId),
    onSuccess: async () => {
      toast.success("Transfer dispatched");
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
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
              <CardDescription>{transfer.notes || "Pallet transfer"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => dispatchMutation.mutate(transfer.id)}>Dispatch</Button>
              <Button className="w-full sm:w-auto" onClick={() => receiveMutation.mutate(transfer.id)}>Receive</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CycleCountsPage() {
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ["options"], queryFn: fetchOptions });
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
      await queryClient.invalidateQueries({ queryKey: ["status-pallets"] });
    },
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
              <TextField form={form} name="pallet_id" label="Pallet ID" />
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

  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data?.inventory ?? []) {
      map.set(row.warehouse_code, (map.get(row.warehouse_code) ?? 0) + row.available_quantity);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Reports & Dashboards</h2>
        <p className="text-sm text-muted-foreground">Operational snapshots across occupancy, expiries, holds, and recent movement.</p>
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

export function UsersRolesPage() {
  const queryClient = useQueryClient();
  const [includeHidden, setIncludeHidden] = useState(false);
  const { data: options } = useQuery({ queryKey: ["options", includeHidden], queryFn: () => fetchOptions(includeHidden) });
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const assignMutation = useMutation({
    mutationFn: async () => upsertRecord("user_roles", { user_id: selectedProfile, role_id: selectedRole }),
    onSuccess: async () => {
      toast.success("Role assigned");
      await queryClient.invalidateQueries({ queryKey: ["options"] });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ userRoleId, hidden }: { userRoleId: string; hidden: boolean }) => setUserRoleVisibility(userRoleId, hidden, hidden ? "Access hidden from user management" : undefined),
    onSuccess: async (_, variables) => {
      toast.success(variables.hidden ? "Role assignment hidden" : "Role assignment restored");
      await queryClient.invalidateQueries({ queryKey: ["options"] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async ({ profileId, active }: { profileId: string; active: boolean }) => setProfileActive(profileId, active),
    onSuccess: async (_, variables) => {
      toast.success(variables.active ? "Profile enabled" : "Profile disabled");
      await queryClient.invalidateQueries({ queryKey: ["options"] });
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Assign Roles</CardTitle>
          <CardDescription>Supabase Auth users appear automatically in profiles after first sign-in.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              {(options?.profiles ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {(options?.roles ?? []).map((role) => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!selectedProfile || !selectedRole} onClick={() => assignMutation.mutate()}>
            Assign role
          </Button>
          <Button variant="outline" onClick={() => setIncludeHidden((current) => !current)}>
            {includeHidden ? "Hide archived access" : "Show archived access"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current access</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(options?.userRoles ?? []).map((userRole: any) => (
            <div key={userRole.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{options?.profiles.find((profile) => profile.id === userRole.user_id)?.full_name ?? userRole.user_id}</p>
                <p className="text-xs text-muted-foreground">{options?.profiles.find((profile) => profile.id === userRole.user_id)?.email ?? ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={userRole.is_hidden ? "secondary" : "default"}>
                  {(userRole.roles as { name?: string; code?: string } | null)?.name ?? (userRole.roles as { code?: string } | null)?.code ?? "Role"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => visibilityMutation.mutate({ userRoleId: userRole.id, hidden: !userRole.is_hidden })}
                >
                  {userRole.is_hidden ? "Restore access" : "Hide access"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    profileMutation.mutate({
                      profileId: userRole.user_id,
                      active: !(options?.profiles.find((profile) => profile.id === userRole.user_id)?.active ?? true),
                    })
                  }
                >
                  {(options?.profiles.find((profile) => profile.id === userRole.user_id)?.active ?? true) ? "Disable profile" : "Enable profile"}
                </Button>
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
    <div className="grid gap-6 xl:grid-cols-2">
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
            <Button variant="destructive" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || !roles.includes("admin")}>
              {resetMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
              Reset all
            </Button>
          </div>
          {!roles.includes("admin") ? <p>Only admins can run Reset All.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Role Matrix</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {roles.map((role) => (
            <div key={role} className="rounded-lg border border-border px-3 py-2">
              <p className="font-medium">{ROLE_LABELS[role]}</p>
              <p className="text-xs text-muted-foreground">
                {role === "admin"
                  ? "Full system access"
                  : role === "warehouse_manager"
                    ? "Operational control across all warehouse functions"
                    : role === "inventory_clerk"
                      ? "Receiving, counts, search, and routine moves"
                      : role === "dispatch_driver"
                        ? "Transfer sign-off and inter-warehouse handoff visibility"
                        : "Assigned task execution and limited search"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
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
