import { useState } from 'preact/hooks';
import type { Place } from '../lib/types';

export interface PlaceDraft {
  id?: string;
  label: string;
  lat: string;
  lng: string;
}

/** A place on its way to being saved — no id yet if it's a new one. */
export type PlaceInput = Pick<Place, 'label' | 'lat' | 'lng'> & { id?: string };

interface Props {
  draft: PlaceDraft;
  onSave: (place: PlaceInput) => void;
  onCancel: () => void;
}

// Coordinates stay as strings while editing so a half-typed "-" or "45." isn't
// silently rewritten under the cursor.
function parseCoord(value: string, limit: number): number | null {
  const n = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

export function PlaceForm({ draft, onSave, onCancel }: Props) {
  const [label, setLabel] = useState(draft.label);
  const [lat, setLat] = useState(draft.lat);
  const [lng, setLng] = useState(draft.lng);

  const parsedLat = parseCoord(lat, 90);
  const parsedLng = parseCoord(lng, 180);
  const valid = label.trim().length > 0 && parsedLat !== null && parsedLng !== null;

  function submit(ev: Event) {
    ev.preventDefault();
    if (!valid) return;
    onSave({ id: draft.id, label: label.trim(), lat: parsedLat!, lng: parsedLng! });
  }

  return (
    <div class="sheet-scrim" onClick={onCancel}>
      <form class="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <h2>{draft.id ? 'Edit place' : 'New place'}</h2>

        <label class="field">
          <span>Label</span>
          <input
            value={label}
            placeholder="Home, the office, that good bakery…"
            maxLength={80}
            onInput={(ev) => setLabel((ev.target as HTMLInputElement).value)}
          />
        </label>

        <div class="field-row">
          <label class="field">
            <span>Latitude</span>
            <input
              value={lat}
              inputMode="decimal"
              class={parsedLat === null && lat !== '' ? 'invalid' : ''}
              onInput={(ev) => setLat((ev.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Longitude</span>
            <input
              value={lng}
              inputMode="decimal"
              class={parsedLng === null && lng !== '' ? 'invalid' : ''}
              onInput={(ev) => setLng((ev.target as HTMLInputElement).value)}
            />
          </label>
        </div>

        <div class="sheet-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" class="primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
