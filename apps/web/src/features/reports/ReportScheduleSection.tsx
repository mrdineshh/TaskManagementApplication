import { useState } from 'react';
import type { ReportExportFormat, ReportFrequency } from '@taskapp/shared-types';
import { useCreateReportSchedule, useDeleteReportSchedule, useReportSchedules, useUpdateReportSchedule } from './hooks';
import { useRoles } from '../admin/hooks';
import { NeuSelect } from '../../components/NeuSelect';

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
    <div className="neu-card !p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Scheduled delivery</h2>

      <div className="mb-4 space-y-2">
        {schedules?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              {s.frequency} at {s.send_at} UTC
              {s.frequency === 'weekly' && s.day_of_week !== null ? ` (${WEEKDAYS[s.day_of_week]})` : ''}
              {s.frequency === 'monthly' && s.day_of_month !== null ? ` (day ${s.day_of_month})` : ''} · {s.export_format.toUpperCase()} ·{' '}
              {s.recipient_role_ids.length} role(s)
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => updateSchedule.mutate({ scheduleId: s.id, data: { is_active: !s.is_active } })}
                className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
              >
                {s.is_active ? 'Active' : 'Paused'}
              </button>
              <button onClick={() => deleteSchedule.mutate(s.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        {schedules?.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No scheduled delivery configured.</p>}
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</label>
          <NeuSelect
            value={frequency}
            onChange={(v) => setFrequency(v as ReportFrequency)}
            options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
            compact
            style={{ minWidth: '7rem' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Send at (UTC)</label>
          <input type="time" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="neu-input !py-1 text-xs" />
        </div>
        {frequency === 'weekly' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Day</label>
            <NeuSelect
              value={dayOfWeek}
              onChange={setDayOfWeek}
              options={WEEKDAYS.map((label, i) => ({ value: String(i), label }))}
              compact
              style={{ minWidth: '6.5rem' }}
            />
          </div>
        )}
        {frequency === 'monthly' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Day of month</label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-20 neu-input !py-1 text-xs"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Format</label>
          <NeuSelect
            value={exportFormat}
            onChange={(v) => setExportFormat(v as ReportExportFormat)}
            options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
            compact
            style={{ minWidth: '6.5rem' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Recipient roles</label>
          <div className="flex flex-wrap gap-1 max-w-xs pt-0.5">
            {roles?.map((r) => {
              const isSelected = roleIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRoleIds(isSelected ? roleIds.filter((id) => id !== r.id) : [...roleIds, r.id]);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-lg transition-all font-medium ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-[var(--neu-bg)] text-[var(--text-muted)] hover:bg-[rgba(37,99,235,0.06)]"
                  }`}
                  style={!isSelected ? {
                    boxShadow: "1px 1px 3px var(--neu-dark), -1px -1px 3px var(--neu-light)",
                  } : undefined}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>
        <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">
          Add schedule
        </button>
      </form>
    </div>
  );
}
