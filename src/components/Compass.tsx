import type { Units } from '../lib/geodesy';
import { formatBearing, formatDistance, normalizeDeg } from '../lib/geodesy';

interface Props {
  /** Bearing to the target, degrees clockwise from north. Null with no target. */
  bearing: number | null;
  /** Where the phone is pointing. Null when there's no usable compass. */
  headingDeg: number | null;
  distanceM: number | null;
  units: Units;
}

// Tick marks every 30°, with the cardinals labelled.
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

/**
 * The dial. The rose counter-rotates against the compass heading so that N on
 * screen really is north; the arrow then sits at the target's bearing within
 * that rose, which puts it physically over the target.
 *
 * With no compass the rose stays north-up — matching the map underneath — and
 * the arrow still shows the correct bearing, just not relative to how you're
 * holding the phone.
 */
export function Compass({ bearing, headingDeg, distanceM, units }: Props) {
  const heading = headingDeg ?? 0;
  const live = headingDeg !== null;
  // How far to turn to face the target: what the arrow shows on screen.
  const relative = bearing === null ? null : normalizeDeg(bearing - heading);
  // On target within a few degrees — worth calling out, GPS/compass noise means
  // pretending to be more precise than this would be a lie.
  const onTarget = relative !== null && (relative < 8 || relative > 352);

  return (
    <div class={`compass${live ? '' : ' compass-static'}${onTarget ? ' compass-on' : ''}`}>
      <svg viewBox="0 0 200 200" class="compass-dial" aria-hidden="true">
        <circle cx="100" cy="100" r="94" class="dial-face" />
        <circle cx="100" cy="100" r="88" class="dial-ring" />

        {/* The rose: rotates against the heading so N points at real north. */}
        <g style={{ transform: `rotate(${-heading}deg)`, transformOrigin: '100px 100px' }}>
          {TICKS.map((deg) => {
            const label = CARDINALS[deg];
            const rad = ((deg - 90) * Math.PI) / 180;
            const inner = label ? 68 : 78;
            return (
              <g key={deg}>
                <line
                  x1={100 + Math.cos(rad) * 88}
                  y1={100 + Math.sin(rad) * 88}
                  x2={100 + Math.cos(rad) * inner}
                  y2={100 + Math.sin(rad) * inner}
                  class={label ? 'tick tick-cardinal' : 'tick'}
                />
                {label && (
                  <text
                    x={100 + Math.cos(rad) * 55}
                    y={100 + Math.sin(rad) * 55}
                    class={deg === 0 ? 'dial-label dial-north' : 'dial-label'}
                    text-anchor="middle"
                    dominant-baseline="central"
                    /* Counter-rotate so labels stay upright as the rose turns. */
                    style={{
                      transform: `rotate(${heading}deg)`,
                      transformOrigin: `${100 + Math.cos(rad) * 55}px ${100 + Math.sin(rad) * 55}px`
                    }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* The arrow: sits at the target's bearing within the rose. */}
        {relative !== null && (
          <g
            class="needle"
            style={{ transform: `rotate(${relative}deg)`, transformOrigin: '100px 100px' }}
          >
            <path d="M100 26 L115 97 L100 86 L85 97 Z" class="needle-head" />
            <path d="M100 158 L91 105 L100 114 L109 105 Z" class="needle-tail" />
          </g>
        )}
        <circle cx="100" cy="100" r="7" class="dial-hub" />
      </svg>

      <div class="compass-readout">
        <div class="readout-distance">
          {distanceM === null ? '—' : formatDistance(distanceM, units)}
        </div>
        <div class="readout-bearing">
          {bearing === null ? 'no target' : formatBearing(bearing)}
        </div>
      </div>
    </div>
  );
}
