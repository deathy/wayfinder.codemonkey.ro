import { useEffect, useRef, useState } from 'preact/hooks';
import { createDampingState, stepDamping } from './bearingDamping';
import { deltaDeg } from './geodesy';

// A needle and a whole map want very different amounts of damping. The needle's
// filter (α = 0.25 per sample) is tuned to feel responsive on a small arrow;
// applied to the map it turns a few degrees of magnetometer jitter into a
// viewport that never sits still, which is genuinely unpleasant to look at. So
// the map gets its own, much slower filter — see bearingDamping.ts.
//
// It's driven by an animation frame loop rather than by renders. Advancing it
// per render would tie the rotation speed to how often the sensor value happens
// to change, and a device reporting a rock-steady heading would strand the map
// part-way through a turn.
//
// The loop runs for as long as the component is mounted rather than parking
// itself when settled: an idle frame is a handful of arithmetic, the browser
// stops calling it entirely when the tab is hidden, and every attempt to park
// and re-wake it needs a closure over "am I still running" that goes stale.

/** Don't re-render for less than this — sub-degree churn isn't visible. */
const EMIT_THRESHOLD_DEG = 0.5;

/**
 * Heavily damped compass bearing for rotating the map. Eases back to 0
 * (north-up) whenever heading-up is off or there's no compass to follow.
 */
export function useMapBearing(headingDeg: number | null, enabled: boolean): number {
  const [bearing, setBearing] = useState(0);

  // Where we're heading, refreshed every render without causing one. The loop
  // reads it rather than restarting whenever the sensor twitches.
  const target = useRef(0);
  target.current = enabled && headingDeg !== null ? headingDeg : 0;

  useEffect(() => {
    const state = createDampingState(0);
    let emitted = 0;
    let frame = requestAnimationFrame(function step() {
      frame = requestAnimationFrame(step);

      const smoothed = stepDamping(state, target.current);
      const moved = Math.abs(deltaDeg(emitted, smoothed));
      // While turning, skip sub-threshold churn; on the frame it settles, emit
      // once so the map lands exactly on the goal and then goes quiet.
      if (moved >= EMIT_THRESHOLD_DEG || (moved > 0 && smoothed === target.current)) {
        emitted = smoothed;
        setBearing(smoothed);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return bearing;
}
