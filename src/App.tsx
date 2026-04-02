import { useMemo } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { confirmPickTask, formatDate, formatNumber, getInventoryDetail, getPickExecution, loginSchema, RESOURCE_DEFINITIONS } from "@/lib/wms-core";
import {
  AppShell,
  DashboardPage,
  InventorySearchPage,
  MobileActionBar,
  PickListsPage,
  PutawayTasksPage,
  ReceivingPage,
  ReportsPage,
  ResourcePage,
  SettingsPage,
  StatusPage,
  TransfersPage,
  UsersRolesPage,
  CycleCountsPage,
} from "@/components/wms-ui";
import type { ResourceDefinition } from "@/lib/wms-core";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type InventoryDetailData = {
  balance: {
    status: string;
    quantity: number;
    available_quantity: number;
  };
  pallet: {
    pallet_code: string | null;
  } | null;
  lot: {
    expiry_date: string | null;
    lot_number: string | null;
    batch_number: string | null;
  } | null;
  audit: Array<{
    id: string;
    event_type: string;
    created_at: string;
    entity_table: string;
  }>;
};

type PickExecutionData = {
  pickTasks: any[];
};

function RequireAuth({ allowedRoles }: { allowedRoles?: Array<"admin" | "warehouse_manager" | "inventory_clerk" | "warehouse_operator" | "dispatch_driver"> }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!auth.session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !auth.hasRole(allowedRoles)) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle>Permission denied</CardTitle>
            <CardDescription>Your role does not include this workflow.</CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return <Outlet />;
}

function LoginPage() {
  const auth = useAuth();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => auth.signIn(values.email, values.password),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sign in failed"),
  });

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Warehouse Wizard</CardTitle>
          <CardDescription>Internal warehouse management for receiving, putaway, picking, and transfers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Sign in
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryDetailPage() {
  const { balanceId = "" } = useParams();
  const { data, isLoading } = useQuery<InventoryDetailData>({
    queryKey: ["inventory-detail", balanceId],
    queryFn: async () => (await getInventoryDetail(balanceId)) as unknown as InventoryDetailData,
    enabled: Boolean(balanceId),
  });

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Detail</CardTitle>
            <CardDescription>Pallet, lot, status, and location context.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : data ? (
              <>
                <div className="flex items-center justify-between"><span>Pallet</span><span>{data.pallet?.pallet_code}</span></div>
                <div className="flex items-center justify-between"><span>Status</span><Badge>{data.balance.status}</Badge></div>
                <div className="flex items-center justify-between"><span>Quantity</span><span>{formatNumber(data.balance.quantity)}</span></div>
                <div className="flex items-center justify-between"><span>Available</span><span>{formatNumber(data.balance.available_quantity)}</span></div>
                <div className="flex items-center justify-between"><span>Expiry</span><span>{formatDate(data.lot?.expiry_date)}</span></div>
                <div className="flex items-center justify-between"><span>Lot</span><span>{data.lot?.lot_number ?? "—"}</span></div>
                <div className="flex items-center justify-between"><span>Batch</span><span>{data.lot?.batch_number ?? "—"}</span></div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Movement History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px]">
              <div className="grid gap-3">
                {(data?.audit ?? []).map((event) => (
                  <div key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{event.event_type}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{event.entity_table}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function PickExecutionPage() {
  const { pickListId = "" } = useParams();
  const queryClient = useQueryClient();
  const { data } = useQuery<PickExecutionData>({
    queryKey: ["pick-execution", pickListId],
    queryFn: async () => (await getPickExecution(pickListId)) as unknown as PickExecutionData,
    enabled: Boolean(pickListId),
  });

  const mutation = useMutation({
    mutationFn: async ({
      taskId,
      locationCode,
      palletBarcode,
      quantity,
      shortReason,
    }: {
      taskId: string;
      locationCode: string;
      palletBarcode: string;
      quantity: number;
      shortReason?: string;
    }) => confirmPickTask(taskId, locationCode, palletBarcode, quantity, shortReason),
    onSuccess: async () => {
      toast.success("Pick task confirmed");
      await queryClient.invalidateQueries({ queryKey: ["pick-execution", pickListId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Pick confirmation failed"),
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Pick Execution</h2>
          <p className="text-sm text-muted-foreground">Open the assigned list, scan location and pallet, then confirm quantity.</p>
        </div>
        {(data?.pickTasks ?? []).map((task) => (
          <PickTaskCard key={task.id} task={task} onConfirm={(payload) => mutation.mutate(payload)} />
        ))}
      </div>
    </AppShell>
  );
}

function PickTaskCard({
  task,
  onConfirm,
}: {
  task: any;
  onConfirm: (payload: { taskId: string; locationCode: string; palletBarcode: string; quantity: number; shortReason?: string }) => void;
}) {
  const form = useForm({
    defaultValues: {
      locationCode: "",
      palletBarcode: "",
      quantity: task.requested_quantity,
      shortReason: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>{task.task_number}</span>
          <Badge>{task.status}</Badge>
        </CardTitle>
        <CardDescription>Requested quantity: {formatNumber(task.requested_quantity)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={form.handleSubmit((values) =>
              onConfirm({
                taskId: task.id,
                locationCode: values.locationCode,
                palletBarcode: values.palletBarcode,
                quantity: Number(values.quantity),
                shortReason: values.shortReason || undefined,
              }),
            )}
          >
            <FormField control={form.control} name="locationCode" render={({ field }) => (
              <FormItem><FormLabel>Location barcode</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="palletBarcode" render={({ field }) => (
              <FormItem><FormLabel>Pallet barcode</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem><FormLabel>Confirmed qty</FormLabel><FormControl><Input {...field} type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="shortReason" render={({ field }) => (
              <FormItem><FormLabel>Short reason</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <Button className="md:col-span-4" type="submit">Confirm pick</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function HomeRedirect() {
  const { session } = useAuth();
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
      <MobileActionBar primaryTo="/receiving" primaryLabel="Receive stock" />
    </AppShell>
  );
}

function ResourceRoutes() {
  const resources = useMemo(
    () => ({
      warehouses: RESOURCE_DEFINITIONS.warehouses,
      zones: RESOURCE_DEFINITIONS.zones,
      locations: RESOURCE_DEFINITIONS.locations,
      products: RESOURCE_DEFINITIONS.products,
      packagingProfiles: RESOURCE_DEFINITIONS.packagingProfiles,
    }),
    [],
  );

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/warehouses" element={<ResourcePage resource={resources.warehouses} />} />
          <Route path="/zones" element={<ResourcePage resource={resources.zones} />} />
          <Route path="/locations" element={<ResourcePage resource={resources.locations} />} />
          <Route path="/products" element={<ResourcePage resource={resources.products} />} />
          <Route path="/packaging-profiles" element={<ResourcePage resource={resources.packagingProfiles} />} />
          <Route path="/receiving" element={<ReceivingPage />} />
          <Route path="/putaway-tasks" element={<PutawayTasksPage />} />
          <Route path="/inventory-search" element={<InventorySearchPage />} />
          <Route path="/pick-lists" element={<PickListsPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/cycle-counts" element={<CycleCountsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersRolesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/inventory/:balanceId" element={<InventoryDetailPage />} />
        <Route path="/pick-lists/:pickListId" element={<PickExecutionPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ResourceRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
