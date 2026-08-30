import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Place } from './types';

// A saved place is a handful of numbers, so localStorage would technically do.
// IndexedDB anyway: it matches the sibling apps, survives storage pressure
// better, and leaves room for richer places (notes, photos) later.

interface WayfinderDB extends DBSchema {
  places: {
    key: string;
    value: Place;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'wayfinder-codemonkey';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WayfinderDB>> | null = null;

function db(): Promise<IDBPDatabase<WayfinderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WayfinderDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore('places', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      }
    });
  }
  return dbPromise;
}

/** Saved places only — built-ins live in code, not storage. */
export async function getSavedPlaces(): Promise<Place[]> {
  const database = await db();
  const all = await database.getAllFromIndex('places', 'by-updated');
  return all.reverse(); // newest edit first
}

export async function putPlace(place: Place): Promise<void> {
  const database = await db();
  await database.put('places', place);
}

export async function deletePlace(id: string): Promise<void> {
  const database = await db();
  await database.delete('places', id);
}

export async function clearPlaces(): Promise<void> {
  const database = await db();
  await database.clear('places');
}
