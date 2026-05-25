import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Analytics } from "@vercel/analytics/react";
import JsBarcode from "jsbarcode";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { FeatureFlagContext, useFeatureFlagState } from "@/hooks/use-feature-flags";
import { supabase } from "@/integrations/supabase/client";

import { confirmPickTask, formatDate, formatNumber, getInventoryDetail, getPickExecution, loginSchema, recordUserSignIn, signUpSchema, RESOURCE_DEFINITIONS } from "@/lib/wms-core";
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
  SystemLogPage,
  EmailLogPage,
  TransfersPage,
  UsersRolesPage,
  CycleCountsPage,
  LocationMovesPage,
} from "@/components/wms-ui";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarcodeScanButton } from "@/components/barcode-scan-button";
import { PalletLabelPage } from "@/components/pallet-label-page";
import NotFound from "./pages/NotFound";
import HelpCenterPage from "./pages/HelpCenter";
import SetupWizardPage from "./pages/SetupWizardPage";

const queryClient = new QueryClient();

const RELEASE_HISTORY = [
  {
    version: "1.1.1",
    date: "May 2026",
    changes: [
      "Inventory Search: barcode-aware searching and warehouse scope filtering",
      "Putaway: pallet confirmation, draft return prompts, and saved draft guidance",
      "Pick Lists: searchable pick list contents with scan support",
      "Inventory Detail: pallet barcode and full-page pallet label preview",
      "Mobile: configurable bottom toolbar and responsive table scrolling",
    ],
  },
  {
    version: "1.1.0",
    date: "May 2026",
    changes: [
      "Inline row editing with double-click and table action buttons",
      "Sticky table headers and horizontal overflow scrolling",
      "Back buttons on Inventory Detail and Pick Execution pages",
      "Settings About tab with version history and feature register",
    ],
  },
  {
    version: "1.0.0",
    date: "May 2026",
    changes: [
      "Warehouse, zone, location, client, product, and packaging master data",
      "Receiving, directed putaway, inventory search, pick lists, and transfers",
      "Dashboard, reporting, role-based access, barcode labels, and audit trail",
    ],
  },
];

function playBarcodeBeep() {
  try {
    const ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // Silent fallback when Web Audio is unavailable.
  }
}

function flashInput(el: HTMLElement | null, colour: "orange" | "blue") {
  if (!el) return;
  const cls = colour === "orange"
    ? ["ring-2", "ring-orange-400", "ring-offset-1"]
    : ["ring-2", "ring-blue-400", "ring-offset-1"];
  el.classList.add(...cls);
  setTimeout(() => el.classList.remove(...cls), 700);
}

function PalletBarcodePreview({ code }: { code?: string | null }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !code) return;
    try {
      JsBarcode(ref.current, code, {
        format: "CODE128",
        width: 2,
        height: 64,
        displayValue: true,
        fontSize: 14,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // Invalid barcode values are shown as plain text elsewhere on the page.
    }
  }, [code]);

  if (!code) return null;
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <svg ref={ref} className="h-auto max-w-full" />
    </div>
  );
}

function friendlyAuthError(error: unknown, context: "login" | "signup" | "code" | "oauth"): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const msg = raw.toLowerCase();
  if (!raw) {
    return context === "signup" ? "Sign up failed. Please try again." : "Sign in failed. Please try again.";
  }
  if (msg.includes("pending admin approval")) return raw;
  if (msg.includes("invalid login") || msg.includes("invalid_credentials") || msg.includes("invalid credentials")) {
    return "The email or password you entered is incorrect. Please try again.";
  }
  if (msg.includes("no active approved user") || msg.includes("matched that code")) {
    return "We couldn't find an approved user matching that code or badge.";
  }
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (msg.includes("user already registered") || msg.includes("already registered") || msg.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("weak password") || msg.includes("password should be") || msg.includes("password is too")) {
    return "Please choose a stronger password (at least 8 characters with letters and numbers).";
  }
  if (msg.includes("pwned") || msg.includes("compromised")) {
    return "This password has been found in a data breach. Please choose a different one.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network error — check your connection and try again.";
  }
  if (msg.includes("database error") || msg.includes("unexpected_failure") || msg.includes("schema")) {
    return "Sign-in is temporarily unavailable. Please try again in a moment.";
  }
  if (msg.includes("invalid email")) return "Please enter a valid email address.";
  if (msg.includes("refresh token")) return "Your session expired. Please sign in again.";
  if (msg.includes("popup") || msg.includes("cancelled") || msg.includes("canceled")) {
    return "Sign-in was cancelled. Please try again.";
  }
  return raw;
}

type InventoryDetailData = {
  balance: {
    status: string;
    quantity: number;
    available_quantity: number;
    reserved_quantity?: number;
    held_quantity?: number;
    damaged_quantity?: number;
    received_at?: string | null;
  };
  pallet: {
    pallet_code: string | null;
    pallet_barcode: string | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    weight?: number | null;
  } | null;
  product?: {
    sku?: string | null;
    name?: string | null;
    barcode?: string | null;
    temperature_requirement?: string | null;
  } | null;
  client?: { code?: string | null; name?: string | null } | null;
  warehouse?: { code?: string | null; name?: string | null } | null;
  location?: { code?: string | null; aisle?: string | null; bay?: string | null; level?: string | null } | null;
  receipt?: { receipt_number?: string | null; receipt_type?: string | null; reference_number?: string | null; created_at?: string | null } | null;
  receiptLine?: { quantity?: number | null; received_quantity?: number | null; override_length?: number | null; override_width?: number | null; override_height?: number | null; override_weight?: number | null } | null;
  lot: {
    expiry_date: string | null;
    lot_number: string | null;
    batch_number: string | null;
    manufacture_date?: string | null;
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

function RequireAuth({
  allowedRoles,
}: {
  allowedRoles?: Array<"admin" | "warehouse_manager" | "inventory_clerk" | "warehouse_operator" | "dispatch_driver">;
}) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_42%)] blur-3xl" />
        <div className="relative grid h-24 w-24 place-items-center rounded-2xl border border-border bg-card/70 shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-9 w-9 animate-themed-loader" />
        </div>
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
            <CardDescription>
              Your account is awaiting admin approval. You will be notified when access is granted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => auth.signOut()}>
              Sign out
            </Button>
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema.extend({ email: loginSchema.shape.email.or(z.string().min(3, "Enter an email, user code, or badge")) })),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const identifier = values.email.trim();
      const method = identifier.toUpperCase().startsWith("BADGE-") ? "badge" : identifier.includes("@") ? "email" : "code";
      await auth.signIn(identifier, values.password);
      await recordUserSignIn(method);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sign in failed"),
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
    onError: (error) => toast.error(friendlyAuthError(error, "signup")),
  });

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative flex h-svh overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      {/* Left branding panel — hidden on small screens */}
      <div className="hidden w-2/5 flex-col justify-between bg-primary p-6 text-primary-foreground lg:flex xl:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Warehouse Wizard" className="h-[clamp(4.5rem,14vh,8rem)] w-[clamp(4.5rem,14vh,8rem)] rounded-xl bg-background p-1 object-cover" />
          <span className="font-semibold text-3xl font-sans xl:text-4xl">Warehouse Wizard</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold leading-tight xl:text-3xl">Enterprise Warehouse Management System</h1>
          <p className="text-sm text-primary-foreground/70 xl:text-base">
            Scan-first operations, role-gated workflows, and complete audit trail for modern warehouse teams.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 xl:gap-3">
            {[
              ["Pallet tracking", "Real-time location & status"],
              ["Pick & putaway", "Directed task execution"],
              ["Cycle counts", "Variance-aware counting"],
              ["Multi-warehouse", "Unified cross-site control"],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-lg bg-primary-foreground/10 p-2 xl:p-3">
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-primary-foreground/60">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-primary-foreground/40">Warehouse Wizard Enterprise WMS</p>
      </div>

      {/* Right login form */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4 bg-slate-950">
        <div className="w-full max-w-sm space-y-3 sm:space-y-4">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src="/logo.png" alt="Warehouse Wizard" className="h-[clamp(4.5rem,18vh,7rem)] w-[clamp(4.5rem,18vh,7rem)] rounded-lg object-cover" />
            <span className="font-semibold text-[clamp(1.5rem,7vw,2.25rem)] leading-tight">Warehouse Wizard</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-center">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {mode === "login"
                ? "Sign in with your email, user code, or badge."
                : "Request access. An admin will approve your account."}
            </p>
          </div>

          {mode === "login" ? (
            <Form {...loginForm}>
              <form className="flex flex-col gap-3" onSubmit={loginForm.handleSubmit((v) => loginMutation.mutate(v))}>
                <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
                  <p className="text-sm font-medium text-center">Email, user code, or badge</p>
                  <p className="text-xs text-muted-foreground text-center">Use an approved email, short code such as ADMIN01, or a scanned badge code.</p>
                </div>
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Login</FormLabel><FormControl><Input {...field} autoComplete="username" className="bg-secondary bg-slate-500" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} className="pr-12 bg-secondary bg-slate-500" type={showLoginPassword ? "text" : "password"} autoComplete="current-password" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowLoginPassword((current) => !current)}
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          title={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  Sign in
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...signUpForm}>
              <form className="space-y-3" onSubmit={signUpForm.handleSubmit((v) => signUpMutation.mutate(v))}>
                <FormField
                  control={signUpForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Jane Smith" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="jane@example.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input {...field} type="tel" placeholder="+1 555 000 0000" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} className="pr-12" type={showSignUpPassword ? "text" : "password"} placeholder="Min 8 characters" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                            onClick={() => setShowSignUpPassword((current) => !current)}
                            aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                            title={showSignUpPassword ? "Hide password" : "Show password"}
                          >
                            {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
                  {signUpMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Request access
                </Button>
              </form>
            </Form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New user?{" "}
                <button className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Request access
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary underline-offset-4 hover:underline">
              <Sparkles className="h-3.5 w-3.5" />
              What's new
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[86vh] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New features</DialogTitle>
              <DialogDescription>Highlights from the latest release.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[58vh] pr-4">
              <div className="grid gap-3 text-sm">
                {RELEASE_HISTORY[0].changes.map((change) => (
                  <div key={change} className="rounded-md border border-border px-3 py-2">
                    {change}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <span className="text-muted-foreground/60">|</span>
        <Dialog>
          <DialogTrigger asChild>
            <button className="rounded-md px-2 py-1 font-mono font-semibold text-primary underline-offset-4 hover:underline">
              v{__APP_VERSION__}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[86vh] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Version history</DialogTitle>
              <DialogDescription>Warehouse Wizard Enterprise WMS release notes.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[58vh] pr-4">
              <div className="grid gap-3">
                {RELEASE_HISTORY.map((release) => (
                  <div key={release.version} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">v{release.version}</Badge>
                      <span className="text-xs text-muted-foreground">{release.date}</span>
                    </div>
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      {release.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function InventoryDetailPage() {
  const { balanceId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<InventoryDetailData>({
    queryKey: ["inventory-detail", balanceId],
    queryFn: async () => (await getInventoryDetail(balanceId)) as unknown as InventoryDetailData,
    enabled: Boolean(balanceId),
  });
  const palletBarcode = data?.pallet?.pallet_barcode ?? data?.pallet?.pallet_code ?? "";
  const productLabel = data?.product?.sku || data?.product?.name
    ? `${data.product?.sku ?? ""}${data.product?.sku && data.product?.name ? " · " : ""}${data.product?.name ?? ""}`
    : "—";
  const clientLabel = data?.client?.code || data?.client?.name
    ? `${data.client?.code ?? ""}${data.client?.code && data.client?.name ? " · " : ""}${data.client?.name ?? ""}`
    : "—";
  const warehouseLabel = data?.warehouse?.code || data?.warehouse?.name
    ? `${data.warehouse?.code ?? ""}${data.warehouse?.code && data.warehouse?.name ? " · " : ""}${data.warehouse?.name ?? ""}`
    : "—";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
      <Button variant="ghost" className="w-fit -ml-1 gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
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
                <div className="flex items-center justify-between gap-4">
                  <span>Pallet</span>
                  <span className="font-mono text-right">{data.pallet?.pallet_code ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Pallet barcode</span>
                  <span className="font-mono text-right">{palletBarcode || "—"}</span>
                </div>
                <PalletBarcodePreview code={palletBarcode} />
                <div className="flex items-center justify-between gap-4">
                  <span>Product</span>
                  <span className="text-right">{productLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Product barcode</span>
                  <span className="font-mono text-right">{data.product?.barcode ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Client</span>
                  <span className="text-right">{clientLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Warehouse</span>
                  <span className="text-right">{warehouseLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Location</span>
                  <span className="font-mono text-right">{data.location?.code ?? "Receiving / not stored"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Status</span>
                  <Badge>{data.balance.status}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Quantity</span>
                  <span>{formatNumber(data.balance.quantity)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Available</span>
                  <span>{formatNumber(data.balance.available_quantity)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Received qty</span>
                  <span>{formatNumber(data.receiptLine?.received_quantity ?? data.receiptLine?.quantity ?? data.balance.quantity)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Receipt</span>
                  <span className="font-mono text-right">{data.receipt?.receipt_number ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Reference</span>
                  <span className="text-right">{data.receipt?.reference_number ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Expiry</span>
                  <span>{formatDate(data.lot?.expiry_date)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Lot</span>
                  <span>{data.lot?.lot_number ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Batch</span>
                  <span>{data.lot?.batch_number ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Manufactured</span>
                  <span>{formatDate(data.lot?.manufacture_date)}</span>
                </div>
                <div className="grid gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <span>Dimensions</span>
                    <span className="text-right">
                      {[data.receiptLine?.override_length ?? data.pallet?.length, data.receiptLine?.override_width ?? data.pallet?.width, data.receiptLine?.override_height ?? data.pallet?.height]
                        .map((value) => value == null ? "—" : formatNumber(value))
                        .join(" × ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Weight</span>
                    <span>{formatNumber(data.receiptLine?.override_weight ?? data.pallet?.weight)} kg</span>
                  </div>
                </div>
                {palletBarcode && (
                  <PalletLabelPage
                    barcode={palletBarcode}
                    quantity={Number(data.balance.quantity ?? 0)}
                    productSku={data.product?.sku ?? undefined}
                    productName={data.product?.name ?? undefined}
                    lotNumber={data.lot?.lot_number}
                    expiryDate={data.lot?.expiry_date}
                    clientName={data.client?.name ?? data.client?.code}
                    warehouseName={data.warehouse?.name ?? data.warehouse?.code}
                    temperatureClass={data.product?.temperature_requirement ?? undefined}
                    trigger={<Button variant="outline">Preview pallet label</Button>}
                  />
                )}
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
      </div>
    </AppShell>
  );
}

function PickExecutionPage() {
  const { pickListId = "" } = useParams();
  const navigate = useNavigate();
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
        <Button variant="ghost" className="w-fit -ml-1 gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">Pick Execution</h2>
          <p className="text-sm text-muted-foreground">
            Open the assigned list, scan location and pallet, then confirm quantity.
          </p>
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
  onConfirm: (payload: {
    taskId: string;
    locationCode: string;
    palletBarcode: string;
    quantity: number;
    shortReason?: string;
  }) => void;
}) {
  const form = useForm({
    defaultValues: {
      locationCode: "",
      palletBarcode: "",
      quantity: task.requested_quantity,
      shortReason: "",
    },
  });
  const locationRef = useRef<HTMLInputElement | null>(null);
  const palletRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const pallet = task.pallets as any;
  const product = pallet?.products as any;
  const locationCode = task.locations?.code ?? task.pick_balance?.locations?.code ?? "";
  const palletBarcode = pallet?.pallet_barcode ?? "";
  const palletQuantity = task.pick_balance?.available_quantity ?? pallet?.available_quantity ?? pallet?.quantity ?? task.requested_quantity;
  const instruction = [
    `Go to: ${locationCode || "assigned location"}`,
    `Pallet: ${palletBarcode || "assigned pallet"}`,
    `Product: ${product?.sku ? `${product.sku} · ` : ""}${product?.name ?? "assigned product"}`,
    `Pallet qty: ${formatNumber(Number(palletQuantity ?? 0))}`,
  ].join("\n");

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
            <div className="lg:col-span-4">
              <Textarea value={instruction} readOnly className="min-h-24 resize-none font-mono text-sm" aria-label="Pick task instructions" />
            </div>
            <FormField
              control={form.control}
              name="locationCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location barcode</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          locationRef.current = el;
                        }}
                        className="min-h-10 min-w-0 flex-1 transition-shadow duration-300"
                        placeholder="Scan location barcode"
                        onChange={(event) => field.onChange(event.target.value.replace(/[\r\n]/g, ""))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            playBarcodeBeep();
                            flashInput(locationRef.current, "blue");
                            setTimeout(() => {
                              flashInput(palletRef.current, "orange");
                              palletRef.current?.focus();
                            }, 50);
                          }
                        }}
                      />
                      <BarcodeScanButton
                        title="Scan location barcode"
                        onScan={(value) => {
                          form.setValue("locationCode", value);
                          playBarcodeBeep();
                          flashInput(locationRef.current, "blue");
                          setTimeout(() => {
                            flashInput(palletRef.current, "orange");
                            palletRef.current?.focus();
                          }, 50);
                        }}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="palletBarcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pallet barcode</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          palletRef.current = el;
                        }}
                        className="min-h-10 min-w-0 flex-1 transition-shadow duration-300"
                        placeholder="Scan pallet barcode"
                        onChange={(event) => field.onChange(event.target.value.replace(/[\r\n]/g, ""))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            playBarcodeBeep();
                            flashInput(palletRef.current, "blue");
                            setTimeout(() => confirmRef.current?.focus(), 50);
                          }
                        }}
                      />
                      <BarcodeScanButton
                        title="Scan pallet barcode"
                        onScan={(value) => {
                          form.setValue("palletBarcode", value);
                          playBarcodeBeep();
                          flashInput(palletRef.current, "blue");
                          setTimeout(() => confirmRef.current?.focus(), 50);
                        }}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmed qty</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shortReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short reason</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button ref={confirmRef} className="w-full lg:col-span-4" type="submit">
              Confirm pick
            </Button>
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
      <MobileActionBar />
    </AppShell>
  );
}

function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const value = useFeatureFlagState();
  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

function ResourceRoutes() {
  const resources = useMemo(
    () => ({
      clients: RESOURCE_DEFINITIONS.clients,
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
          <Route path="/clients" element={<ResourcePage resource={resources.clients as any} />} />
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
          <Route path="/location-moves" element={<LocationMovesPage />} />
          <Route path="/cycle-counts" element={<CycleCountsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersRolesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/system-log" element={<SystemLogPage />} />
          <Route path="/email-log" element={<EmailLogPage />} />
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
      <FeatureFlagProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ResourceRoutes />
          </BrowserRouter>
          <Analytics />
        </AuthProvider>
      </FeatureFlagProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
