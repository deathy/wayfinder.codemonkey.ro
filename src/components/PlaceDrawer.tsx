import type { Units } from '../lib/geodesy';
import { compassPoint, formatDistance, normalizeDeg } from '../lib/geodesy';
import type { Place } from '../lib/types';

export interface PlaceEntry {
  place: Place;
  /** Null until we have a position fix. */
  distanceM: number | null;
  bearing: number | null;
}

interface Props {
  entries: PlaceEntry[];
  targetId: string | null;
  open: boolean;
  units: Units;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

/**
 * Bottom sheet listing every place, nearest first. Collapsed it's a one-line
 * summary of the current target; that's the resting state, because the map and
 * the dial are what you actually look at.
 */
export function PlaceDrawer({ entries, targetId, open, units, onToggle, onSelect }: Props) {
  const current = entries.find((e) => e.place.id === targetId);

  return (
    <div class={`drawer${open ? ' drawer-open' : ''}`}>
      <button class="drawer-handle" onClick={onToggle} aria-expanded={open}>
        <span class="handle-grip" />
        <span class="handle-text">
          {current ? (
            <>
              <strong>{current.place.label}</strong>
              {current.distanceM !== null && (
                <span class="handle-distance">{formatDistance(current.distanceM, units)}</span>
              )}
            </>
          ) : (
            <strong>Pick a place to point at</strong>
          )}
        </span>
        <span class="handle-chevron">{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <ul class="place-list">
          {entries.map(({ place, distanceM, bearing }) => (
            <li key={place.id}>
              <button
                class={`place-row${place.id === targetId ? ' active' : ''}`}
                onClick={() => onSelect(place.id)}
              >
                <span class="place-name">
                  {place.label}
                  {place.builtin && <span class="place-tag">sample</span>}
                </span>
                <span class="place-meta">
                  {distanceM === null ? (
                    <span class="place-dim">waiting for GPS</span>
                  ) : (
                    <>
                      <span class="place-distance">{formatDistance(distanceM, units)}</span>
                      {bearing !== null && (
                        <span class="place-bearing">
                          {compassPoint(bearing)} {Math.round(normalizeDeg(bearing))}°
                        </span>
                      )}
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
