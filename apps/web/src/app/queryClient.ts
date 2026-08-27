import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@taskapp/api-client';
import { toast } from '../lib/toast/toast-store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
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
