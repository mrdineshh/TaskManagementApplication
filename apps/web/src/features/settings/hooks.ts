import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreference } from '@taskapp/shared-types';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';

export function useUpdateProfile() {
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);
  const currentUser = useSessionStore((s) => s.currentUser);
  return useMutation({
    mutationFn: (data: { full_name?: string; avatar_url?: string }) => apiClient.me.update(data),
    onSuccess: (_result, vars) => {
      if (currentUser) setCurrentUser({ ...currentUser, ...vars });
    },
  });
}

const PREFERENCES_KEY = ['notification-preferences'];

export function useNotificationPreferences() {
  return useQuery({ queryKey: PREFERENCES_KEY, queryFn: () => apiClient.me.notificationPreferences() });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: NotificationPreference) => apiClient.me.updateNotificationPreferences([entry]),
    // Optimistic update: the checkbox is bound directly to query-cache data, so without this
    // it visually snaps back to its old state for the round-trip before the invalidated query
    // refetches — looks like the click didn't register even though it did.
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = qc.getQueryData<NotificationPreference[]>(PREFERENCES_KEY);
      qc.setQueryData<NotificationPreference[]>(PREFERENCES_KEY, (current) =>
        (current ?? []).map((p) => (p.type === entry.type && p.channel === entry.channel ? entry : p)),
      );
      return { previous };
    },
    onError: (_err, _entry, context) => {
      if (context?.previous) qc.setQueryData(PREFERENCES_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PREFERENCES_KEY }),
  });
}
