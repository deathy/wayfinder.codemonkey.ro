import type { Place } from './types';

// Built-in sample targets. Deliberately only well-known public landmarks and
// city centres — this repo is meant to be open-sourced, so nothing here should
// say anything about where anyone actually lives. Your own places live in your
// browser's storage and are never part of the source.
//
// Coordinates are rounded to 4 decimals (~11 m), which is well past the point
// of caring when the target is thousands of kilometres away.

export const BUILTIN_PLACES: Place[] = [
  {
    id: 'builtin:timisoara',
    label: 'Timișoara — Piața Victoriei',
    lat: 45.7538,
    lng: 21.2257,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'builtin:london',
    label: 'London — Charing Cross',
    lat: 51.5074,
    lng: -0.1278,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'builtin:giza',
    label: 'Pyramids of Giza',
    lat: 29.9792,
    lng: 31.1342,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'builtin:kaaba',
    label: 'Mecca — the Kaaba',
    lat: 21.4225,
    lng: 39.8262,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  }
];
