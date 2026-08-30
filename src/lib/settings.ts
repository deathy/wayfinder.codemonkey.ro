import type { Units } from './geodesy';

// Small, non-precious preferences: localStorage is the right size of hammer.
// Anything that would hurt to lose goes in IndexedDB (see db.ts).

const KEY = 'wayfinder:settings';

export interface Settings {
  units: Units;
  /** Id of the place currently being pointed at, so it survives a reload. */
  targetId: string | null;
  /** Ids of built-in places the user has hidden from the list. */
  hiddenBuiltins: string[];
  /** Rotate the map so the way you're facing is up, instead of north. */
  headingUp: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  targetId: null,
  hiddenBuiltins: [],
  // On by default: a north-up map is hard to relate to what's in front of you,
  // which is the whole job here. It quietly does nothing without a compass.
  headingUp: true
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // Merge over defaults so a settings object written by an older build
    // (missing newer keys) still yields a complete object.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode / quota — preferences just won't persist */
  }
}
