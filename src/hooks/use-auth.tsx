import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type RoleCode =
  | "admin"
  | "warehouse_manager"
  | "inventory_clerk"
  | "warehouse_operator"
  | "dispatch_driver";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  roles: RoleCode[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowed: RoleCode[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const demoSessionKey = "warehouse-wizard-demo-session";

const demoUsers: Record<string, { id: string; fullName: string; roles: RoleCode[]; userCode: string; badgeCode: string }> = {
  "admin@warehousewizard.local": {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "System Admin",
    roles: ["admin", "warehouse_manager", "inventory_clerk", "warehouse_operator", "dispatch_driver"],
    userCode: "ADMIN01",
    badgeCode: "BADGE-ADMIN01",
  },
  "manager@warehousewizard.local": {
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "Shanice Jordan",
    roles: ["warehouse_manager", "inventory_clerk", "warehouse_operator"],
    userCode: "MGR01",
    badgeCode: "BADGE-MGR01",
  },
  "clerk@warehousewizard.local": {
    id: "33333333-3333-3333-3333-333333333333",
    fullName: "Darnell Clarke",
    roles: ["inventory_clerk"],
    userCode: "CLK01",
    badgeCode: "BADGE-CLK01",
  },
  "operator@warehousewizard.local": {
    id: "44444444-4444-4444-4444-444444444444",
    fullName: "Kemar Holder",
    roles: ["warehouse_operator"],
    userCode: "OPR01",
    badgeCode: "BADGE-OPR01",
  },
  "driver@warehousewizard.local": {
    id: "55555555-5555-5555-5555-555555555555",
    fullName: "Janelle Ifill",
    roles: ["dispatch_driver"],
    userCode: "DRV01",
    badgeCode: "BADGE-DRV01",
  },
  "supervisor@warehousewizard.local": {
    id: "66666666-6666-6666-6666-666666666666",
    fullName: "Andre Wilde",
    roles: ["warehouse_manager", "warehouse_operator"],
    userCode: "SUP01",
    badgeCode: "BADGE-SUP01",
  },
};

function findDemoUser(identifier: string) {
  const normalized = identifier.trim().toUpperCase();
  return Object.entries(demoUsers).find(([email, user]) =>
    email.toUpperCase() === normalized || user.userCode === normalized || user.badgeCode === normalized,
  );
}

function buildDemoAuth(email: string) {
  const demo = demoUsers[email];
  const user = {
    id: demo.id,
    email,
    app_metadata: {},
    user_metadata: { full_name: demo.fullName },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
  const session = {
    access_token: "preview-demo-token",