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
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  targetId: null,
  hiddenBuiltins: []
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
