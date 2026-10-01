import { describe, expect, it } from 'vitest';
import { GUIDE, failed, guided, installGullGuide, nearestUnfound, newGuideClock, progressed, tickGuide } from '#shards/driftwood-isle/quest/gullGuide';
import type { PlacePoint } from '#game/quest/core';
import * as THREE from 'three';

const PLACES: PlacePoint[] = [
  { id: 'pier', label: 'THE PIER', x: 0, z: -215, r: 40 },
  { id: 'hut', label: "WENDELL'S HUT", x: 0, z: 0, r: 26 },
  { id: 'lookout', label: 'THE LOOKOUT', x: -60, z: -40, r: 24 },
  { id: 'wreck', label: 'WRECK COVE', x: 120, z: 40, r: 30 },
];

/** run the clock for `secs` at `speed` in 0.1 s steps; the time (s) it first came due, or -1 */
function run(c: ReturnType<typeof newGuideClock>, secs: number, speed: number): number {
  for (let t = 0.1; t <= secs + 1e-9; t += 0.1) if (tickGuide(c, 0.1, speed)) return t;
  return -1;
}

describe('gull guide trigger (E309 B)', () => {
  it('walking with no progress: due after GUIDE.wander seconds, not before', () => {
    const c = newGuideClock();
    const due = run(c, 120, 4);
    expect(due).toBeGreaterThanOrEqual(GUIDE.wander - 0.1);
    expect(due).toBeLessThan(GUIDE.wander + 0.2);
  });

  it('standing still: due after GUIDE.idle seconds', () => {
    const c = newGuideClock();
    const due = run(c, 60, 0);
    expect(due).toBeGreaterThanOrEqual(GUIDE.idle - 0.1);
    expect(due).toBeLessThan(GUIDE.idle + 0.2);
  });

  it('moving again resets the idle clock', () => {
    const c = newGuideClock();
    expect(run(c, GUIDE.idle - 2, 0)).toBe(-1);
    tickGuide(c, 0.1, 3);
    expect(c.idle).toBe(0);
    expect(run(c, GUIDE.idle - 2, 0)).toBe(-1);
  });

  it('progress (a discovery, a quest step) restarts the wander clock', () => {
    const c = newGuideClock();
    expect(run(c, GUIDE.wander - 5, 4)).toBe(-1);
    progressed(c);
    expect(run(c, GUIDE.wander - 5, 4)).toBe(-1);
    expect(run(c, 10, 4)).toBeGreaterThan(0);
  });

  it('after a guide: nothing for GUIDE.cooldown seconds, even standing still', () => {
    const c = newGuideClock();
    expect(run(c, 60, 0)).toBeGreaterThan(0);
    guided(c);
    expect(run(c, GUIDE.cooldown - 1, 0)).toBe(-1);
    expect(run(c, 2, 0)).toBeGreaterThan(0);
  });

  it('no free gull: tries again after GUIDE.retry, not the full cooldown', () => {
    const c = newGuideClock();
    expect(run(c, 60, 0)).toBeGreaterThan(0);
    failed(c);
    expect(run(c, GUIDE.retry - 0.5, 0)).toBe(-1);
    expect(run(c, 1, 0)).toBeGreaterThan(0);
  });
});

describe('nearestUnfound', () => {
  const found = (ids: string[]) => (id: string) => ids.includes(id);

  it('picks the nearest place not yet discovered, by its edge', () => {
    // at (0, -100): pier edge 75 m, hut edge 74 m, lookout edge ~60 m → the lookout
    expect(PLACES[nearestUnfound(PLACES, found([]), 0, -100)]?.id).toBe('lookout');
    expect(PLACES[nearestUnfound(PLACES, found(['lookout']), 0, -100)]?.id).toBe('hut');
  });

  it('skips a place you are standing in (it is about to be discovered)', () => {
    expect(PLACES[nearestUnfound(PLACES, found([]), 0, 0)]?.id).not.toBe('hut');
  });

  it('-1 once every place is found', () => {
    expect(nearestUnfound(PLACES, found(PLACES.map((p) => p.id)), 0, 0)).toBe(-1);
  });
});

describe('installGullGuide', () => {
  function world(seen: string[]) {
    const updaters: ((dt: number, t: number) => void)[] = [];
    const flights: { tx: number; tz: number }[] = [];
    const listeners: ((flag: string, on: boolean) => void)[] = [];
    const w = {
      game: { onUpdate: (fn: (dt: number, t: number) => void) => { updaters.push(fn); } },
      player: { position: new THREE.Vector3(0, 2, -100), velocity: new THREE.Vector3(), yaw: 0 },
      hud: { entered: true, paused: false },
      gulls: { guide: (_p: THREE.Vector3, _y: number, tx: number, tz: number) => { flights.push({ tx, tz }); return true; } },
    };
    installGullGuide(w, { points: PLACES, discovered: (id) => seen.includes(id) }, { onChange: (fn) => { listeners.push(fn); } });
    const step = (secs: number) => { for (let t = 0; t < secs; t += 0.1) for (const u of updaters) u(0.1, t); };
    return { w, flights, step, flag: (f: string) => { for (const l of listeners) l(f, true); } };
  }

  it('idle 10 s → one flight toward the nearest unfound place, then the cooldown', () => {
    const { flights, step } = world([]);
    step(GUIDE.idle + 0.5);
    expect(flights).toEqual([{ tx: -60, tz: -40 }]);
    step(GUIDE.cooldown - 5);
    expect(flights.length).toBe(1);
  });

  it('never while paused or before entering the world', () => {
    const { w, flights, step } = world([]);
    w.hud.paused = true;
    step(GUIDE.wander + 5);
    expect(flights.length).toBe(0);
  });

  it('a saved flag counts as progress; a pressure plate does not', () => {
    const { w, flights, step, flag } = world([]);
    w.player.velocity.set(3, 0, 0);
    step(GUIDE.wander - 10);
    flag('seen:hut');
    step(GUIDE.wander - 10);
    expect(flights.length).toBe(0);
    flag('plate:hold-a');
    step(12);
    expect(flights.length).toBe(1);
  });

  it('no flight once every place is found', () => {
    const { flights, step } = world(PLACES.map((p) => p.id));
    step(GUIDE.wander * 3);
    expect(flights.length).toBe(0);
  });
});
