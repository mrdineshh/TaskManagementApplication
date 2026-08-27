import { allCountries } from 'country-region-data';

interface Props {
  country: string;
  state: string;
  onCountryChange: (country: string) => void;
  onStateChange: (state: string) => void;
  className?: string;
}

/**
 * Cascading Country/State dropdowns (docs/10-OPEN-DECISIONS.md §M9) — replaces free-text
 * Country/State inputs wherever they feed a work location. A typo here silently breaks the
 * User→HolidayCalendar match (both are matched by exact string, docs/10-OPEN-DECISIONS.md §G2),
 * so constraining input to a real country/state list matters more than it looks like it should.
 */
export function CountryStateSelect({ country, state, onCountryChange, onStateChange, className = '' }: Props) {
  const selectedCountry = allCountries.find((c) => c[0] === country);
  const regions = selectedCountry?.[2] ?? [];

  function handleCountryChange(next: string) {
    onCountryChange(next);
    onStateChange(''); // last country's state is very unlikely to exist in the new one
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={country}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
      >
        <option value="">Country…</option>
        {allCountries.map(([name]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={state}
        onChange={(e) => onStateChange(e.target.value)}
        disabled={!country}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-500"
      >
        <option value="">{country ? 'State/Region…' : 'Select a country first'}</option>
        {regions.map(([name]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
