import { describe, expect, it } from 'vitest';
import { createDampingState, stepDamping, SETTLED_DEG } from './bearingDamping';
import { deltaDeg } from './geodesy';

/** Run the filter until it settles, returning every bearing it passed through. */
function runToSettle(from: number, to: number, maxFrames = 600): number[] {
  const state = createDampingState(from);
  const seen: number[] = [];
  for (let i = 0; i < maxFrames; i++) {
    const next = stepDamping(state, to);
    seen.push(next);
    if (Math.abs(deltaDeg(next, to)) === 0) break;
  }
  return seen;
}

describe('stepDamping', () => {
  it('converges on the target', () => {
    const path = runToSettle(0, 90);
    expect(path[path.length - 1]).toBeCloseTo(90, 6);
  });

  it('catches up quickly enough to feel connected to the turn', () => {
    // What matters is how fast it covers the turn, not how long the last tenth
    // of a degree takes: a 90° turn should look done within ~0.6 s at 60 fps.
    const path = runToSettle(0, 90);
    const withinFive = path.findIndex((b) => Math.abs(deltaDeg(b, 90)) <= 5);
    expect(withinFive).toBeGreaterThanOrEqual(0);
    expect(withinFive).toBeLessThan(40);
    // And the exact landing shouldn't drag on much past a second.
    expect(path.length).toBeLessThan(90);
  });

  it('lands exactly on the target rather than creeping', () => {
    const state = createDampingState(0);
    let last = 0;
    for (let i = 0; i < 300; i++) last = stepDamping(state, 137.5);
    expect(last).toBe(137.5);
    // And stays put once settled.
    expect(stepDamping(state, 137.5)).toBe(137.5);
  });

  it('turns the short way through north instead of the long way round', () => {
    // 350° -> 10° is a 20° turn forwards, not a 340° spin backwards.
    const path = runToSettle(350, 10);
    for (const b of path) {
      const inFinalStretch = b >= 350 || b <= 10;
      expect(inFinalStretch).toBe(true);
    }
  });

  it('moves monotonically toward the goal', () => {
    const path = runToSettle(0, 170);
    for (let i = 1; i < path.length; i++) {
      const before = Math.abs(deltaDeg(path[i - 1]!, 170));
      const after = Math.abs(deltaDeg(path[i]!, 170));
      expect(after).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  it('does nothing when already on target', () => {
    const state = createDampingState(42);
    expect(stepDamping(state, 42)).toBe(42);
  });

  it('is slower than the needle filter it is deliberately damping', () => {
    // The whole point of a separate filter: one frame of map damping must move
    // far less than one sample of the needle's α = 0.25.
    const map = createDampingState(0);
    const first = stepDamping(map, 90);
    expect(first).toBeLessThan(90 * 0.25);
  });

  it('tracks a moving target without falling behind', () => {
    // Simulates a steady turn: the goal advances 1° per frame.
    const state = createDampingState(0);
    let bearing = 0;
    for (let i = 0; i < 200; i++) bearing = stepDamping(state, i);
    // Lag should stay small and bounded, not accumulate.
    expect(Math.abs(deltaDeg(bearing, 199))).toBeLessThan(15);
  });

  it('exposes a settle threshold tight enough to be invisible', () => {
    expect(SETTLED_DEG).toBeLessThanOrEqual(0.5);
  });
});
