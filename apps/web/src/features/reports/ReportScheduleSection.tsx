import { useState } from 'react';
import type { ReportExportFormat, ReportFrequency } from '@taskapp/shared-types';
import { useCreateReportSchedule, useDeleteReportSchedule, useReportSchedules, useUpdateReportSchedule } from './hooks';
import { useRoles } from '../admin/hooks';

const FREQUENCIES: ReportFrequency[] = ['daily', 'weekly', 'monthly'];
const FORMATS: ReportExportFormat[] = ['csv', 'xlsx', 'pdf'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Scheduled email delivery for a SavedReport (docs/05-FEATURES.md §3.4) — owner/admin only. */
export function ReportScheduleSection({ reportId }: { reportId: string }) {
  const { data: schedules } = useReportSchedules(reportId);
  const { data: roles } = useRoles();
  const createSchedule = useCreateReportSchedule(reportId);
  const updateSchedule = useUpdateReportSchedule(reportId);
  const deleteSchedule = useDeleteReportSchedule(reportId);

  const [frequency, setFrequency] = useState<ReportFrequency>('weekly');
  const [sendAt, setSendAt] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [exportFormat, setExportFormat] = useState<ReportExportFormat>('pdf');
  const [roleIds, setRoleIds] = useState<string[]>([]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createSchedule.mutateAsync({
      frequency,
      send_at: sendAt,
      day_of_week: frequency === 'weekly' ? Number(dayOfWeek) : undefined,
      day_of_month: frequency === 'monthly' ? Number(dayOfMonth) : undefined,
      recipient_user_ids: [],
      recipient_role_ids: roleIds,
      export_format: exportFormat,
    });
    setRoleIds([]);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">Scheduled delivery</h2>

      <div className="mb-4 space-y-2">
        {schedules?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">
              {s.frequency} at {s.send_at} UTC
              {s.frequency === 'weekly' && s.day_of_week !== null ? ` (${WEEKDAYS[s.day_of_week]})` : ''}
              {s.frequency === 'monthly' && s.day_of_month !== null ? ` (day ${s.day_of_month})` : ''} · {s.export_format.toUpperCase()} ·{' '}
              {s.recipient_role_ids.length} role(s)
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => updateSchedule.mutate({ scheduleId: s.id, data: { is_active: !s.is_active } })}
                className="text-xs text-brand-700 hover:underline"
              >
                {s.is_active ? 'Active' : 'Paused'}
              </button>
              <button onClick={() => deleteSchedule.mutate(s.id)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        {schedules?.length === 0 && <p className="text-xs text-slate-400">No scheduled delivery configured.</p>}
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as ReportFrequency)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Send at (UTC)</label>
          <input type="time" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        {frequency === 'weekly' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {WEEKDAYS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        {frequency === 'monthly' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Day of month</label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Format</label>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ReportExportFormat)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Recipient roles</label>
          <select
            multiple
            value={roleIds}
            onChange={(e) => setRoleIds(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="h-16 w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Add schedule
        </button>
      </form>
    </div>
  );
}
