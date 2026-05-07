import { useMemo, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { confirmPickTask, formatDate, formatNumber, getInventoryDetail, getPickExecution, loginSchema, recordUserSignIn, resolveLoginCode, signUpSchema, RESOURCE_DEFINITIONS } from "@/lib/wms-core";
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
import HelpCenterPage from "./pages/HelpCenter";
import SetupWizardPage from "./pages/SetupWizardPage";

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

  if (auth.profile && !auth.profile.approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
            <CardDescription>Your account is awaiting admin approval. You will be notified when access is granted.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => auth.signOut()}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
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
  const [mode, setMode] = useState<"login" | "signup">("login");

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const codeLoginForm = useForm({
    resolver: zodResolver(loginSchema.extend({ email: loginSchema.shape.email.or(z.string().min(3)) })),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const { error, data } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) throw error;
      // Check if user is approved
      const { data: profile } = await supabase.from("profiles").select("approved").eq("id", data.user.id).maybeSingle();
      if (profile && !profile.approved) {
        await supabase.auth.signOut();
        throw new Error("Your account is pending admin approval.");
      }
      await recordUserSignIn("email");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sign in failed"),
  });

  const codeLoginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const email = await resolveLoginCode(values.email);
      if (!email) throw new Error("No active approved user matched that code or badge.");
      const { error, data } = await supabase.auth.signInWithPassword({ email, password: values.password });
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("approved").eq("id", data.user.id).maybeSingle();
      if (profile && !profile.approved) {
        await supabase.auth.signOut();
        throw new Error("Your account is pending admin approval.");
      }
      await recordUserSignIn("code");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Code sign in failed"),
  });

  const signUpMutation = useMutation({
    mutationFn: async (values: { fullName: string; email: string; phone: string; password: string }) => {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName, phone: values.phone },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account created! Please wait for admin approval before signing in.");
      setMode("login");
      signUpForm.reset();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sign up failed"),
  });

  const appleMutation = useMutation({
    mutationFn: async () => {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Apple sign in failed"),
  });

  const googleMutation = useMutation({
    mutationFn: async () => {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Google sign in failed"),
  });

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Warehouse Wizard Enterprise WMS</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in with an admin-approved email, user code, or scanned badge."
              : "Create an account. Admin approval is required before you can sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode === "login" ? (
            <div className="grid gap-5">
              <Form {...codeLoginForm}>
                <form className="flex flex-col gap-4 rounded-lg border border-border p-3" onSubmit={codeLoginForm.handleSubmit((v) => codeLoginMutation.mutate(v))}>
                  <div>
                    <p className="text-sm font-medium">Scan badge or enter user code</p>
                    <p className="text-xs text-muted-foreground">Built-in SSO-style sign-in for shared warehouse tablets.</p>
                  </div>
                  <FormField control={codeLoginForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>User code or badge</FormLabel><FormControl><Input {...field} autoComplete="username" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={codeLoginForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" autoComplete="current-password" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={codeLoginMutation.isPending}>
                    {codeLoginMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                    Sign in with code
                  </Button>
                </form>
              </Form>
              <Form {...loginForm}>
                <form className="flex flex-col gap-4" onSubmit={loginForm.handleSubmit((v) => loginMutation.mutate(v))}>
                  <FormField control={loginForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" variant="outline" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                    Sign in with email
                  </Button>
                </form>
              </Form>
            </div>
          ) : (
            <Form {...signUpForm}>
              <form className="flex flex-col gap-4" onSubmit={signUpForm.handleSubmit((v) => signUpMutation.mutate(v))}>
                <FormField control={signUpForm.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={signUpForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={signUpForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} type="tel" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={signUpForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={signUpMutation.isPending}>
                  {signUpMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  Create Account
                </Button>
              </form>
            </Form>
          )}

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <Button variant="outline" className="w-full" onClick={() => googleMutation.mutate()} disabled={googleMutation.isPending}>
            {googleMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            )}
            Sign in with Google
          </Button>

          <Button variant="outline" className="w-full" onClick={() => appleMutation.mutate()} disabled={appleMutation.isPending}>
            {appleMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
            )}
            Sign in with Apple
          </Button>

          <Button variant="link" className="text-sm" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Button>
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
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
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
        <Card className="min-w-0">
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
          <span className="min-w-0 break-all">{task.task_number}</span>
          <Badge>{task.status}</Badge>
        </CardTitle>
        <CardDescription>Requested quantity: {formatNumber(task.requested_quantity)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 lg:grid-cols-4"
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
            <Button className="w-full lg:col-span-4" type="submit">Confirm pick</Button>
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
          <Route path="/warehouses" element={<ResourcePage resource={resources.warehouses as any} />} />
          <Route path="/zones" element={<ResourcePage resource={resources.zones as any} />} />
          <Route path="/locations" element={<ResourcePage resource={resources.locations as any} />} />
          <Route path="/products" element={<ResourcePage resource={resources.products as any} />} />
          <Route path="/packaging-profiles" element={<ResourcePage resource={resources.packagingProfiles as any} />} />
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
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/setup-wizard" element={<SetupWizardPage />} />
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
