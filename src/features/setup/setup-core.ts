import { supabase } from "@/integrations/supabase/client";
import {
  db,
  formatSupabaseError,
  type WarehouseSetupPayload,
  type WarehouseSetupWarehouse,
  type WarehouseSetupZone,
  type WarehouseLocationTemplate,
  type TemperatureClass,
} from "@/features/shared/core-types";

export function createDefaultWarehouseSetupPayload(): WarehouseSetupPayload {
  return { warehouses: [], zones: [], locationTemplates: [] };
}

export function createBlankWarehouse(): WarehouseSetupWarehouse {
  return { code: "", name: "", city: "", country: "", hasCoolZone: false };
}

export function createBlankZone(warehouseCode = ""): WarehouseSetupZone {
  return {
    warehouseCode,
    code: "",
    name: "",
    temperatureClass: "ambient",
    isStaging: false,
    isDispatch: false,
    isQuarantine: false,
    sortOrder: 0,
  };
}

export function createBlankLocationTemplate(
  warehouseCode = "",
  zoneCode = "",
): WarehouseLocationTemplate {
  return {
    warehouseCode,
    zoneCode,
    aisleCount: 0,
    baysPerAisle: 0,
    levels: 0,
    positionsPerLevel: 0,
    depth: 0,
    locationType: "",
    temperatureClass: "ambient",
    mixedSkuAllowed: false,
    mixedLotAllowed: false,
    status: "active",
  };
}

export async function loadExistingSetupPayload(): Promise<WarehouseSetupPayload> {
  const [whR, zoneR, locR] = await Promise.all([
    db("warehouses").select("code, name, city, country").order("code"),
    db("zones").select("code, name, temperature_class, is_staging, is_dispatch, is_quarantine, sort_order, warehouses:warehouse_id(code)").order("sort_order"),
    db("locations").select("location_type, temperature_class, max_pallets, depth, position, mixed_sku_allowed, mixed_lot_allowed, status, aisle, bay, level, warehouses:warehouse_id(code), zones:zone_id(code, temperature_class)"),
  ]);
  if (whR.error) throw whR.error;
  if (zoneR.error) throw zoneR.error;
  if (locR.error) throw locR.error;

  const warehouses: WarehouseSetupWarehouse[] = (whR.data ?? []).map((w: any) => ({
    code: w.code,
    name: w.name ?? "",
    city: w.city ?? "",
    country: w.country ?? "",
    hasCoolZone: false,
  }));

  const zones: WarehouseSetupZone[] = (zoneR.data ?? []).map((z: any) => ({
    warehouseCode: z.warehouses?.code ?? "",
    code: z.code,
    name: z.name ?? "",
    temperatureClass: (z.temperature_class ?? "ambient") as TemperatureClass,
    isStaging: !!z.is_staging,
    isDispatch: !!z.is_dispatch,
    isQuarantine: !!z.is_quarantine,
    sortOrder: Number(z.sort_order ?? 0),
  }));

  // Mark warehouses that already have a cool zone
  for (const z of zones) {
    if (z.temperatureClass === "cool") {
      const wh = warehouses.find((w) => w.code === z.warehouseCode);
      if (wh) wh.hasCoolZone = true;
    }
  }

  // Derive one template per (warehouse, zone, location_type) using aggregate counts.
  const groups = new Map<string, WarehouseLocationTemplate & { _aisles: Set<string>; _bays: Set<string>; _levels: Set<string>; _positions: Set<string> }>();
  for (const l of (locR.data ?? []) as any[]) {
    const wCode = l.warehouses?.code ?? "";
    const zCode = l.zones?.code ?? "";
    if (!wCode || !zCode) continue;
    const key = `${wCode}|${zCode}|${l.location_type ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        warehouseCode: wCode,
        zoneCode: zCode,
        aisleCount: 0,
        baysPerAisle: 0,
        levels: 0,
        positionsPerLevel: 1,
        depth: Number(l.depth ?? l.max_pallets ?? 1),
        locationType: l.location_type ?? "rack",
        temperatureClass: (l.temperature_class ?? l.zones?.temperature_class ?? "ambient") as TemperatureClass,
        mixedSkuAllowed: !!l.mixed_sku_allowed,
        mixedLotAllowed: !!l.mixed_lot_allowed,
        status: l.status ?? "active",
        _aisles: new Set<string>(),
        _bays: new Set<string>(),
        _levels: new Set<string>(),
        _positions: new Set<string>(),
      };
      groups.set(key, g);
    }
    if (l.aisle != null) g!._aisles.add(String(l.aisle));
    if (l.bay != null) g!._bays.add(String(l.bay));
    if (l.level != null) g!._levels.add(String(l.level));
    if (l.position != null) g!._positions.add(String(l.position));
  }
  const locationTemplates: WarehouseLocationTemplate[] = Array.from(groups.values()).map((g) => {
    const { _aisles, _bays, _levels, _positions, ...rest } = g;
    return {
      ...rest,
      aisleCount: _aisles.size || 1,
      baysPerAisle: Math.max(1, Math.ceil((_bays.size || 1) / Math.max(1, _aisles.size || 1))),
      levels: _levels.size || 1,
      positionsPerLevel: _positions.size || 1,
    };
  });

  return { warehouses, zones, locationTemplates };
}

export async function resetWmsData() {
  const { data, error } = await (supabase.rpc as any)("reset_wms_data");
  if (error) throw error;
  return data as {
    status?: string;
    deleted_users?: number;
    removed_users?: number;
    kept_users?: number;
    preserved_users?: number;
    message?: string;
  };
}

export type CascadeDeleteResult =
  | { ok: true }
  | { ok: false; blocked_by: Array<{ table: string; count: number }> };

async function callCascadeDelete(rpc: string, id: string): Promise<CascadeDeleteResult> {
  const { data, error } = await (supabase.rpc as any)(rpc, { in_id: id });
  if (error) throw error;
  return data as CascadeDeleteResult;
}

export const deleteWarehouseCascade = (id: string) => callCascadeDelete("delete_warehouse_cascade", id);
export const deleteZoneCascade = (id: string) => callCascadeDelete("delete_zone_cascade", id);
export const deleteLocationCascade = (id: string) => callCascadeDelete("delete_location_cascade", id);
export const deleteProductCascade = (id: string) => callCascadeDelete("delete_product_cascade", id);
export const deleteClientCascade = (id: string) => callCascadeDelete("delete_client_cascade", id);

export async function deleteResourceCascade(table: string, id: string): Promise<CascadeDeleteResult> {
  switch (table) {
    case "warehouses": return deleteWarehouseCascade(id);
    case "zones": return deleteZoneCascade(id);
    case "locations": return deleteLocationCascade(id);
    case "products": return deleteProductCascade(id);
    case "clients": return deleteClientCascade(id);
    default: throw new Error(`No cascade delete available for ${table}`);
  }
}

export async function runWarehouseSetup(setupPayload: WarehouseSetupPayload, seedMode: "structure_only" | "starter_ops" = "structure_only") {
  const { data, error } = await (supabase.rpc as any)("run_warehouse_setup", {
    setup_payload: setupPayload,
    seed_mode: seedMode,
  });
  if (error) throw error;
  return data;
}

export type LocationRangeInput = {
  prefix: string;
  startBay: number;
  endBay: number;
  positionsPerLevel: number;
  levels: number;
  depth: number;
};

export type ExpandedLocationRow = {
  aisle: string;
  bay: string;
  level: number;
  position: number;
  depth: number;
  maxPallets: number;
  localCode: string;
};

/**
 * Expand a rack range into one row per physical slot.
 * Total = (endBay - startBay + 1) * levels * positionsPerLevel.
 * Each slot's capacity = depth (1-5 pallets deep).
 */
export function expandLocationRange(input: LocationRangeInput): ExpandedLocationRow[] {
  const rows: ExpandedLocationRow[] = [];
  const startBay = Math.max(1, Math.floor(input.startBay));
  const endBay = Math.max(startBay, Math.floor(input.endBay));
  const levels = Math.max(1, Math.min(6, Math.floor(input.levels)));
  const positions = Math.max(1, Math.min(3, Math.floor(input.positionsPerLevel)));
  const depth = Math.max(1, Math.min(5, Math.floor(input.depth)));
  for (let bay = startBay; bay <= endBay; bay += 1) {
    for (let level = 1; level <= levels; level += 1) {
      for (let position = 1; position <= positions; position += 1) {
        rows.push({
          aisle: input.prefix,
          bay: String(bay).padStart(2, "0"),
          level,
          position,
          depth,
          maxPallets: depth,
          localCode: `${input.prefix}-${String(bay).padStart(2, "0")}-L${String(level).padStart(2, "0")}-P${position}`,
        });
      }
    }
  }
  return rows;
}

export interface RackLocationParts {
  rack: string;
  aisle: number;
  bay: number;
  level: number;
  position: number;
}

/** Parse the local (non-prefixed) part of a rack location code, e.g. "A-1-01-L01-P01". */
export function parseRackLocationCode(localCode: string): RackLocationParts | null {
  const m = /^([A-Z])-(\d+)-(\d{1,2})-L(\d{1,2})-P(\d{1,2})$/i.exec(localCode.trim());
  if (!m) return null;
  return {
    rack: m[1].toUpperCase(),
    aisle: parseInt(m[2], 10),
    bay: parseInt(m[3], 10),
    level: parseInt(m[4], 10),
    position: parseInt(m[5], 10),
  };
}

/** Build the local (non-prefixed) rack location code from its parts. */
export function buildRackLocationCode(parts: RackLocationParts): string {
  return `${parts.rack.toUpperCase()}-${parts.aisle}-${String(parts.bay).padStart(2, "0")}-L${String(parts.level).padStart(2, "0")}-P${String(parts.position).padStart(2, "0")}`;
}

/**
 * Given existing full location codes and a rack/aisle/bay/level, return the next unused position number.
 * Strips the warehouse-zone prefix from each code before parsing.
 */
export function suggestNextRackPosition(
  existingCodes: string[],
  rack: string,
  aisle: number,
  bay: number,
  level: number,
): number {
  const used = existingCodes
    .map((c) => {
      const parts = c.split("-");
      const local = parts.length >= 5 ? parts.slice(-5).join("-") : c;
      return parseRackLocationCode(local);
    })
    .filter(
      (p): p is RackLocationParts =>
        p !== null &&
        p.rack === rack.toUpperCase() &&
        p.aisle === aisle &&
        p.bay === bay &&
        p.level === level,
    )
    .map((p) => p.position);
  return used.length > 0 ? Math.max(...used) + 1 : 1;
}

export type BayOccupancyCell = {
  locationId: string;
  locationCode: string;
  level: number | string | null;
  position?: number | string | null;
  depth: number | string | null;
  maxPallets: number;
  occupiedPallets: number;
  status: string;
  isFull: boolean;
};

export type BayOccupancyGridSlot = {
  level: number;
  position: number;
  cell: BayOccupancyCell | null;
};

const BAY_LEVEL_LIMIT = 7;
const BAY_POSITION_LIMIT = 3;

function readPositiveNumber(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readLevelFromCode(code: string): number | null {
  return readPositiveNumber(code.match(/(?:^|-)L(\d+)(?:-|$)/i)?.[1]);
}

function readPositionFromCode(code: string): number | null {
  return readPositiveNumber(code.match(/(?:^|-)P(\d+)$/i)?.[1]);
}

export function getBayCellLevel(cell: BayOccupancyCell): number | null {
  return readPositiveNumber(cell.level) ?? readLevelFromCode(cell.locationCode);
}

export function getBayCellPosition(cell: BayOccupancyCell): number | null {
  return readPositiveNumber(cell.position) ?? readPositionFromCode(cell.locationCode);
}

export function buildBayOccupancyGrid(cells: BayOccupancyCell[]): BayOccupancyGridSlot[][] {
  const visibleCells = cells
    .map((cell) => ({
      cell,
      level: getBayCellLevel(cell),
      position: getBayCellPosition(cell),
    }))
    .filter((item): item is { cell: BayOccupancyCell; level: number; position: number } =>
      item.level !== null &&
      item.position !== null &&
      item.level <= BAY_LEVEL_LIMIT &&
      item.position <= BAY_POSITION_LIMIT,
    );

  const maxLevel = Math.min(
    BAY_LEVEL_LIMIT,
    Math.max(1, ...visibleCells.map((item) => item.level)),
  );
  const maxPosition = BAY_POSITION_LIMIT;
  const cellsBySlot = new Map<string, BayOccupancyCell>();
  for (const item of visibleCells) {
    cellsBySlot.set(`${item.level}:${item.position}`, item.cell);
  }

  const rows: BayOccupancyGridSlot[][] = [];
  for (let level = maxLevel; level >= 1; level -= 1) {
    const row: BayOccupancyGridSlot[] = [];
    for (let position = 1; position <= maxPosition; position += 1) {
      row.push({
        level,
        position,
        cell: cellsBySlot.get(`${level}:${position}`) ?? null,
      });
    }
    rows.push(row);
  }
  return rows;
}
