import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@taskapp/api-client';
import { toast } from '../lib/toast/toast-store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep staleTime short so polling intervals can fire correctly.
      // Data is never shown stale for more than 5s — real-time tasks use refetchInterval.
      staleTime: 5_000,
      retry: 1,
      // Refetch on tab focus + network reconnect (P1-02 §4 — eliminates the stale-list bug
      // where a task assigned while the user was in another tab doesn't appear on return).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
  // Global error surfacing (docs/10-OPEN-DECISIONS.md §M9) — every useMutation call in the app
  // gets a toast on failure without each hook needing its own onError. UNAUTHENTICATED is
  // excluded: apiClient's onAuthFailure already redirects to /login for that case, so a toast
  // would just flash pointlessly mid-navigation. A mutation can still add its own onError for
  // anything needing bespoke handling — this only fires as a fallback alongside it.
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return;
      const message = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    },
  }),
});
