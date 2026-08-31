import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  cityLabel,
  formatPopulation,
  loadCityIndex,
  searchCities,
  type City,
  type CityIndex
} from '../lib/cities';
import { distance, formatDistance, type Units } from '../lib/geodesy';
import type { GpsFix } from '../lib/types';

interface Props {
  location: GpsFix | null;
  units: Units;
  onPick: (city: City, label: string) => void;
  onCancel: () => void;
}

/** Long enough that the first keystroke doesn't scan 34k rows for one letter. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 120;
const RESULT_LIMIT = 30;

export function CitySearch({ location, units, onPick, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // The index is ~370 KB gzipped, so it's fetched here rather than at startup —
  // most sessions never open this sheet at all.
  useEffect(() => {
    let alive = true;
    loadCityIndex().then(
      (loaded) => alive && setIndex(loaded),
      (err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load the city list.')
    );
    inputRef.current?.focus();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    if (!index || debounced.trim().length < MIN_QUERY) return [];
    return searchCities(index, debounced, RESULT_LIMIT);
  }, [index, debounced]);

  const tooShort = debounced.trim().length > 0 && debounced.trim().length < MIN_QUERY;

  return (
    <div class="sheet-scrim" onClick={onCancel}>
      <div class="sheet city-sheet" onClick={(ev) => ev.stopPropagation()}>
        <div class="city-head">
          <h2>Find a city</h2>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <label class="field">
          <input
            ref={inputRef}
            value={query}
            placeholder="Timisoara, London, Kyoto…"
            enterKeyHint="search"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            onInput={(ev) => setQuery((ev.target as HTMLInputElement).value)}
          />
        </label>

        {error && <p class="hint error">{error}</p>}
        {!error && !index && <p class="hint">Loading the city list…</p>}

        {index && !query && (
          <p class="hint">
            {index.cities.length.toLocaleString()} cities worldwide, searched on your device.
            Accents are optional — "timisoara" finds "Timişoara".
          </p>
        )}
        {index && tooShort && <p class="hint">Keep typing…</p>}
        {index && !tooShort && debounced && results.length === 0 && (
          <p class="hint">
            Nothing matching "{debounced}". The list uses each city's local or English name,
            so try the local spelling.
          </p>
        )}

        <ul class="city-results">
          {results.map((city) => {
            const label = cityLabel(city, index!.countries);
            const away = location ? distance(location, city) : null;
            return (
              <li key={`${city.cc}:${city.lat},${city.lng}`}>
                <button class="city-row" onClick={() => onPick(city, label)}>
                  <span class="city-name">
                    <strong>{city.name}</strong>
                    <span class="city-country">{index!.countries.get(city.cc) ?? city.cc}</span>
                  </span>
                  <span class="city-meta">
                    {away !== null && (
                      <span class="city-distance">{formatDistance(away, units)}</span>
                    )}
                    {city.popK > 0 && (
                      <span class="city-pop">{formatPopulation(city.popK)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
