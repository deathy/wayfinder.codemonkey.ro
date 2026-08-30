import { deltaDeg, normalizeDeg } from './geodesy';

// The damping used to rotate the map, kept as a pure step function so it can be
// tested without a browser, an animation frame, or a compass.

/** Per frame, so roughly 200 ms to catch up at 60 fps. */
export const MAP_SMOOTHING = 0.08;
/** Once this close, snap to the goal rather than creeping toward it forever. */
export const SETTLED_DEG = 0.1;

/**
 * Filter state as a unit vector rather than an angle. Averaging angles would
 * make 359° and 1° average to 180°, which would spin the map a half turn every
 * time the heading crossed north.
 */
export interface DampingState {
  x: number;
  y: number;
}

export function createDampingState(bearingDeg = 0): DampingState {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

/**
 * Advance one frame toward `targetDeg`, mutating `state`, and return the
 * bearing to draw. Always turns the short way round, because it interpolates
 * the vector rather than the angle.
 */
export function stepDamping(
  state: DampingState,
  targetDeg: number,
  smoothing = MAP_SMOOTHING
): number {
  const goal = (targetDeg * Math.PI) / 180;
  const gx = Math.sin(goal);
  const gy = Math.cos(goal);

  state.x += (gx - state.x) * smoothing;
  state.y += (gy - state.y) * smoothing;

  const smoothed = normalizeDeg((Math.atan2(state.x, state.y) * 180) / Math.PI);
  if (Math.abs(deltaDeg(smoothed, targetDeg)) <= SETTLED_DEG) {
    state.x = gx;
    state.y = gy;
    return normalizeDeg(targetDeg);
  }
  return smoothed;
}
