import { useState } from 'preact/hooks';
import { PlaceForm, type PlaceDraft, type PlaceInput } from './PlaceForm';
import { formatLatLng } from '../lib/geodesy';
import type { GpsFix, Place } from '../lib/types';

interface Props {
  saved: Place[];
  builtins: Place[];
  hiddenBuiltins: string[];
  location: GpsFix | null;
  onSave: (place: PlaceInput) => void;
  onDelete: (id: string) => void;
  onToggleBuiltin: (id: string) => void;
}

export function PlacesView({
  saved,
  builtins,
  hiddenBuiltins,
  location,
  onSave,
  onDelete,
  onToggleBuiltin
}: Props) {
  const [draft, setDraft] = useState<PlaceDraft | null>(null);

  // "Here" is the whole point of saving a place — prefill from the live fix and
  // let the coordinates be nudged by hand afterwards.
  function addHere() {
    if (!location) return;
    setDraft({ label: '', lat: location.lat.toFixed(6), lng: location.lng.toFixed(6) });
  }

  function addManual() {
    setDraft({ label: '', lat: '', lng: '' });
  }

  function edit(place: Place) {
    setDraft({
      id: place.id,
      label: place.label,
      lat: String(place.lat),
      lng: String(place.lng)
    });
  }

  return (
    <div class="scroll-view">
      <section>
        <h2>Your places</h2>
        <div class="button-row">
          <button class="primary" onClick={addHere} disabled={!location}>
            + Save where I am
          </button>
          <button onClick={addManual}>+ By coordinates</button>
        </div>
        {!location && <p class="hint">Waiting for a GPS fix before "save where I am" works.</p>}

        {saved.length === 0 ? (
          <p class="hint">
            Nothing saved yet. Your places live only in this browser — they're never uploaded
            anywhere and aren't part of the app's source.
          </p>
        ) : (
          <ul class="manage-list">
            {saved.map((place) => (
              <li key={place.id}>
                <div class="manage-info">
                  <strong>{place.label}</strong>
                  <span class="coords">{formatLatLng(place)}</span>
                </div>
                <div class="manage-actions">
                  <button onClick={() => edit(place)}>Edit</button>
                  <button class="danger" onClick={() => onDelete(place.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Sample places</h2>
        <p class="hint">
          Well-known landmarks that ship with the app. Hide the ones you don't want cluttering
          the list.
        </p>
        <ul class="manage-list">
          {builtins.map((place) => {
            const hidden = hiddenBuiltins.includes(place.id);
            return (
              <li key={place.id} class={hidden ? 'muted' : ''}>
                <div class="manage-info">
                  <strong>{place.label}</strong>
                  <span class="coords">{formatLatLng(place)}</span>
                </div>
                <div class="manage-actions">
                  <button onClick={() => onToggleBuiltin(place.id)}>
                    {hidden ? 'Show' : 'Hide'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {draft && (
        <PlaceForm
          draft={draft}
          onCancel={() => setDraft(null)}
          onSave={(place) => {
            onSave(place);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}
