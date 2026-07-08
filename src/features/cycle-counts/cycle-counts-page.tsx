import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Archive, CheckCircle2, ClipboardCheck, Eye, Lock, Plus, RefreshCw, ShieldCheck, Trash2, UserCog, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import { OFFLINE_WORK_MESSAGE, assertOnline, useNetworkStatus } from "@/hooks/use-network-status";
import { isLikelyNetworkError } from "@/lib/offline-queue";
import {
  archiveCancelledCycleCount,
  approveCycleCountLine,
  closeCycleCount,
  createCycleCountFlow,
  cycleCountSchema,
  discardDraftCycleCount,
  fetchOptions,
  flagCycleCountLineException,
  formatDate,
  formatNumber,
  listCycleCounts,
  listMyCycleCountLines,
  rejectCycleCountLine,
  submitCycleCountLine,
  ROLE_LABELS,
  type RoleCode,
} from "@/lib/wms-core";
import {
  clearCycleCountResumeSnapshot,
  loadCycleCountResumeSnapshot,
  saveCycleCountResumeSnapshot,
} from "@/lib/floor-task-resume";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const supervisorRoles = new Set(["developer", "admin", "warehouse_manager", "warehouse_supervisor"]);
const rolePreviewOptions: RoleCode[] = [
  "developer",
  "admin",
  "warehouse_manager",
  "warehouse_supervisor",
  "inventory_clerk",
  "warehouse_operator",
  "dispatch_driver",
];
const countStatusFilters = ["all", "active", "draft", "frozen", "counting", "review", "approved", "closed", "cancelled", "archived"] as const;
type CountStatusFilter = (typeof countStatusFilters)[number];

function lineStatus(line: any) {
  return line.line_status ?? line.status ?? "queued";
}

function countStatusVariant(status: string) {
  if (["approved", "closed", "reconciled", "adjusted"].includes(status)) return "default";
  if (["review", "variance_hold", "exception", "recount"].includes(status)) return "destructive";
  if (["counting", "frozen", "queued", "counted"].includes(status)) return "secondary";
  return "outline";
}

function locationLabel(location: any) {
  return location?.code ?? [location?.aisle, location?.bay, location?.level, location?.position].filter(Boolean).join("-") ?? "Unassigned bin";
}

function isCountArchived(count: any) {
  return Boolean(count.archived_at) || String(count.notes ?? "").includes("[archived]");
}

export function CycleCountsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { online } = useNetworkStatus();
  const actualIsSupervisor = auth.roles.some((role) => supervisorRoles.has(role));
  const isDeveloper = auth.roles.includes("developer");
  const [rolePreview, setRolePreview] = useState<RoleCode>("developer");
  const effectiveRoles = isDeveloper ? [rolePreview] : auth.roles;
  const isSupervisor = effectiveRoles.some((role) => supervisorRoles.has(role));
  const [activeTab, setActiveTab] = useState(actualIsSupervisor ? "manage" : "entry");
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CountStatusFilter>("all");
  const [entryQty, setEntryQty] = useState<Record<string, string>>({});
  const [exceptionReason, setExceptionReason] = useState<Record<string, string>>({});
  const [approvalReason, setApprovalReason] = useState<Record<string, string>>({});
  const resumeHydratedRef = useRef(false);
  const wasOfflineRef = useRef(!online);
  const resumeUserId = auth.profile?.id ?? null;

  const { data: options } = useQuery({ queryKey: ["options", "cycle-counts"], queryFn: () => fetchOptions() });
  const { data: counts = [] } = useQuery({
    queryKey: ["cycle-counts"],
    queryFn: listCycleCounts,
    enabled: actualIsSupervisor,
  });
  const { data: assignedLines = [] } = useQuery({
    queryKey: ["cycle-count-lines", "assigned"],
    queryFn: listMyCycleCountLines,
  });

  const form = useForm<z.infer<typeof cycleCountSchema>>({
    resolver: zodResolver(cycleCountSchema),
    defaultValues: {
      scope: "spot",
      variance_threshold_percent: 5,
      freeze_hours: 4,
      assigned_user_id: "",
    },
  });

  useEffect(() => {
    if (!isSupervisor && activeTab !== "entry") {
      setActiveTab("entry");
    }
  }, [activeTab, isSupervisor]);

  useEffect(() => {
    if (resumeHydratedRef.current) return;
    if (!resumeUserId) return;
    resumeHydratedRef.current = true;
    const snapshot = loadCycleCountResumeSnapshot({ userId: resumeUserId });
    if (!snapshot) return;
    setEntryQty(snapshot.entryQty ?? {});
    setExceptionReason(snapshot.exceptionReason ?? {});
    setApprovalReason(snapshot.approvalReason ?? {});
  }, [resumeUserId]);

  useEffect(() => {
    if (!resumeUserId) return;
    const hasResumeState =
      Object.values(entryQty).some((value) => value.trim().length > 0) ||
      Object.values(exceptionReason).some((value) => value.trim().length > 0) ||
      Object.values(approvalReason).some((value) => value.trim().length > 0);
    if (!hasResumeState) {
      clearCycleCountResumeSnapshot();
      return;
    }
    saveCycleCountResumeSnapshot({
      userId: resumeUserId,
      entryQty,
      exceptionReason,
      approvalReason,
      updatedAt: Date.now(),
    });
  }, [approvalReason, entryQty, exceptionReason, resumeUserId]);

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cycle-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["cycle-count-lines", "assigned"] }),
      queryClient.invalidateQueries({ queryKey: ["options", "cycle-counts"] }),
    ]);
    toast.message("Connection restored. Refreshing live cycle-count state before the next post.");
  }, [online, queryClient]);

  async function runOnlineCycleCountCommit<T>(operation: () => Promise<T>) {
    assertOnline();
    try {
      return await operation();
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        throw new Error(OFFLINE_WORK_MESSAGE);
      }
      throw error;
    }
  }

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof cycleCountSchema>) => runOnlineCycleCountCommit(() => createCycleCountFlow(values)),
    onSuccess: async (result: any) => {
      toast.success(`Count created with ${result.claimed_line_count ?? 0} line(s)`);
      form.reset({ scope: "spot", variance_threshold_percent: 5, freeze_hours: 4, assigned_user_id: "" });
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["cycle-count-lines", "assigned"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Count creation failed"),
  });

  const submitMutation = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) => runOnlineCycleCountCommit(() => submitCycleCountLine(lineId, quantity)),
    onSuccess: async (_data, variables) => {
      setEntryQty((current) => ({ ...current, [variables.lineId]: "" }));
      toast.success("Blind count submitted");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["cycle-count-lines", "assigned"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Submit failed"),
  });

  const exceptionMutation = useMutation({
    mutationFn: ({ lineId, reason }: { lineId: string; reason: string }) => runOnlineCycleCountCommit(() => flagCycleCountLineException(lineId, reason)),
    onSuccess: async (_data, variables) => {
      setExceptionReason((current) => ({ ...current, [variables.lineId]: "" }));
      toast.warning("Line flagged for supervisor review");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["cycle-count-lines", "assigned"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Exception update failed"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ lineId, reason }: { lineId: string; reason: string }) => runOnlineCycleCountCommit(() => approveCycleCountLine(lineId, reason)),
    onSuccess: async (_data, variables) => {
      setApprovalReason((current) => ({ ...current, [variables.lineId]: "" }));
      toast.success("Variance approved and posted");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Approval failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ lineId, reason }: { lineId: string; reason: string }) => runOnlineCycleCountCommit(() => rejectCycleCountLine(lineId, reason)),
    onSuccess: async (_data, variables) => {
      setApprovalReason((current) => ({ ...current, [variables.lineId]: "" }));
      toast.info("Line returned for recount");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reject failed"),
  });

  const closeMutation = useMutation({
    mutationFn: (countId: string) => runOnlineCycleCountCommit(() => closeCycleCount(countId)),
    onSuccess: async () => {
      toast.success("Cycle count closed and freezes released");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Close failed"),
  });

  const discardDraftMutation = useMutation({
    mutationFn: (countId: string) => runOnlineCycleCountCommit(() => discardDraftCycleCount(countId)),
    onSuccess: async () => {
      toast.success("Draft count discarded");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Discard failed"),
  });

  const archiveCancelledMutation = useMutation({
    mutationFn: (countId: string) => runOnlineCycleCountCommit(() => archiveCancelledCycleCount(countId)),
    onSuccess: async () => {
      toast.success("Cancelled count archived");
      await queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Archive failed"),
  });

  const filteredCounts = useMemo(() => {
    return (counts as any[]).filter((count) => {
      const archived = isCountArchived(count);
      if (statusFilter === "archived") return archived;
      if (archived) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return !["closed", "cancelled"].includes(count.status);
      return count.status === statusFilter;
    });
  }, [counts, statusFilter]);

  const reviewLines = useMemo(
    () => (counts as any[]).flatMap((count) =>
      (count.cycle_count_lines ?? [])
        .filter((line: any) => lineStatus(line) === "variance_hold")
        .map((line: any) => ({ ...line, count })),
    ),
    [counts],
  );

  return (
    <div className="grid min-w-0 gap-5">
      {!online && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">This device is offline. Cycle-count posts are frozen.</p>
          <p className="mt-1">Keep entered quantities and reasons on this device, reconnect, and refresh live state before submitting or approving.</p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Cycle Counts</h1>
          <p className="text-sm text-muted-foreground">Blind counting with bin freezes, recounts, and supervisor approval.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isDeveloper && (
            <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <Select value={rolePreview} onValueChange={(value) => setRolePreview(value as RoleCode)}>
                <SelectTrigger className="h-8 border-0 bg-transparent px-0 shadow-none focus:ring-0">
                  <SelectValue aria-label="Preview role" />
                </SelectTrigger>
                <SelectContent>
                  {rolePreviewOptions.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isSupervisor && (
            <Button onClick={() => setCreateOpen(true)} disabled={!online}>
              <Plus className="mr-2 h-4 w-4" />
              New count
            </Button>
          )}
          <Badge variant="outline" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Hard-freeze counted bins
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {isSupervisor && <TabsTrigger value="manage">Create & Monitor</TabsTrigger>}
          <TabsTrigger value="entry">Blind Entry</TabsTrigger>
          {isSupervisor && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
        </TabsList>

        {isSupervisor && (
          <TabsContent value="manage" className="mt-4 grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>{filteredCounts.length} of {(counts as any[]).length} count{(counts as any[]).length === 1 ? "" : "s"}</span>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CountStatusFilter)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  {countStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "all" ? "All statuses" : status === "active" ? "Active counts" : status[0].toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid content-start gap-3">
              {(counts as any[]).length === 0 ? (
                <EmptyState title="No counts yet" body="Create a count to claim bins and generate blind entry work." />
              ) : filteredCounts.length === 0 ? (
                <EmptyState title="No counts match" body="Change the status filter to review another part of the count history." />
              ) : filteredCounts.map((count: any) => {
                const lines = count.cycle_count_lines ?? [];
                const openFreezes = (count.inventory_freezes ?? []).filter((freeze: any) => freeze.status === "active");
                const doneLines = lines.filter((line: any) => ["reconciled", "adjusted", "exception"].includes(lineStatus(line))).length;
                return (
                  <Card key={count.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                        <span className="font-mono">{count.count_number}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {isCountArchived(count) && <Badge variant="outline">archived</Badge>}
                          <Badge variant={countStatusVariant(count.status) as any}>{count.status}</Badge>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {count.scope} · {doneLines}/{lines.length} lines resolved · {openFreezes.length} active freeze(s) · expires {formatDate(count.freeze_expires_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {count.notes && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{count.notes}</p>}
                      {lines.slice(0, 8).map((line: any) => (
                        <div key={line.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{line.products?.sku ?? "Product"} · {locationLabel(line.locations)}</p>
                            <p className="text-xs text-muted-foreground">Expected {formatNumber(line.expected_quantity)} · variance {formatNumber(line.variance_quantity)} ({Number(line.variance_percent ?? 0).toFixed(1)}%)</p>
                          </div>
                          <Badge variant={countStatusVariant(lineStatus(line)) as any}>{lineStatus(line)}</Badge>
                        </div>
                      ))}
                      {lines.length > 8 && <p className="text-xs text-muted-foreground">Showing 8 of {lines.length} lines.</p>}
                      <div className="flex flex-wrap gap-2">
                        {count.status === "approved" && (
                          <Button size="sm" onClick={() => closeMutation.mutate(count.id)} disabled={!online || closeMutation.isPending}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Close and release freezes
                          </Button>
                        )}
                        {count.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => discardDraftMutation.mutate(count.id)} disabled={!online || discardDraftMutation.isPending}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Discard draft
                          </Button>
                        )}
                        {count.status === "cancelled" && !isCountArchived(count) && (
                          <Button size="sm" variant="outline" onClick={() => archiveCancelledMutation.mutate(count.id)} disabled={!online || archiveCancelledMutation.isPending}>
                            <Archive className="mr-2 h-4 w-4" />
                            Archive cancelled
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        <TabsContent value="entry" className="mt-4 grid gap-3">
          {assignedLines.length === 0 ? (
            <EmptyState title="No assigned lines" body="Assigned blind count work appears here. Expected quantities are not shown." />
          ) : assignedLines.map((line: any) => {
            const status = lineStatus(line);
            const qtyValue = entryQty[line.id] ?? "";
            const reason = exceptionReason[line.id] ?? "";
            return (
              <Card key={line.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>{line.products?.sku ?? "Product"} · {locationLabel(line.locations)}</span>
                    <Badge variant={countStatusVariant(status) as any}>{status}</Badge>
                  </CardTitle>
                  <CardDescription>{line.products?.name ?? "Blind count"} · assigned cycle-count line</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-[minmax(160px,260px)_1fr]">
                  <div className="grid gap-2">
                    <Label htmlFor={`qty-${line.id}`}>{status === "recount" ? "Recount quantity" : "Count quantity"}</Label>
                    <Input
                      id={`qty-${line.id}`}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      value={qtyValue}
                      onChange={(event) => setEntryQty((current) => ({ ...current, [line.id]: event.target.value }))}
                    />
                    <Button
                      disabled={!online || submitMutation.isPending || qtyValue.trim() === ""}
                      onClick={() => submitMutation.mutate({ lineId: line.id, quantity: Number(qtyValue) })}
                    >
                      Submit blind count
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`exception-${line.id}`}>Cannot count reason</Label>
                    <Textarea
                      id={`exception-${line.id}`}
                      value={reason}
                      onChange={(event) => setExceptionReason((current) => ({ ...current, [line.id]: event.target.value }))}
                      placeholder="Blocked location, damaged pallet, unsafe access..."
                    />
                    <Button
                      variant="outline"
                      disabled={!online || exceptionMutation.isPending || reason.trim().length < 3}
                      onClick={() => exceptionMutation.mutate({ lineId: line.id, reason })}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Flag exception
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {isSupervisor && (
          <TabsContent value="approvals" className="mt-4 grid gap-3">
            {reviewLines.length === 0 ? (
              <EmptyState title="No variances waiting" body="Over-threshold recounts appear here for approval or rejection." />
            ) : reviewLines.map((line: any) => {
              const reason = approvalReason[line.id] ?? "";
              return (
                <Card key={line.id} className="border-amber-500/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                      <span>{line.count.count_number} · {line.products?.sku ?? "Product"}</span>
                      <Badge variant="destructive">Variance hold</Badge>
                    </CardTitle>
                    <CardDescription>
                      {locationLabel(line.locations)} · first {formatNumber(line.first_count_qty)} · recount {formatNumber(line.recount_qty)} · expected {formatNumber(line.expected_quantity)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">Qty variance {formatNumber(line.variance_quantity)}</Badge>
                      <Badge variant="outline">{Number(line.variance_percent ?? 0).toFixed(1)}%</Badge>
                    </div>
                    <Textarea
                      value={reason}
                      onChange={(event) => setApprovalReason((current) => ({ ...current, [line.id]: event.target.value }))}
                      placeholder="Approval or rejection reason"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!online || approveMutation.isPending || reason.trim().length < 3} onClick={() => approveMutation.mutate({ lineId: line.id, reason })}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Approve and post
                      </Button>
                      <Button variant="outline" disabled={!online || rejectMutation.isPending || reason.trim().length < 3} onClick={() => rejectMutation.mutate({ lineId: line.id, reason })}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject for recount
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!createMutation.isPending) setCreateOpen(open); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Count
            </DialogTitle>
            <DialogDescription>Supervisors create a frozen bin claim before counters enter quantities.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <Select value={form.watch("warehouse_id") ?? ""} onValueChange={(value) => form.setValue("warehouse_id", value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>
                {(options?.warehouses ?? []).map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.watch("scope")} onValueChange={(value: any) => form.setValue("scope", value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Scope" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spot">Spot/bin</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="zone">Zone/aisle sweep</SelectItem>
                <SelectItem value="sku">SKU</SelectItem>
                <SelectItem value="abc">ABC scheduled class</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.watch("zone_id") || "none"} onValueChange={(value) => form.setValue("zone_id", value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any zone</SelectItem>
                {(options?.zones ?? []).map((zone: any) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.watch("location_id") || "none"} onValueChange={(value) => form.setValue("location_id", value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any location</SelectItem>
                {(options?.locations ?? []).map((location: any) => <SelectItem key={location.id} value={location.id}>{location.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.watch("product_id") || "none"} onValueChange={(value) => form.setValue("product_id", value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any product</SelectItem>
                {(options?.products ?? []).map((product: any) => <SelectItem key={product.id} value={product.id}>{product.sku}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.watch("assigned_user_id") || "none"} onValueChange={(value) => form.setValue("assigned_user_id", value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Assign counter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned queue</SelectItem>
                {(options?.profiles ?? []).map((profile: any) => (
                  <SelectItem key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="variance_threshold_percent">Variance %</Label>
                <Input id="variance_threshold_percent" type="number" step="0.1" {...form.register("variance_threshold_percent")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="freeze_hours">Freeze hours</Label>
                <Input id="freeze_hours" type="number" min={1} max={168} {...form.register("freeze_hours")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!online || createMutation.isPending}>
                {createMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                Freeze and create count
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
