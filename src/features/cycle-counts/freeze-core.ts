import { supabase } from "@/integrations/supabase/client";
import { db, formatSupabaseError, throwIfSupabaseError } from "@/features/shared/core-types";

export type ActiveFreeze = {
  id: string;
  cycle_count_id: string;
  warehouse_id: string;
  location_id: string | null;
  pallet_id: string | null;
  expires_at: string;
  cycle_counts?: {
    count_number?: string | null;
    initiated_by?: string | null;
  } | null;
};

export class FrozenBinError extends Error {
  readonly code = "FROZEN_BIN" as const;
  readonly freeze: ActiveFreeze;

  constructor(freeze: ActiveFreeze) {
    const countNumber = freeze.cycle_counts?.count_number ?? freeze.cycle_count_id;
    super(`FROZEN_BIN: This bin is locked by cycle count ${countNumber} until ${new Date(freeze.expires_at).toLocaleString()}. Pick an alternate bin or notify a supervisor.`);
    this.name = "FrozenBinError";
    this.freeze = freeze;
  }
}

export async function getActiveFreeze(locationId: string, opts?: { palletId?: string | null }): Promise<ActiveFreeze | null> {
  let query = db("inventory_freezes")
    .select("*, cycle_counts(count_number, initiated_by)")
    .eq("status", "active")
    .order("frozen_at", { ascending: false })
    .limit(1);

  if (opts?.palletId) {
    query = query.or(`location_id.eq.${locationId},pallet_id.eq.${opts.palletId}`);
  } else {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(formatSupabaseError(error, "Freeze lookup failed"));
  return (data ?? null) as ActiveFreeze | null;
}

export async function assertNotFrozen(locationId: string | null | undefined, opts?: { palletId?: string | null }): Promise<void> {
  if (!locationId && !opts?.palletId) return;

  if (locationId) {
    const rpc = await (supabase.rpc as any)("assert_location_not_frozen", {
      in_location_id: locationId,
      in_pallet_id: opts?.palletId ?? null,
    });
    if (rpc.error) {
      const message = formatSupabaseError(rpc.error, "Location is frozen for cycle count.");
      if (message.includes("FROZEN_BIN")) throw new Error(message);
      throw new Error(message);
    }
  }

  const freeze = locationId ? await getActiveFreeze(locationId, opts) : null;
  if (freeze) throw new FrozenBinError(freeze);
}

export async function releaseCycleCountFreezes(cycleCountId: string, status: "released" | "expired" | "overridden" = "released") {
  const { data: freezes, error } = await db("inventory_freezes")
    .select("*")
    .eq("cycle_count_id", cycleCountId)
    .eq("status", "active");
  if (error) throw new Error(formatSupabaseError(error, "Could not load active freezes."));

  for (const freeze of freezes ?? []) {
    if (freeze.location_id) {
      const { data: balances, error: balanceError } = await db("inventory_balances")
        .select("id, pallet_id, available_quantity, held_quantity")
        .eq("location_id", freeze.location_id)
        .gt("held_quantity", 0);
      if (balanceError) throw new Error(formatSupabaseError(balanceError, "Could not restore frozen balances."));

      for (const balance of balances ?? []) {
        const heldQuantity = Number(balance.held_quantity ?? 0);
        const availableQuantity = Number(balance.available_quantity ?? 0);
        const balanceUpdate = await db("inventory_balances")
          .update({
            available_quantity: availableQuantity + heldQuantity,
            held_quantity: 0,
          } as any)
          .eq("id", balance.id);
        throwIfSupabaseError(balanceUpdate, "Could not release frozen inventory balance.");

        if (balance.pallet_id) {
          const { data: pallet } = await db("pallets")
            .select("available_quantity, held_quantity")
            .eq("id", balance.pallet_id)
            .maybeSingle();
          if (pallet) {
            const palletHeld = Number(pallet.held_quantity ?? 0);
            const palletAvailable = Number(pallet.available_quantity ?? 0);
            const palletUpdate = await db("pallets")
              .update({
                available_quantity: palletAvailable + palletHeld,
                held_quantity: 0,
              } as any)
              .eq("id", balance.pallet_id);
            throwIfSupabaseError(palletUpdate, "Could not release frozen pallet.");
          }
        }
      }
    }
  }

  const update = await db("inventory_freezes")
    .update({
      status,
      released_at: new Date().toISOString(),
    } as any)
    .eq("cycle_count_id", cycleCountId)
    .eq("status", "active");
  throwIfSupabaseError(update, "Could not mark freezes released.");
}
