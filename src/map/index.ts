import { createOpenLayersEngine } from './openlayers';
import type { MapEngineFactory } from './types';

/**
 * The one line that decides which map engine the app runs on. A MapLibre engine
 * would be a sibling file exporting the same `MapEngine`, swapped in here.
 */
export const createMapEngine: MapEngineFactory = createOpenLayersEngine;

export type { FitOptions, MapEngine, MapEngineFactory, MapEngineOptions } from './types';
export { DEFAULT_CENTER, DEFAULT_ZOOM, LOCATED_ZOOM } from './style';
