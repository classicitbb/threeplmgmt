import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  buildPalletCode,
  DB_RETIRED_INVENTORY_STATUS_FILTER,
  throwIfSupabaseError,
  pickListSchema,
  type InventoryStatus,
} from "@/features/shared/core-types";
import { upsertRecord } from "@/features/admin/admin-core";
import { createLabelRecord } from "@/features/receiving/receiving-core";

async function selectPickCandidates(productId: string, warehouseId: string, quantity: number) {
  const { data: product } = await db("products").select("*").eq("id", productId).single();

  const { data, error } = await db("inventory_balances")
    .select("pallet_id, location_id, available_quantity, expiry_date, received_at")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .eq("status", "available")
    .gt("available_quantity", 0);
  if (error) throw error;

  const candidates = [...(data ?? [])].sort((left, right) => {
    if (product?.rotation_method === "fefo") {
      return (left.expiry_date ?? "9999-12-31").localeCompare(right.expiry_date ?? "9999-12-31");
    }
    return String(left.received_at ?? "").localeCompare(String(right.received_at ?? ""));
  });

  const chosen: any[] = [];
  let remaining = quantity;
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    chosen.push(candidate);
    remaining -= candidate.available_quantity;
  }

  return { candidates: chosen, short: remaining > 0 ? remaining : 0 };
}

export async function createPickListFlow(input: z.infer<typeof pickListSchema>) {
  const payload = pickListSchema.parse(input);
  // Ensure the order number is unique even if the operator re-uses one they
  // already typed (the orders table has a unique constraint on order_number).
  // We try the supplied number first, then fall back to suffixed retries.
  const baseOrderNumber = payload.order_number;
  let order: any;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidateNumber = attempt === 0
      ? baseOrderNumber
      : `${baseOrderNumber}-${Date.now().toString().slice(-6)}${attempt > 1 ? `-${attempt}` : ""}`;
    const { data: existing } = await db("orders")
      .select("id")
      .eq("order_number", candidateNumber)
      .maybeSingle();
    if (existing) {
      attempt += 1;
      if (attempt > 5) throw new Error("Could not allocate a unique order number — try a different one.");
      continue;
    }
    order = await upsertRecord("orders", {
      order_number: candidateNumber,
      client_id: payload.client_id,
      warehouse_id: payload.warehouse_id,
      requested_ship_date: payload.requested_ship_date || null,
      status: "queued",
      notes: payload.notes || null,
    });
    break;
  }

  const pickList = await upsertRecord("pick_lists", {
    pick_list_number: buildPalletCode("PKL"),
    warehouse_id: payload.warehouse_id,
    client_id: payload.client_id,
    order_id: order.id,
    consolidated: payload.lines.length > 1,
    status: "queued",
    released_at: new Date().toISOString(),
    notes: payload.notes || null,
  });

  for (const line of payload.lines) {
    const orderLine = await upsertRecord("order_lines", {
      order_id: order.id,
      product_id: line.product_id,
      quantity: line.quantity,
    });

    const selection = await selectPickCandidates(line.product_id, payload.warehouse_id, line.quantity);
    for (const candidate of selection.candidates) {
      await upsertRecord("pick_tasks", {
        task_number: buildPalletCode("PKT"),
        pick_list_id: pickList.id,
        order_line_id: orderLine.id,
        pallet_id: candidate.pallet_id,
        location_id: candidate.location_id ?? null,
        requested_quantity: Math.min(candidate.available_quantity, line.quantity),
        status: selection.short > 0 ? "exception" : "queued",
        short_reason: selection.short > 0 ? `Short by ${selection.short}` : null,
      });
    }
  }

  await createLabelRecord("pick_list", pickList.id, pickList.pick_list_number);
  return pickList;
}

export async function listPickLists() {
  const { data, error } = await db("pick_lists")
    .select("*, pick_tasks(*, pallets(pallet_barcode, pallet_code, quantity, available_quantity, products(*)), locations:location_id(code))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}


export async function getPickExecution(pickListId: string) {
  const [pickList, pickTasks] = await Promise.all([
    db("pick_lists").select("*").eq("id", pickListId).single(),
    db("pick_tasks")
      .select("*, pallets(pallet_barcode, pallet_code, quantity, available_quantity, products(sku, name)), locations:location_id(code)")
      .eq("pick_list_id", pickListId)
      .order("created_at", { ascending: true }),
  ]);

  if (pickList.error) throw pickList.error;
  if (pickTasks.error) throw pickTasks.error;

  const enrichedTasks = await Promise.all(
    (pickTasks.data ?? []).map(async (task: any) => {
      if (!task.pallet_id || task.locations?.code) return task;
      const { data: balance } = await db("inventory_balances")
        .select("available_quantity, quantity, locations:location_id(code)")
        .eq("pallet_id", task.pallet_id)
        .maybeSingle();
      return { ...task, pick_balance: balance ?? null };
    }),
  );

  return {
    pickList: pickList.data,
    pickTasks: enrichedTasks,
  };
}

export async function confirmPickTask(taskId: string, scannedLocation: string, scannedPallet: string, confirmedQuantity: number, shortReason?: string) {
  const { data: task, error: taskError } = await db("pick_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (taskError) throw taskError;

  if (!task.pallet_id) {
    throw new Error("Task is not linked to a pallet.");
  }
  if (["completed", "cancelled"].includes(task.status)) {
    throw new Error("Pick task is already closed. Refresh the pick list.");
  }
  if (!Number.isFinite(Number(confirmedQuantity)) || Number(confirmedQuantity) < 0) {
    throw new Error("Confirmed pick quantity must be zero or greater.");
  }
  if (Number(confirmedQuantity) === 0 && !shortReason) {
    throw new Error("A short reason is required when confirming zero quantity.");
  }

  const [{ data: pallet, error: palletError }, { data: balance, error: balanceError }] = await Promise.all([
    db("pallets").select("*").eq("id", task.pallet_id).single(),
    db("inventory_balances").select("*").eq("pallet_id", task.pallet_id).single(),
  ]);

  if (palletError) throw palletError;
  if (balanceError) throw balanceError;
  if (pallet.pallet_barcode !== scannedPallet) {
    throw new Error("Scanned pallet does not match the task.");
  }

  const location = balance.location_id
    ? await db("locations").select("*").eq("id", balance.location_id).single()
    : { data: null, error: null };
  if (location.error) throw location.error;
  if (location.data && location.data.code !== scannedLocation) {
    throw new Error("Scanned location does not match the suggested pick location.");
  }

  let nextBalanceQuantity = Number(balance.quantity ?? 0);
  let fullyDepleted = false;

  if (Number(confirmedQuantity) > 0) {
    if (Number(confirmedQuantity) > Number(balance.available_quantity ?? 0)) {
      throw new Error(`Cannot pick ${confirmedQuantity}; only ${balance.available_quantity ?? 0} available on this pallet.`);
    }

    const nextAvailable = Math.max(balance.available_quantity - confirmedQuantity, 0);
    const nextStatus: InventoryStatus = nextAvailable === 0 ? PICK_COMPLETED_INVENTORY_STATUS : "available";
    fullyDepleted = nextAvailable === 0;
    const nextPalletQuantity = Math.max(Number(pallet.quantity ?? 0) - confirmedQuantity, 0);
    nextBalanceQuantity = Math.max(Number(balance.quantity ?? 0) - confirmedQuantity, 0);

    const palletUpdate = await db("pallets")
      .update(
        fullyDepleted
          ? {
              available_quantity: 0,
              quantity: 0,
              reserved_quantity: 0,
              status: nextStatus,
              current_location_id: null,
              is_stored: false,
            }
          : {
              available_quantity: nextAvailable,
              quantity: nextPalletQuantity,
              status: nextStatus,
            },
      )
      .eq("id", pallet.id);
    throwIfSupabaseError(palletUpdate, "Could not debit picked pallet.");

    const balanceUpdate = await db("inventory_balances")
      .update(
        fullyDepleted
          ? {
              available_quantity: 0,
              quantity: 0,
              reserved_quantity: 0,
              status: nextStatus,
              location_id: null,
              zone_id: null,
            }
          : {
              available_quantity: nextAvailable,
              quantity: nextBalanceQuantity,
              status: nextStatus,
            },
      )
      .eq("id", balance.id);
    throwIfSupabaseError(balanceUpdate, "Could not debit picked inventory balance.");
  }

  const taskUpdate = await db("pick_tasks")
    .update({
      confirmed_quantity: confirmedQuantity,
      short_reason: shortReason ?? null,
      status: shortReason ? "exception" : "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  throwIfSupabaseError(taskUpdate, "Could not close pick task after debiting inventory.");

  const pickAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pick",
    in_entity_table: "pick_tasks",
    in_entity_id: taskId,
    in_pallet_id: pallet.id,
    in_warehouse_id: balance.warehouse_id,
    in_from_location_id: balance.location_id,
    in_metadata: {
      confirmed_quantity: confirmedQuantity,
      short_reason: shortReason ?? null,
      previous_quantity: Number(balance.quantity ?? 0),
      remaining_quantity: nextBalanceQuantity,
      location_cleared: fullyDepleted,
    } as any,
  });
  if (pickAudit.error) console.error("[submitPickTaskLine] log_audit_event failed:", pickAudit.error);

  // Roll up the parent pick list if every sibling task is finished.
  if (task.pick_list_id) {
    const { data: siblings } = await db("pick_tasks")
      .select("id, status")
      .eq("pick_list_id", task.pick_list_id);
    const allDone = (siblings ?? []).every((row: any) =>
      ["completed", "cancelled", "exception"].includes(row.status),
    );
    if (allDone && (siblings ?? []).length > 0) {
      const { data: parent } = await db("pick_lists")
        .select("id, status, warehouse_id, order_id")
        .eq("id", task.pick_list_id)
        .single();
      if (parent && !["completed", "cancelled"].includes(parent.status)) {
        await db("pick_lists")
          .update({ status: "completed" })
          .eq("id", parent.id);
        if (parent.order_id) {
          await db("orders").update({ status: "completed" }).eq("id", parent.order_id);
        }
        const completeAudit = await (supabase.rpc as any)("log_audit_event", {
          in_event_type: "pick_list_completed",
          in_entity_table: "pick_lists",
          in_entity_id: parent.id,
          in_warehouse_id: parent.warehouse_id,
          in_metadata: {} as any,
        });
        if (completeAudit.error) console.error("[confirmPickTask] pick_list rollup audit failed:", completeAudit.error);
      }
    }
  }
}

export async function cancelPickList(pickListId: string, reason?: string) {
  const { data: pickList, error: pickListError } = await db("pick_lists")
    .select("*, pick_tasks(id, status)")
    .eq("id", pickListId)
    .single();
  if (pickListError) throw pickListError;
  if (["completed", "cancelled"].includes(pickList.status)) {
    throw new Error("Pick list is already closed.");
  }

  const trimmedReason = reason?.trim() || null;
  const noteSuffix = trimmedReason ? `Cancelled: ${trimmedReason}` : "Cancelled";
  const nextNotes = pickList.notes ? `${pickList.notes} · ${noteSuffix}` : noteSuffix;

  const openTaskIds = (pickList.pick_tasks ?? [])
    .filter((t: any) => !["completed", "cancelled"].includes(t.status))
    .map((t: any) => t.id);

  await db("pick_lists")
    .update({ status: "cancelled", notes: nextNotes })
    .eq("id", pickListId);

  if (openTaskIds.length > 0) {
    await db("pick_tasks")
      .update({ status: "cancelled", short_reason: trimmedReason })
      .in("id", openTaskIds);
  }

  if (pickList.order_id) {
    await db("orders").update({ status: "cancelled" }).eq("id", pickList.order_id);
  }

  const cancelAudit = await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pick_list_cancelled",
    in_entity_table: "pick_lists",
    in_entity_id: pickListId,
    in_warehouse_id: pickList.warehouse_id,
    in_metadata: { reason: trimmedReason } as any,
  });
  if (cancelAudit.error) console.error("[cancelPickList] log_audit_event failed:", cancelAudit.error);
}
