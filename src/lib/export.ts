import { EXPORT_VERSION, type Place } from './types';
import { getSavedPlaces, putPlace } from './db';

// Your places are the only thing in here that you can't get back by reinstalling,
// so export is a plain, self-describing JSON file — readable, diffable, and not
// dependent on this app still existing.

interface ExportFile {
  app: 'wayfinder';
  version: number;
  exportedAt: string;
  places: Place[];
}

export async function exportPlaces(): Promise<Blob> {
  const payload: ExportFile = {
    app: 'wayfinder',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    places: await getSavedPlaces()
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isPlace(value: unknown): value is Place {
  const p = value as Partial<Place> | null;
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.label === 'string' &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Merge an exported file back in. Import is additive and id-keyed: re-importing
 * the same file is a no-op rather than a pile of duplicates. Malformed entries
 * are skipped rather than failing the whole import.
 */
export async function importPlaces(text: string): Promise<ImportResult> {
  const parsed = JSON.parse(text) as Partial<ExportFile>;
  if (parsed.app !== 'wayfinder' || !Array.isArray(parsed.places)) {
    throw new Error('Not a Wayfinder export file.');
  }
  const now = Date.now();
  let imported = 0;
  let skipped = 0;
  for (const raw of parsed.places) {
    if (!isPlace(raw) || raw.builtin) {
      skipped++;
      continue;
    }
    await putPlace({
      id: raw.id,
      label: raw.label,
      lat: raw.lat,
      lng: raw.lng,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now
    });
    imported++;
  }
  return { imported, skipped };
}
