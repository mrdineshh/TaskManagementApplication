import { useRef, useState } from 'react';
import {
  useAddHoliday,
  useBulkAddHolidays,
  useCreateHolidayCalendar,
  useDeleteHolidayCalendar,
  useHolidayCalendars,
  useRemoveHoliday,
} from '../../features/admin/hooks';
import { CountryStateSelect } from '../../components/CountryStateSelect';
import { NeuDatePicker } from '../../components/NeuDatePicker';
import { fmtDate } from '../../lib/utils/dates';
import { parseHolidayCsv } from '../../lib/csv';
import { toast } from '../../lib/toast/toast-store';

/** Admin-configurable per Country+State (docs/10-OPEN-DECISIONS.md §G2) — each User's
 * work_country/work_state picks which calendar governs their business-day/overdue math. */
export function HolidayCalendarsAdminPage() {
  const { data: calendars, isLoading } = useHolidayCalendars();
  const createCalendar = useCreateHolidayCalendar();
  const deleteCalendar = useDeleteHolidayCalendar();
  const addHoliday = useAddHoliday();
  const bulkAddHolidays = useBulkAddHolidays();
  const removeHoliday = useRemoveHoliday();

  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [newHoliday, setNewHoliday] = useState<Record<string, { date: string; name: string }>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleCsvUpload(calendarId: string, file: File) {
    const text = await file.text();
    const { rows, errors } = parseHolidayCsv(text);
    if (errors.length > 0) {
      toast.error(`${errors.length} row(s) skipped — ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`);
    }
    if (rows.length > 0) {
      await bulkAddHolidays.mutateAsync({ calendarId, holidays: rows });
    } else if (errors.length === 0) {
      toast.error('No rows found in that file');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!country.trim() || !state.trim()) return;
    await createCalendar.mutateAsync({ country, state });
    setCountry('');
    setState('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2 neu-card !p-4">
        <CountryStateSelect country={country} state={state} onCountryChange={setCountry} onStateChange={setState} />
        <button
          type="submit"
          disabled={createCalendar.isPending}
          className="btn-primary"
        >
          Add calendar
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>}

      {(calendars as any[])?.map((cal) => (
        <div key={cal.id} className="neu-card !p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {cal.country}, {cal.state}
            </h3>
            <button onClick={() => deleteCalendar.mutate(cal.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400">
              Delete calendar
            </button>
          </div>

          <ul className="mb-3 space-y-1">
            {cal.holidays?.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>
                  {fmtDate(h.date)} — {h.name}
                </span>
                <button
                  onClick={() => removeHoliday.mutate({ calendarId: cal.id, holidayId: h.id })}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
            {!cal.holidays?.length && <li className="text-sm text-slate-400 dark:text-slate-500">No holidays yet.</li>}
          </ul>

          <div className="flex flex-wrap gap-2 items-center">
            <NeuDatePicker
              value={newHoliday[cal.id]?.date ?? ''}
              onChange={(d) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: d, name: prev[cal.id]?.name ?? '' } }))}
              placeholder="Select date"
              compact
              style={{ minWidth: '140px' }}
            />
            <input
              value={newHoliday[cal.id]?.name ?? ''}
              onChange={(e) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: prev[cal.id]?.date ?? '', name: e.target.value } }))}
              placeholder="Holiday name"
              className="neu-input text-xs flex-1 min-w-[140px]"
            />
            <button
              disabled={!newHoliday[cal.id]?.date || !newHoliday[cal.id]?.name}
              onClick={async () => {
                await addHoliday.mutateAsync({ calendarId: cal.id, data: newHoliday[cal.id] });
                setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: '', name: '' } }));
              }}
              className="btn-primary !py-1.5 !px-3 !text-xs disabled:opacity-40"
            >
              Add holiday
            </button>
            <button
              disabled={bulkAddHolidays.isPending}
              onClick={() => fileInputs.current[cal.id]?.click()}
              title="CSV with two columns: date (yyyy-mm-dd), name"
              className="btn-neu !py-1.5 !px-3 !text-xs disabled:opacity-40"
            >
              {bulkAddHolidays.isPending ? 'Uploading…' : 'Upload CSV'}
            </button>
            <input
              ref={(el) => { fileInputs.current[cal.id] = el; }}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvUpload(cal.id, file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
