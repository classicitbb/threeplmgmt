import { supabase } from "@/integrations/supabase/client";
import {
  db,
  buildPalletCode,
  getStoredPalletCount,
  validatePutawayAssignment,
  formatSupabaseError,
} from "@/features/shared/core-types";
import { writeSystemLog } from "@/features/system/system-core";
import { upsertRecord } from "@/features/admin/admin-core";

export async function listMoveTasks() {
  const { data, error } = await db("move_tasks")
    .select("*, pallets(pallet_barcode, products(*)), from_location:from_location_id(code, aisle, bay, level, depth), to_location:to_location_id(code, aisle, bay, level, depth)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMoveTask(palletBarcode: string, toLocationCode: string, reason?: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, current_location_id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id")
    .eq("code", toLocationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${toLocationCode}`);

  await upsertRecord("move_tasks", {
    task_number: buildPalletCode("MOV"),
    pallet_id: pallet.id,
    warehouse_id: pallet.warehouse_id,
    from_location_id: pallet.current_location_id,
    to_location_id: toLocation.id,
    status: "queued",
    reason: reason ?? null,
  });
}


// ── Move destination preflight validation ────────────────────────────────────

export type MoveValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; reason: string; warnings: string[] };

/**
 * Pre-flight check before moving a pallet to a location.
 * Returns `valid: true` (possibly with soft warnings) or `valid: false` with a
 * human-readable `reason` the UI can display to the operator.
 */
export async function validateMoveDestination(
  palletBarcode: string,
  locationCode: string,
): Promise<MoveValidationResult> {
  const warnings: string[] = [];

  // ── Fetch pallet ──────────────────────────────────────────────────────────
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, product_id, warehouse_id, current_location_id, status")
    .eq("pallet_barcode", palletBarcode)
    .maybeSingle();
  if (palletErr || !pallet) {
    return { valid: false, reason: `Pallet "${palletBarcode}" not found`, warnings };
  }
  if (["shipped", "cancelled", "retired"].includes(pallet.status ?? "")) {
    return { valid: false, reason: `Pallet is ${pallet.status} and cannot be moved`, warnings };
  }

  // ── Fetch location ────────────────────────────────────────────────────────
  const { data: location, error: locErr } = await db("locations")
    .select(
      "id, code, status, max_pallets, temperature_class, mixed_sku_allowed, mixed_lot_allowed, max_pallet_height_cm, zone_id, warehouse_id",
    )
    .eq("code", locationCode.toUpperCase())
    .maybeSingle();
  if (locErr || !location) {
    return { valid: false, reason: `Location "${locationCode.toUpperCase()}" does not exist`, warnings };
  }
  if (location.status !== "active") {
    return {
      valid: false,
      reason: `Location ${locationCode.toUpperCase()} is ${location.status ?? "inactive"} — moves are not permitted`,
      warnings,
    };
  }

  // ── Warehouse boundary ────────────────────────────────────────────────────
  if (location.warehouse_id && pallet.warehouse_id && location.warehouse_id !== pallet.warehouse_id) {
    return {
      valid: false,
      reason: "Destination location belongs to a different warehouse than the pallet",
      warnings,
    };
  }

  // ── Capacity ──────────────────────────────────────────────────────────────
  const maxPallets = Number(location.max_pallets ?? 0);
  if (maxPallets > 0) {
    const occupied = await getStoredPalletCount(location.id);
    // Check whether this pallet is already at the location (would be a no-op but not a capacity problem)
    const alreadyHere = pallet.current_location_id === location.id;
    if (!alreadyHere && occupied >= maxPallets) {
      return {
        valid: false,
        reason: `Location ${locationCode.toUpperCase()} is full (${occupied}/${maxPallets} pallets)`,
        warnings,
      };
    }
    if (!alreadyHere && occupied >= maxPallets - 1 && maxPallets > 1) {
      warnings.push(`Location will be at capacity after this move (${occupied + 1}/${maxPallets})`);
    }
  }

  // ── Temperature ───────────────────────────────────────────────────────────
  if (pallet.product_id) {
    const { data: product } = await db("products")
      .select("temperature_class, sku, pallet_height_cm")
      .eq("id", pallet.product_id)
      .maybeSingle();
    if (product) {
      const productTemp = (product.temperature_class ?? "ambient") as TemperatureClass;
      const locTemp = (location.temperature_class ?? "ambient") as TemperatureClass;
      if (productTemp === "cool" && locTemp !== "cool") {
        return {
          valid: false,
          reason: `Cool-chain product (${product.sku}) cannot be placed in an ambient location`,
          warnings,
        };
      }
      if (productTemp === "ambient" && locTemp === "cool") {
        warnings.push(`Moving an ambient product into a cool-chain location — verify this is intentional`);
      }

      // ── Height ─────────────────────────────────────────────────────────────
      const palletH = Number(product.pallet_height_cm ?? 0);
      const locH = Number(location.max_pallet_height_cm ?? 0);
      if (palletH > 0 && locH > 0 && palletH > locH) {
        return {
          valid: false,
          reason: `Pallet height ${palletH} cm exceeds location ceiling of ${locH} cm`,
          warnings,
        };
      }

      // ── Mixed SKU ──────────────────────────────────────────────────────────
      if (location.mixed_sku_allowed === false) {
        // Check if there's already a different SKU in this location
        const { data: existingBalances } = await db("inventory_balances")
          .select("pallets:pallet_id(product_id)")
          .eq("location_id", location.id)
          .not("pallet_id", "eq", pallet.id)
          .not("status", "in", DB_RETIRED_INVENTORY_STATUS_FILTER)
          .limit(1);
        const otherProductId = (existingBalances as any[])?.[0]?.pallets?.product_id;
        if (otherProductId && otherProductId !== pallet.product_id) {
          return {
            valid: false,
            reason: `Location ${locationCode.toUpperCase()} does not allow mixed-SKU storage`,
            warnings,
          };
        }
      }
    }
  }

  // ── Same location (no-op warning) ─────────────────────────────────────────
  if (pallet.current_location_id === location.id) {
    warnings.push("Pallet is already at this location — move will record but not change anything");
  }

  return { valid: true, warnings };
}

export async function completeDirectMove(palletBarcode: string, locationCode: string, reason?: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, current_location_id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id, zone_id")
    .eq("code", locationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${locationCode}`);

  const completedAt = new Date().toISOString();
  const task = await upsertRecord("move_tasks", {
    task_number: buildPalletCode("MOV"),
    pallet_id: pallet.id,
    warehouse_id: pallet.warehouse_id,
    from_location_id: pallet.current_location_id,
    to_location_id: toLocation.id,
    status: "completed",
    reason: reason ?? null,
    completed_at: completedAt,
  });

  const { error: palletUpdErr } = await db("pallets")
    .update({ current_location_id: toLocation.id } as any)
    .eq("id", pallet.id);
  if (palletUpdErr) throw palletUpdErr;

  const { error: balanceUpdErr } = await db("inventory_balances")
    .update({ location_id: toLocation.id, zone_id: toLocation.zone_id ?? null } as any)
    .eq("pallet_id", pallet.id)
    .not("status", "in", DB_RETIRED_INVENTORY_STATUS_FILTER);
  if (balanceUpdErr) throw balanceUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_completed",
    in_entity_table: "move_tasks",
    in_entity_id: (task as any).id,
    in_warehouse_id: pallet.warehouse_id,
    in_metadata: {
      task_number: (task as any).task_number,
      pallet_barcode: palletBarcode,
      to_location_code: locationCode,
      reason: reason ?? null,
    },
  });
}

export async function completeMoveTask(taskId: string, scannedPalletBarcode: string, scannedLocationCode: string): Promise<void> {
  const { data: task, error: taskErr } = await db("move_tasks").select("*").eq("id", taskId).single();
  if (taskErr) throw taskErr;
  if (["completed", "cancelled"].includes(task.status)) {
    throw new Error("Move task is already closed.");
  }

  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, pallet_barcode, current_location_id, warehouse_id")
    .eq("pallet_barcode", scannedPalletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${scannedPalletBarcode}`);
  if (task.pallet_id !== pallet.id) {
    throw new Error("Scanned pallet does not match this move task.");
  }

  const { data: toLocation, error: locErr } = await db("locations")
    .select("id, zone_id")
    .eq("code", scannedLocationCode)
    .single();
  if (locErr) throw new Error(`Location not found: ${scannedLocationCode}`);

  const { error: palletUpdErr } = await db("pallets")
    .update({ current_location_id: toLocation.id } as any)
    .eq("id", pallet.id);
  if (palletUpdErr) throw palletUpdErr;

  const { error: balanceUpdErr } = await db("inventory_balances")
    .update({ location_id: toLocation.id, zone_id: toLocation.zone_id ?? null } as any)
    .eq("pallet_id", pallet.id)
    .not("status", "in", DB_RETIRED_INVENTORY_STATUS_FILTER);
  if (balanceUpdErr) throw balanceUpdErr;

  const { error: taskUpdErr } = await db("move_tasks")
    .update({ status: "completed", to_location_id: toLocation.id, completed_at: new Date().toISOString() } as any)
    .eq("id", taskId);
  if (taskUpdErr) throw taskUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_completed",
    in_entity_table: "move_tasks",
    in_entity_id: taskId,
    in_warehouse_id: task.warehouse_id,
    in_metadata: { pallet_barcode: scannedPalletBarcode, to_location: scannedLocationCode },
  });
}

export async function cancelMoveTask(taskId: string): Promise<void> {
  const { data: task, error: taskErr } = await db("move_tasks").select("*").eq("id", taskId).single();
  if (taskErr) throw taskErr;
  if (!["queued", "in_progress"].includes(task.status)) {
    throw new Error("Only queued or in-progress move tasks can be cancelled.");
  }

  const { error: taskUpdErr } = await db("move_tasks")
    .update({ status: "cancelled" } as any)
    .eq("id", taskId);
  if (taskUpdErr) throw taskUpdErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "move_task_cancelled",
    in_entity_table: "move_tasks",
    in_entity_id: taskId,
    in_warehouse_id: task.warehouse_id,
    in_metadata: { pallet_id: task.pallet_id, from_location_id: task.from_location_id, to_location_id: task.to_location_id },
  });
}

export async function moveToPickingArea(palletBarcode: string): Promise<void> {
  const { data: pallet, error: palletErr } = await db("pallets")
    .select("id, warehouse_id")
    .eq("pallet_barcode", palletBarcode)
    .single();
  if (palletErr) throw new Error(`Pallet not found: ${palletBarcode}`);

  const { data: stagingLoc, error: locErr } = await db("locations")
    .select("id")
    .eq("warehouse_id", pallet.warehouse_id)
    .eq("is_staging", true)
    .limit(1)
    .maybeSingle();
  if (locErr) throw locErr;

  const toLocationId = stagingLoc?.id ?? null;
  const { error: updErr } = await db("pallets")
    .update({ current_location_id: toLocationId } as any)
    .eq("id", pallet.id);
  if (updErr) throw updErr;

  await (supabase.rpc as any)("log_audit_event", {
    in_event_type: "pallet_moved_to_picking_area",
    in_entity_table: "pallets",
    in_entity_id: pallet.id,
    in_warehouse_id: pallet.warehouse_id,
    in_metadata: { pallet_barcode: palletBarcode },
  });
}
