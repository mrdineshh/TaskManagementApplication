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
      <form onSubmit={handleCreate} className="flex gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <CountryStateSelect country={country} state={state} onCountryChange={setCountry} onStateChange={setState} />
        <button
          type="submit"
          disabled={createCalendar.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add calendar
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>}

      {(calendars as any[])?.map((cal) => (
        <div key={cal.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
                  {h.date} — {h.name}
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

          <div className="flex gap-2">
            <input
              type="date"
              value={newHoliday[cal.id]?.date ?? ''}
              onChange={(e) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: e.target.value, name: prev[cal.id]?.name ?? '' } }))}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
            />
            <input
              value={newHoliday[cal.id]?.name ?? ''}
              onChange={(e) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: prev[cal.id]?.date ?? '', name: e.target.value } }))}
              placeholder="Holiday name"
              className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
            />
            <button
              disabled={!newHoliday[cal.id]?.date || !newHoliday[cal.id]?.name}
              onClick={async () => {
                await addHoliday.mutateAsync({ calendarId: cal.id, data: newHoliday[cal.id] });
                setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: '', name: '' } }));
              }}
              className="text-xs text-brand-700 dark:text-brand-300 hover:underline disabled:text-slate-300 dark:disabled:text-slate-600"
            >
              Add holiday
            </button>
            <span className="text-xs text-slate-300 dark:text-slate-700">|</span>
            <input
              ref={(el) => {
                fileInputs.current[cal.id] = el;
              }}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvUpload(cal.id, file);
                e.target.value = '';
              }}
            />
            <button
              disabled={bulkAddHolidays.isPending}
              onClick={() => fileInputs.current[cal.id]?.click()}
              title="CSV with two columns: date (yyyy-mm-dd), name — a header row is fine"
              className="text-xs text-brand-700 dark:text-brand-300 hover:underline disabled:text-slate-300 dark:disabled:text-slate-600"
            >
              {bulkAddHolidays.isPending ? 'Uploading…' : 'Upload CSV'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
