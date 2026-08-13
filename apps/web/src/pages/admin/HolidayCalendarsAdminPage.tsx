import { useState } from 'react';
import {
  useAddHoliday,
  useCreateHolidayCalendar,
  useDeleteHolidayCalendar,
  useHolidayCalendars,
  useRemoveHoliday,
} from '../../features/admin/hooks';

/** Admin-configurable per Country+State (docs/10-OPEN-DECISIONS.md §G2) — each User's
 * work_country/work_state picks which calendar governs their business-day/overdue math. */
export function HolidayCalendarsAdminPage() {
  const { data: calendars, isLoading } = useHolidayCalendars();
  const createCalendar = useCreateHolidayCalendar();
  const deleteCalendar = useDeleteHolidayCalendar();
  const addHoliday = useAddHoliday();
  const removeHoliday = useRemoveHoliday();

  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [newHoliday, setNewHoliday] = useState<Record<string, { date: string; name: string }>>({});

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!country.trim() || !state.trim()) return;
    await createCalendar.mutateAsync({ country, state });
    setCountry('');
    setState('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country"
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="State"
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={createCalendar.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add calendar
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {(calendars as any[])?.map((cal) => (
        <div key={cal.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">
              {cal.country}, {cal.state}
            </h3>
            <button onClick={() => deleteCalendar.mutate(cal.id)} className="text-xs text-slate-400 hover:text-red-600">
              Delete calendar
            </button>
          </div>

          <ul className="mb-3 space-y-1">
            {cal.holidays?.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  {h.date} — {h.name}
                </span>
                <button
                  onClick={() => removeHoliday.mutate({ calendarId: cal.id, holidayId: h.id })}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
            {!cal.holidays?.length && <li className="text-sm text-slate-400">No holidays yet.</li>}
          </ul>

          <div className="flex gap-2">
            <input
              type="date"
              value={newHoliday[cal.id]?.date ?? ''}
              onChange={(e) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: e.target.value, name: prev[cal.id]?.name ?? '' } }))}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <input
              value={newHoliday[cal.id]?.name ?? ''}
              onChange={(e) => setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: prev[cal.id]?.date ?? '', name: e.target.value } }))}
              placeholder="Holiday name"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <button
              disabled={!newHoliday[cal.id]?.date || !newHoliday[cal.id]?.name}
              onClick={async () => {
                await addHoliday.mutateAsync({ calendarId: cal.id, data: newHoliday[cal.id] });
                setNewHoliday((prev) => ({ ...prev, [cal.id]: { date: '', name: '' } }));
              }}
              className="text-xs text-brand-700 hover:underline disabled:text-slate-300"
            >
              Add holiday
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
