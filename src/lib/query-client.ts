import { MutationCache, QueryCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { toast } from "sonner";

import { assertOnline } from "@/hooks/use-network-status";

export const queryClientDefaultOptions = {
  queries: {
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    // Retry once with exponential back-off; skip retrying on 4xx client errors.
    retry: (failureCount: number, error: unknown) => {
      if (failureCount >= 2) return false;
      if (error instanceof Error && /4\d\d/.test(error.message)) return false;
      return true;
    },
    retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 10_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 0,
  },
} satisfies NonNullable<QueryClientConfig["defaultOptions"]>;

/** Messages that should never surface as a toast (already handled locally). */
const SUPPRESSED_PATTERNS = [
  /network request failed/i,
  /connection lost/i,
  /failed to fetch/i,
];

function isNetworkError(error: unknown): boolean {
  return error instanceof Error && SUPPRESSED_PATTERNS.some((p) => p.test(error.message));
}

export function createAppQueryClient() {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only toast if no specific onError is registered on the query itself,
        // and only for non-network errors (those are shown by the offline banner).
        if (query.options.meta?.suppressGlobalError) return;
        if (isNetworkError(error)) return;
        const message = error instanceof Error ? error.message : "An unexpected error occurred";
        toast.error(message, { id: `query-error-${String(query.queryKey[0])}` });
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (_vars, mutation) => {
        // Allow opt-out for mutations that buffer their own work offline
        // (e.g. putaway / pick confirmations backed by IndexedDB).
        if ((mutation.options.meta as { offlineQueueable?: boolean } | undefined)?.offlineQueueable) {
          return;
        }
        assertOnline();
      },
      onError: (error, _vars, _ctx, mutation) => {
        // Global mutation error fallback — only fires when the mutation has no
        // onError of its own registered.
        if (mutation.options.onError) return;
        if (isNetworkError(error)) return;
        const message = error instanceof Error ? error.message : "Mutation failed";
        toast.error(message);
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
