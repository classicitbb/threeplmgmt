// Tenant-aware Supabase client factory (Phase 0 groundwork for multi-tenant routing).
//
// The default `supabase` client exported from `./client` is auto-generated and
// must not be edited. Once tenant routing (`/:companySlug/*`) lands, we need a
// per-tenant client whose auth session is namespaced by company slug so two
// tenants open in the same browser cannot collide on a single
// `sb-<project>-auth-token` localStorage key.
//
// This module is intentionally not wired into the app yet — no callers, no side
// effects at import time. It exists solely so the follow-up tenant routing PR
// can start consuming it without touching the auto-generated client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createTenantClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  companySlug: string,
): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: `sb-${companySlug}-auth-token`,
    },
  });
}