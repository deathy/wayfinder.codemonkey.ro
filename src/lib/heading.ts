// Reading a compass heading in a browser is genuinely awkward: two incompatible
// APIs, no agreed north reference, and a permission model that only one platform
// has. Everything ugly about it is contained here — callers get a single
// `Heading` or `null`.
//
//  - Chrome/Android: `deviceorientationabsolute`, referenced to MAGNETIC north.
//  - Safari/iOS:     `deviceorientation` + `webkitCompassHeading`, after an
//                    explicit `requestPermission()` from a user gesture.
//
// Neither is corrected for magnetic declination yet, so we report the reading
// honestly as `magnetic` and let the UI say so. True-north correction (WMM) is
// a later step — see PLAN.md.

import type { Heading } from './types';
import { normalizeDeg } from './geodesy';

type Listener = (heading: Heading | null) => void;

interface IosDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface IosDeviceOrientationCtor {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

export type CompassSupport = 'unavailable' | 'needs-permission' | 'ready';

function iosCtor(): IosDeviceOrientationCtor | null {
  if (typeof DeviceOrientationEvent === 'undefined') return null;
  const ctor = DeviceOrientationEvent as unknown as IosDeviceOrientationCtor;
  return typeof ctor.requestPermission === 'function' ? ctor : null;
}

/** What we can expect from this device before asking for anything. */
export function compassSupport(): CompassSupport {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
    return 'unavailable';
  }
  return iosCtor() ? 'needs-permission' : 'ready';
}

/**
 * Ask iOS for motion-sensor access. Must be called synchronously from a user
 * gesture or Safari rejects it. A no-op that resolves true everywhere else.
 */
export async function requestCompassPermission(): Promise<boolean> {
  const ctor = iosCtor();
  if (!ctor?.requestPermission) return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Where the top of the *phone* points, in degrees clockwise from north, derived
 * from the spec's ZXY rotation matrix rather than raw `alpha`.
 *
 * Using the matrix buys us tilt tolerance: it gives the true horizontal heading
 * of the phone's long axis even when the phone isn't lying flat, and when the
 * phone is held upright (long axis near-vertical, where that projection
 * collapses) it switches to the axis pointing out of the back of the phone —
 * so "hold it flat like a compass" and "point it at the horizon" both work.
 */
function headingFromEuler(alpha: number, beta: number, gamma: number): number | null {
  const a = (alpha * Math.PI) / 180;
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  // World frame is x=east, y=north, z=up. These are columns of R = Rz·Rx·Ry.
  // Device +Y — the top edge of the phone.
  const topEast = -cB * sA;
  const topNorth = cA * cB;
  // Device -Z — straight out of the back, where the camera looks.
  const backEast = -(cA * sG + cG * sA * sB);
  const backNorth = -(sA * sG - cA * cG * sB);

  // Whichever axis is currently closer to horizontal gives the steadier heading.
  const topH = Math.hypot(topEast, topNorth);
  const backH = Math.hypot(backEast, backNorth);
  const [east, north] = topH >= backH ? [topEast, topNorth] : [backEast, backNorth];
  if (Math.hypot(east, north) < 1e-6) return null; // degenerate: phone edge-on

  return normalizeDeg((Math.atan2(east, north) * 180) / Math.PI);
}

/**
 * Rotate a phone-frame heading into the screen frame. The PWA manifest locks
 * portrait, where this is a no-op, but a browser tab can still be landscape.
 */
function toScreenFrame(deg: number): number {
  const angle = window.screen?.orientation?.angle ?? 0;
  return normalizeDeg(deg + angle);
}

// Magnetometers jitter by several degrees even with the phone sitting still, and
// a twitching needle reads as "broken" long before it reads as "imprecise". This
// averages the unit vectors rather than the angles — so 359° and 1° average to
// 0°, not 180° — which smooths the reading without the lag of a long window.
const SMOOTHING = 0.25;

class HeadingFilter {
  private x = 0;
  private y = 0;
  private primed = false;

  push(deg: number): number {
    const rad = (deg * Math.PI) / 180;
    const east = Math.sin(rad);
    const north = Math.cos(rad);
    if (!this.primed) {
      this.x = east;
      this.y = north;
      this.primed = true;
    } else {
      this.x += (east - this.x) * SMOOTHING;
      this.y += (north - this.y) * SMOOTHING;
    }
    return normalizeDeg((Math.atan2(this.x, this.y) * 180) / Math.PI);
  }
}

/**
 * Subscribe to compass headings. Calls back with a `Heading`, or with `null` if
 * no usable reading arrives — which is the normal case on a desktop browser.
 * Returns an unsubscribe function.
 */
export function watchHeading(onHeading: Listener): () => void {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
    onHeading(null);
    return () => {};
  }

  let gotReading = false;
  let usingFallback = false;
  const filter = new HeadingFilter();

  const handle = (event: DeviceOrientationEvent) => {
    const ios = event as IosDeviceOrientationEvent;

    // iOS hands us a finished compass heading; take it as-is.
    if (typeof ios.webkitCompassHeading === 'number' && !Number.isNaN(ios.webkitCompassHeading)) {
      gotReading = true;
      onHeading({
        degrees: filter.push(toScreenFrame(ios.webkitCompassHeading)),
        reference: 'magnetic',
        source: 'webkit',
        accuracyDeg: ios.webkitCompassAccuracy
      });
      return;
    }

    // Everyone else: derive it, but only from an earth-referenced event. A
    // relative-orientation event drifts freely and would point at nothing.
    const absolute = event.absolute || event.type === 'deviceorientationabsolute';
    if (!absolute || event.alpha === null || event.beta === null || event.gamma === null) return;

    const deg = headingFromEuler(event.alpha, event.beta, event.gamma);
    if (deg === null) return;
    gotReading = true;
    onHeading({ degrees: filter.push(toScreenFrame(deg)), reference: 'magnetic', source: 'absolute' });
  };

  window.addEventListener('deviceorientationabsolute', handle as EventListener);
  window.addEventListener('deviceorientation', handle as EventListener);

  // Some browsers fire neither. Report "no compass" rather than leaving the UI
  // waiting on a reading that is never coming.
  const timer = window.setTimeout(() => {
    if (!gotReading && !usingFallback) {
      usingFallback = true;
      onHeading(null);
    }
  }, 2_000);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('deviceorientationabsolute', handle as EventListener);
    window.removeEventListener('deviceorientation', handle as EventListener);
  };
}

// Below this speed a GPS course reading is mostly noise, so we don't offer it as
// a stand-in heading.
export const MIN_COURSE_SPEED_MPS = 1.0;
