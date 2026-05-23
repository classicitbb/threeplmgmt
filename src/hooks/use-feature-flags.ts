import { createContext, useCallback, useContext, useState } from "react";

export type ModuleKey =
  | "receiving"
  | "putaway"
  | "inventory"
  | "transfers"
  | "pick-lists"
  | "products"
  | "warehouses"
  | "zones"
  | "locations"
  | "users"
  | "settings"
  | "clients"
  | "packaging"
  | "cycle-counts"
  | "reports"
  | "status"
  | "system-log"
  | "email-log";

export const STARTER_MODULES: Record<ModuleKey, boolean> = {
  receiving: true,
  putaway: true,
  inventory: true,
  transfers: true,
  "pick-lists": true,
  products: true,
  warehouses: true,
  zones: true,
  locations: true,
  users: true,
  settings: true,
  clients: false,
  packaging: false,
  "cycle-counts": false,
  reports: false,
  status: false,
  "system-log": false,
  "email-log": false,
};

const MODULE_LABELS: Record<ModuleKey, { label: string; description: string }> = {
  receiving: { label: "Receiving", description: "Receive stock and create pallet labels" },
  putaway: { label: "Put-Away", description: "Scan pallets into storage locations" },
  inventory: { label: "Inventory Search", description: "Search and inspect current stock" },
  transfers: { label: "Transfers", description: "Move pallets between warehouses and picking areas" },
  "pick-lists": { label: "Pick Lists", description: "Create and execute pick orders" },
  products: { label: "Products", description: "Manage product catalogue and SKUs" },
  warehouses: { label: "Warehouses", description: "Add and configure warehouse sites" },
  zones: { label: "Zones", description: "Define temperature and functional zones" },
  locations: { label: "Locations / Bins", description: "Configure bin locations and capacity limits" },
  users: { label: "Users & Roles", description: "Invite users and manage role assignments" },
  settings: { label: "Settings", description: "Environment, client variables, and system config" },
  clients: { label: "Clients", description: "Manage 3PL clients and stock ownership" },
  packaging: { label: "Packaging Profiles", description: "Pallet dimension templates" },
  "cycle-counts": { label: "Cycle Counts", description: "Schedule and execute inventory audits" },
  reports: { label: "Reports", description: "Export operational and financial reports" },
  status: { label: "Status Controls", description: "Manually adjust pallet and task statuses" },
  "system-log": { label: "System Log", description: "Audit trail and system event history" },
  "email-log": { label: "Email Log", description: "Outbound email delivery records" },
};

export { MODULE_LABELS };

const STORAGE_KEY = "wms.modules.v1";

function loadFlags(): Record<ModuleKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...STARTER_MODULES, ...(JSON.parse(raw) as Record<ModuleKey, boolean>) };
  } catch {
    // ignore
  }
  return { ...STARTER_MODULES };
}

function saveFlags(flags: Record<ModuleKey, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

type FeatureFlagContextValue = {
  flags: Record<ModuleKey, boolean>;
  isEnabled: (key: ModuleKey) => boolean;
  setModule: (key: ModuleKey, enabled: boolean) => void;
  resetToStarter: () => void;
};

export const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export function useFeatureFlagState(): FeatureFlagContextValue {
  const [flags, setFlags] = useState<Record<ModuleKey, boolean>>(loadFlags);

  const isEnabled = useCallback((key: ModuleKey) => flags[key] ?? true, [flags]);

  const setModule = useCallback((key: ModuleKey, enabled: boolean) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: enabled };
      saveFlags(next);
      return next;
    });
  }, []);

  const resetToStarter = useCallback(() => {
    const defaults = { ...STARTER_MODULES };
    setFlags(defaults);
    saveFlags(defaults);
  }, []);

  return { flags, isEnabled, setModule, resetToStarter };
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error("useFeatureFlags must be used inside FeatureFlagProvider");
  return ctx;
}
