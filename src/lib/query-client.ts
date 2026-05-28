import { MutationCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query";

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
} satisfies NonNullable<QueryClientConfig["defaultOptions"]>;

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
