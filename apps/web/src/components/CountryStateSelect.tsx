import { allCountries } from 'country-region-data';
import { NeuSelect } from './NeuSelect';

interface Props {
  country: string;
  state: string;
  onCountryChange: (country: string) => void;
  onStateChange: (state: string) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Cascading Country/State dropdowns — powered by NeuSelect for custom popup styling.
 */
export function CountryStateSelect({
  country,
  state,
  onCountryChange,
  onStateChange,
  className = '',
  compact = false,
}: Props) {
  const selectedCountry = allCountries.find((c) => c[0] === country);
  const regions = selectedCountry?.[2] ?? [];

  function handleCountryChange(next: string) {
    onCountryChange(next);
    onStateChange('');
  }

  const countryOptions = [
    { value: '', label: 'Country…' },
    ...allCountries.map(([name]) => ({ value: name, label: name })),
  ];

  const stateOptions = [
    { value: '', label: country ? 'State/Region…' : 'Select a country first' },
    ...regions.map(([name]) => ({ value: name, label: name })),
  ];

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1 min-w-[140px]">
        <NeuSelect
          value={country}
          onChange={handleCountryChange}
          options={countryOptions}
          placeholder="Country…"
          compact={compact}
          style={{ width: '100%' }}
        />
      </div>
      <div className="flex-1 min-w-[140px]">
        <NeuSelect
          value={state}
          onChange={onStateChange}
          options={stateOptions}
          placeholder={country ? 'State/Region…' : 'Select a country first'}
          disabled={!country}
          compact={compact}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
