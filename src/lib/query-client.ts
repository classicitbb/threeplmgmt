/**
 * @file query-client.ts — TanStack Query client configuration and caching strategy
 *
 * CACHING DEFAULTS
 * ----------------
 * staleTime:           30s  — data considered fresh for 30 seconds after fetch
 * gcTime:              10m  — inactive queries held in memory for 10 minutes
 * retry:               1    — one automatic retry on transient failures
 * refetchOnWindowFocus: false — operators switch apps frequently; surprise refetches cause confusion
 * refetchOnReconnect:  true  — resume data automatically after network restore
 *
 * REFERENCE DATA (warehouses, zones, clients, products, options)
 * ---------------------------------------------------------------
 * staleTime: 5m, gcTime: 30m — these change rarely; longer TTLs reduce redundant requests.
 * Query keys: ["options"], ["products","options-for-table"], ["clients","options-for-table"],
 *             ["warehouses","options-for-table"], ["zones","options-for-table"]
 *
 * MUTATIONS
 * ---------
 * retry: 0 — no silent retries; duplicate mutations could create duplicate records.
 * MutationCache.onMutate calls assertOnline() to block all mutations while offline.
 *
 * CACHE INVALIDATION
 * ------------------
 * After any write operation, call invalidateWarehouseData(queryClient) from
 * src/lib/query-invalidation.ts to sweep all operational views in one call.
 */

import { MutationCache, QueryClient } from "@tanstack/react-query";

import { assertOnline } from "@/hooks/use-network-status";

export const queryClientDefaultOptions = {
  queries: {
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 0,
  },
} satisfies ConstructorParameters<typeof QueryClient>[0]["defaultOptions"];

export function createAppQueryClient() {
  const client = new QueryClient({
    mutationCache: new MutationCache({
      onMutate: () => {
        assertOnline();
      },
    }),
    defaultOptions: queryClientDefaultOptions,
  });

  client.setQueryDefaults(["options"], {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  client.setQueryDefaults(["products", "options-for-table"], {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  client.setQueryDefaults(["clients", "options-for-table"], {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  client.setQueryDefaults(["warehouses", "options-for-table"], {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  client.setQueryDefaults(["zones", "options-for-table"], {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return client;
}
