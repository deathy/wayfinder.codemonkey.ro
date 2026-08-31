import { useRef, useState } from 'preact/hooks';
import { downloadBlob, exportPlaces, importPlaces } from '../lib/export';
import type { Units } from '../lib/geodesy';
import type { Heading } from '../lib/types';

interface Props {
  units: Units;
  onUnits: (units: Units) => void;
  heading: Heading | null;
  /** Set when the platform wants an explicit tap before it reports orientation. */
  needsCompassPermission: boolean;
  onRequestCompass: () => void;
  savedCount: number;
  onDataChanged: () => void;
  onClearPlaces: () => void;
}

const SOURCE_TEXT: Record<Heading['source'], string> = {
  absolute: 'device magnetometer',
  webkit: 'iOS compass',
  gps: 'GPS travel direction'
};

export function SettingsView({
  units,
  onUnits,
  heading,
  needsCompassPermission,
  onRequestCompass,
  savedCount,
  onDataChanged,
  onClearPlaces
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onExport() {
    const blob = await exportPlaces();
    downloadBlob(blob, `wayfinder-places-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function onImportFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = await importPlaces(await file.text());
      setStatus(
        `Imported ${result.imported} place${result.imported === 1 ? '' : 's'}` +
          (result.skipped ? `, skipped ${result.skipped}.` : '.')
      );
      onDataChanged();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  function confirmClear() {
    if (!confirm(`Delete all ${savedCount} saved places? This cannot be undone.`)) return;
    onClearPlaces();
    setStatus('Saved places deleted.');
  }

  return (
    <div class="scroll-view">
      <section>
        <h2>Units</h2>
        <div class="button-row">
          <button class={units === 'metric' ? 'primary' : ''} onClick={() => onUnits('metric')}>
            Metric
          </button>
          <button
            class={units === 'imperial' ? 'primary' : ''}
            onClick={() => onUnits('imperial')}
          >
            Imperial
          </button>
        </div>
      </section>

      <section>
        <h2>Compass</h2>
        {needsCompassPermission && (
          <>
            <p class="hint">
              This browser needs your permission before it will report which way the phone is
              facing.
            </p>
            <button class="primary" onClick={onRequestCompass}>
              Enable compass
            </button>
          </>
        )}
        {heading ? (
          <dl class="facts">
            <dt>Source</dt>
            <dd>{SOURCE_TEXT[heading.source]}</dd>
            <dt>Reading</dt>
            <dd>{Math.round(heading.degrees)}°</dd>
            <dt>Referenced to</dt>
            <dd>{heading.reference} north</dd>
            {heading.accuracyDeg !== undefined && (
              <>
                <dt>Reported accuracy</dt>
                <dd>±{Math.round(heading.accuracyDeg)}°</dd>
              </>
            )}
          </dl>
        ) : (
          !needsCompassPermission && (
            <p class="hint">
              No compass reading. The dial falls back to north-up, which still gives you the
              right bearing — you just have to orient yourself.
            </p>
          )
        )}
        <p class="hint">
          Readings come from the magnetometer, so they point at <em>magnetic</em> north. Depending
          on where you are that can sit several degrees off true north; correcting for it is on
          the roadmap. If the needle wanders, wave the phone in a figure-eight to recalibrate.
        </p>
      </section>

      <section>
        <h2>Your data</h2>
        <p class="hint">
          {savedCount} saved place{savedCount === 1 ? '' : 's'}, stored only in this browser.
        </p>
        <div class="button-row">
          <button onClick={onExport} disabled={savedCount === 0}>
            Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        {status && <p class="hint status">{status}</p>}
        <div class="button-row">
          <button class="danger" onClick={confirmClear} disabled={savedCount === 0}>
            Delete all saved places
          </button>
        </div>
      </section>

      <section>
        <h2>About</h2>
        <p class="hint">
          Wayfinder points you at a place — bearing, distance, and the real great-circle line over
          the ground. No backend, no accounts, no analytics. The only things it ever fetches are
          map tiles and the city list, and searching that list happens entirely on your device.
        </p>
        <p class="hint">
          Map tiles ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors. City data from{' '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
          , used under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          .
        </p>
        <dl class="facts">
          <dt>Build</dt>
          <dd>
            <code>{__COMMIT__}</code>
          </dd>
          <dt>Built</dt>
          <dd>{new Date(__BUILD_TIME__).toLocaleString()}</dd>
        </dl>
      </section>
    </div>
  );
}
