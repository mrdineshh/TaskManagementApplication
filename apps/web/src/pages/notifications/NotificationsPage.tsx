import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.notifications.list(),
  });

  async function markAllRead() {
    await apiClient.notifications.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
        <button onClick={markAllRead} className="text-sm text-brand-700 hover:underline">
          Mark all read
        </button>
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {data?.map((n: any) => (
          <li key={n.id} className={`px-4 py-3 text-sm ${n.is_read ? 'text-slate-400' : 'font-medium text-slate-800'}`}>
            <span className="mr-2 text-xs uppercase text-slate-400">{n.type}</span>
            {JSON.stringify(n.payload)}
          </li>
        ))}
        {data?.length === 0 && <li className="px-4 py-6 text-center text-slate-400">No notifications.</li>}
      </ul>
    </div>
  );
}
