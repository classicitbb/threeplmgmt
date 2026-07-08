import { createLabelRecord } from "@/features/receiving/receiving-core";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  buildPalletCode,
  cycleCountSchema,
  formatSupabaseError,
  throwIfSupabaseError,
} from "@/features/shared/core-types";
import { upsertRecord } from "@/features/admin/admin-core";
import { releaseCycleCountFreezes } from "@/features/cycle-counts/freeze-core";

const TERMINAL_LINE_STATUSES = new Set(["adjusted", "reconciled", "exception"]);

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Sign in is required for cycle-count actions.");
  return data.user.id;
}

function variancePercent(expectedQuantity: number, varianceQuantity: number) {
  if (expectedQuantity === 0) return varianceQuantity === 0 ? 0 : 100;
  return Math.abs((varianceQuantity / expectedQuantity) * 100);
}

function isReviewRequired(input: {
  varianceQuantity: number;
  variancePercent: number;
  thresholdPercent: number;
  unitCost?: number | null;
  valueFloor?: number | null;
}) {
  const percentHit = Math.abs(input.variancePercent) > Number(input.thresholdPercent ?? 0);
  const varianceValue = Math.abs(input.varianceQuantity) * Number(input.unitCost ?? 0);
  const valueHit = Number(input.unitCost ?? 0) > 0 && varianceValue >= Number(input.valueFloor ?? 0);
  return { reviewRequired: percentHit || valueHit, varianceValue };
}

async function holdLocationStock(locationId: string) {
  const { data: balances, error } = await db("inventory_balances")
    .select("id, pallet_id, available_quantity, held_quantity")
    .eq("location_id", locationId)
    .eq("status", "available")
    .gt("available_quantity", 0);
  if (error) throw new Error(formatSupabaseError(error, "Could not load stock to freeze."));

  for (const balance of balances ?? []) {
    const availableQuantity = Number(balance.available_quantity ?? 0);
    if (availableQuantity <= 0) continue;

    const balanceUpdate = await db("inventory_balances")
      .update({
        available_quantity: 0,
        held_quantity: Number(balance.held_quantity ?? 0) + availableQuantity,
      } as any)
      .eq("id", balance.id);
    throwIfSupabaseError(balanceUpdate, "Could not freeze inventory balance.");

    if (balance.pallet_id) {
      const { data: pallet, error: palletError } = await db("pallets")
        .select("available_quantity, held_quantity")
        .eq("id", balance.pallet_id)
        .maybeSingle();
      if (palletError) throw new Error(formatSupabaseError(palletError, "Could not load pallet to freeze."));
      if (pallet) {
        const palletAvailable = Number(pallet.available_quantity ?? 0);
        const palletUpdate = await db("pallets")
          .update({
            available_quantity: 0,
            held_quantity: Number(pallet.held_quantity ?? 0) + palletAvailable,
          } as any)
          .eq("id", balance.pallet_id);
        throwIfSupabaseError(palletUpdate, "Could not freeze pallet.");
      }
    }
  }
}

export async function createCycleCountFlow(input: z.infer<typeof cycleCountSchema>) {
  const payload = cycleCountSchema.parse(input);
  const userId = await currentUserId();

  const { data: warehouse, error: warehouseError } = await db("warehouses")
    .select("freeze_default_hours")
    .eq("id", payload.warehouse_id)
    .maybeSingle();
  if (warehouseError) throw new Error(formatSupabaseError(warehouseError, "Could not load warehouse settings."));

  const now = new Date();
  const freezeHours = Number(payload.freeze_hours ?? warehouse?.freeze_default_hours ?? 4);
  const freezeExpiresAt = addHours(now, Number.isFinite(freezeHours) && freezeHours > 0 ? freezeHours : 4).toISOString();

  const count = await upsertRecord("cycle_counts", {
    count_number: buildPalletCode("CNT"),
    warehouse_id: payload.warehouse_id,
    zone_id: payload.zone_id || null,
    location_id: payload.location_id || null,
    scope: payload.scope,
    status: "frozen",
    variance_threshold_percent: payload.variance_threshold_percent,
    snapshot_at: now.toISOString(),
    freeze_expires_at: freezeExpiresAt,
    initiated_by: userId,
  });

  let balanceQuery = db("inventory_balances")
    .select("*, products(unit_cost, velocity_class)")
    .eq("warehouse_id", payload.warehouse_id)
    .eq("status", "available")
    .gt("available_quantity", 0)
    .not("location_id", "is", null);

  if (payload.location_id) balanceQuery = balanceQuery.eq("location_id", payload.location_id);
  if (payload.zone_id) balanceQuery = balanceQuery.eq("zone_id", payload.zone_id);
  if (payload.product_id) balanceQuery = balanceQuery.eq("product_id", payload.product_id);

  const { data: balances, error } = await balanceQuery;
  if (error) throw new Error(formatSupabaseError(error, "Could not snapshot count balances."));

  const filteredBalances = payload.scope === "abc"
    ? (balances ?? []).filter((balance: any) => ["A", "B", "C"].includes(balance.products?.velocity_class ?? "C"))
    : (balances ?? []);

  const locationIds = Array.from(new Set(filteredBalances.map((balance: any) => balance.location_id).filter(Boolean)));
  const claimedLocationIds = new Set<string>();
  const skippedLocations: string[] = [];

  for (const locationId of locationIds) {
    const { error: freezeError } = await db("inventory_freezes").insert({
      cycle_count_id: count.id,
      warehouse_id: payload.warehouse_id,
      location_id: locationId,
      status: "active",
      expires_at: freezeExpiresAt,
      created_by: userId,
    } as any);

    if (freezeError) {
      skippedLocations.push(locationId);
      continue;
    }

    claimedLocationIds.add(locationId);
    await holdLocationStock(locationId);
  }

  let lineCount = 0;
  for (const balance of filteredBalances) {
    if (!balance.location_id || !claimedLocationIds.has(balance.location_id)) continue;
    await upsertRecord("cycle_count_lines", {
      cycle_count_id: count.id,
      location_id: balance.location_id,
      product_id: balance.product_id,
      pallet_id: balance.pallet_id,
      assigned_user_id: payload.assigned_user_id || null,
      expected_quantity: balance.quantity,
      variance_quantity: 0,
      variance_percent: 0,
      line_status: "queued",
      status: "queued",
    });
    lineCount += 1;
  }

  if (lineCount === 0) {
    await db("cycle_counts").update({ status: "cancelled", notes: "No eligible bins were claimed for this count." } as any).eq("id", count.id);
    throw new Error(skippedLocations.length > 0
      ? "No bins were claimed. Every matching bin is already frozen in another open count."
      : "No available stock matched this count scope.");
  }

  await db("cycle_counts")
    .update({
      status: "counting",
      notes: skippedLocations.length > 0 ? `${skippedLocations.length} frozen bin(s) skipped because another count already claimed them.` : null,
    } as any)
    .eq("id", count.id);

  await createLabelRecord("count_sheet", count.id, count.count_number);
  return { ...count, status: "counting", claimed_line_count: lineCount, skipped_location_count: skippedLocations.length };
}

export async function listCycleCounts() {
  const { data: counts, error } = await db("cycle_counts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(formatSupabaseError(error, "Failed to load cycle counts."));

  const countRows = counts ?? [];
  const countIds = countRows.map((count: any) => count.id).filter(Boolean);
  if (countIds.length === 0) return [];

  const [{ data: freezes, error: freezeError }, { data: lines, error: lineError }] = await Promise.all([
    db("inventory_freezes")
      .select("*")
      .in("cycle_count_id", countIds),
    db("cycle_count_lines")
      .select("*, products(*), locations(code, aisle, bay, level, position)")
      .in("cycle_count_id", countIds),
  ]);
  if (freezeError) throw new Error(formatSupabaseError(freezeError, "Failed to load cycle count freezes."));
  if (lineError) throw new Error(formatSupabaseError(lineError, "Failed to load cycle count lines."));

  const freezesByCount = new Map<string, any[]>();
  for (const freeze of freezes ?? []) {
    const rows = freezesByCount.get(freeze.cycle_count_id) ?? [];
    rows.push(freeze);
    freezesByCount.set(freeze.cycle_count_id, rows);
  }

  const linesByCount = new Map<string, any[]>();
  for (const line of lines ?? []) {
    const rows = linesByCount.get(line.cycle_count_id) ?? [];
    rows.push(line);
    linesByCount.set(line.cycle_count_id, rows);
  }

  return countRows.map((count: any) => ({
    ...count,
    inventory_freezes: freezesByCount.get(count.id) ?? [],
    cycle_count_lines: linesByCount.get(count.id) ?? [],
  }));
}

export async function listMyCycleCountLines() {
  const userId = await currentUserId();
  const { data, error } = await db("cycle_count_lines")
    .select("id, cycle_count_id, location_id, product_id, pallet_id, assigned_user_id, line_status, first_count_qty, first_counted_at, recount_qty, recounted_at, variance_quantity, variance_percent, exception_reason, products(sku, name), locations(code, aisle, bay, level, position)")
    .or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`)
    .in("line_status", ["queued", "recount"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error, "Failed to load assigned count lines."));
  return data ?? [];
}

export async function submitCycleCountLine(lineId: string, countedQuantity: number) {
  const userId = await currentUserId();
  if (!Number.isFinite(Number(countedQuantity)) || Number(countedQuantity) < 0) {
    throw new Error("Count quantity must be zero or greater.");
  }

  const { data: line, error: lineError } = await db("cycle_count_lines")
    .select("*, cycle_counts(variance_threshold_percent, warehouse_id), products(unit_cost)")
    .eq("id", lineId)
    .single();
  if (lineError) throw new Error(formatSupabaseError(lineError, "Could not load count line."));

  if (line.assigned_user_id && line.assigned_user_id !== userId) {
    throw new Error("This count line is assigned to another user.");
  }
  if (!["queued", "recount"].includes(line.line_status ?? line.status)) {
    throw new Error("This count line is no longer open for entry. Refresh the count.");
  }

  const { data: warehouse } = await db("warehouses")
    .select("variance_value_floor")
    .eq("id", line.cycle_counts?.warehouse_id)
    .maybeSingle();

  const expectedQuantity = Number(line.expected_quantity ?? 0);
  const finalQuantity = Number(countedQuantity);
  const varianceQuantity = finalQuantity - expectedQuantity;
  const percent = variancePercent(expectedQuantity, varianceQuantity);
  const thresholdPercent = Number(line.cycle_counts?.variance_threshold_percent ?? 5);
  const { reviewRequired } = isReviewRequired({
    varianceQuantity,
    variancePercent: percent,
    thresholdPercent,
    unitCost: line.products?.unit_cost,
    valueFloor: warehouse?.variance_value_floor,
  });

  if ((line.line_status ?? line.status) === "recount") {
    if (line.first_counted_by === userId) {
      throw new Error("Recount must be performed by a different user than the first count.");
    }

    const nextStatus = reviewRequired ? "variance_hold" : "reconciled";
    const update = await db("cycle_count_lines")
      .update({
        assigned_user_id: userId,
        recount_qty: finalQuantity,
        recounted_by: userId,
        recounted_at: new Date().toISOString(),
        variance_quantity: varianceQuantity,
        variance_percent: percent,
        line_status: nextStatus,
        status: nextStatus === "reconciled" ? "completed" : "exception",
      } as any)
      .eq("id", lineId)
      .eq("line_status", "recount");
    throwIfSupabaseError(update, "Could not submit recount.");
  } else {
    const nextStatus = reviewRequired ? "recount" : "reconciled";
    const update = await db("cycle_count_lines")
      .update({
        assigned_user_id: nextStatus === "recount" ? null : (line.assigned_user_id ?? userId),
        first_count_qty: finalQuantity,
        first_counted_by: userId,
        first_counted_at: new Date().toISOString(),
        variance_quantity: varianceQuantity,
        variance_percent: percent,
        line_status: nextStatus,
        status: nextStatus === "reconciled" ? "completed" : "assigned",
      } as any)
      .eq("id", lineId)
      .eq("line_status", "queued");
    throwIfSupabaseError(update, "Could not submit count.");
  }

  await updateCountHeaderStatus(line.cycle_count_id);
}

export async function approveCycleCountLine(lineId: string, reason: string) {
  const userId = await currentUserId();
  if (!reason.trim()) throw new Error("Approval reason is required.");

  const { data: line, error } = await db("cycle_count_lines")
    .select("*, cycle_counts(warehouse_id)")
    .eq("id", lineId)
    .single();
  if (error) throw new Error(formatSupabaseError(error, "Could not load count line for approval."));
  if (line.line_status !== "variance_hold") throw new Error("Only variance-hold lines can be approved.");
  if ([line.first_counted_by, line.recounted_by].filter(Boolean).includes(userId)) {
    throw new Error("You cannot approve a variance on a line you counted.");
  }

  const adjustment = await upsertRecord("stock_adjustments", {
    adjustment_number: buildPalletCode("ADJ"),
    pallet_id: line.pallet_id,
    inventory_balance_id: null,
    adjustment_type: "cycle_count",
    quantity_delta: line.variance_quantity,
    reason,
  });

  const finalQuantity = Number(line.recount_qty ?? line.first_count_qty ?? line.expected_quantity ?? 0);
  if (line.pallet_id) {
    const palletUpdate = await db("pallets")
      .update({ quantity: finalQuantity, held_quantity: finalQuantity, last_counted_at: new Date().toISOString() } as any)
      .eq("id", line.pallet_id);
    throwIfSupabaseError(palletUpdate, "Could not post approved pallet adjustment.");

    const balanceUpdate = await db("inventory_balances")
      .update({ quantity: finalQuantity, held_quantity: finalQuantity } as any)
      .eq("pallet_id", line.pallet_id);
    throwIfSupabaseError(balanceUpdate, "Could not post approved balance adjustment.");
  }

  const lineUpdate = await db("cycle_count_lines")
    .update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
      adjustment_id: adjustment.id,
      exception_reason: reason,
      line_status: "adjusted",
      status: "completed",
    } as any)
    .eq("id", lineId);
  throwIfSupabaseError(lineUpdate, "Could not mark count line approved.");

  await updateCountHeaderStatus(line.cycle_count_id);
}

export async function rejectCycleCountLine(lineId: string, reason: string) {
  if (!reason.trim()) throw new Error("Rejection reason is required.");
  const { data: line, error } = await db("cycle_count_lines")
    .select("cycle_count_id")
    .eq("id", lineId)
    .single();
  if (error) throw new Error(formatSupabaseError(error, "Could not load count line."));

  const update = await db("cycle_count_lines")
    .update({
      recount_qty: null,
      recounted_by: null,
      recounted_at: null,
      exception_reason: reason,
      line_status: "recount",
      status: "assigned",
    } as any)
    .eq("id", lineId)
    .eq("line_status", "variance_hold");
  throwIfSupabaseError(update, "Could not reject variance line.");
  await updateCountHeaderStatus(line.cycle_count_id);
}

export async function flagCycleCountLineException(lineId: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to flag a count exception.");
  const { data: line, error } = await db("cycle_count_lines")
    .select("cycle_count_id")
    .eq("id", lineId)
    .single();
  if (error) throw new Error(formatSupabaseError(error, "Could not load count line."));

  const update = await db("cycle_count_lines")
    .update({ line_status: "exception", status: "exception", exception_reason: reason, notes: reason } as any)
    .eq("id", lineId);
  throwIfSupabaseError(update, "Could not flag count exception.");
  await updateCountHeaderStatus(line.cycle_count_id);
}

export async function closeCycleCount(countId: string) {
  const { data: lines, error } = await db("cycle_count_lines")
    .select("id, line_status, pallet_id")
    .eq("cycle_count_id", countId);
  if (error) throw new Error(formatSupabaseError(error, "Could not load count lines."));

  const openLine = (lines ?? []).find((line: any) => !TERMINAL_LINE_STATUSES.has(line.line_status));
  if (openLine) throw new Error("Every count line must be reconciled, adjusted, or marked exception before closing.");

  await releaseCycleCountFreezes(countId);

  const palletIds = (lines ?? []).map((line: any) => line.pallet_id).filter(Boolean);
  if (palletIds.length > 0) {
    await db("pallets").update({ last_counted_at: new Date().toISOString() } as any).in("id", palletIds);
  }

  const update = await db("cycle_counts")
    .update({ status: "closed" } as any)
    .eq("id", countId);
  throwIfSupabaseError(update, "Could not close cycle count.");
}

async function updateCountHeaderStatus(countId: string) {
  const { data: lines, error } = await db("cycle_count_lines")
    .select("line_status")
    .eq("cycle_count_id", countId);
  if (error) {
    console.warn("[cycle-counts] status refresh skipped:", formatSupabaseError(error, "Could not refresh count status."));
    return;
  }

  const statuses = (lines ?? []).map((line: any) => line.line_status);
  const nextStatus = statuses.some((status: string) => ["variance_hold", "exception"].includes(status))
    ? "review"
    : statuses.every((status: string) => TERMINAL_LINE_STATUSES.has(status))
      ? "approved"
      : "counting";

  const update = await db("cycle_counts")
    .update({ status: nextStatus } as any)
    .eq("id", countId)
    .not("status", "in", "(closed,cancelled)");
  if (update.error) {
    console.warn("[cycle-counts] header status update skipped:", formatSupabaseError(update.error, "Could not update count header status."));
  }
}
