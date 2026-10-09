// src/shards/nalati-grasslands/world/Weather.ts + the clock in src/engine/world/DayNight.ts (Nalati B10): the storm cycle's phases and lengths, the
// lightning's target choice (the highest thing), the GET LOW rule, and the day clock's schedule / sun / phase events.
import { describe, expect, it } from 'vitest';
import { SteppeStorm as Weather, type Exposed, type LightningPlayer, type LightningWorld, type Strike } from '../../../src/shards/nalati-grasslands/world/Weather';
import { STORM_PHASES } from '../../../src/shards/nalati-grasslands/world/weatherProfile';
import { steppeClock, clockForSun, DEFAULT_SCHEDULE } from '../../../src/shards/nalati-grasslands/look/dayKeys';
import { lightLevel } from '../../../src/shards/nalati-grasslands/look/wildLight';

function world(opts: { trees?: Exposed[]; player?: Partial<LightningPlayer>; ground?: (x: number, z: number) => number } = {}): LightningWorld {
  const p: LightningPlayer = { x: 0, y: 0, z: 0, crouched: false, mounted: false, sheltered: false, ...opts.player };
  return {
    heightAt: opts.ground ?? (() => 0),
    exposed: (x, z, r, out) => { for (const t of opts.trees ?? []) if (Math.hypot(t.x - x, t.z - z) <= r) out.push(t); },
    player: () => p,
  };
}

function run(w: Weather, seconds: number, step = 0.1): void { for (let t = 0; t < seconds; t += step) w.update(step); }

describe('Weather — the storm cycle', () => {
  it('starts clear and waits 12–18 min for the first storm', () => {
    const w = new Weather({ seed: 1, world: world() });
    expect(w.state).toBe('clear');
    expect(w.phaseLen).toBeGreaterThanOrEqual(12 * 60);
    expect(w.phaseLen).toBeLessThanOrEqual(18 * 60);
  });

  it('runs clear → building → gust → storm → clearing → after → clear with the design lengths', () => {
    const w = new Weather({ seed: 7, world: world() });
    const seen: string[] = [];
    w.onPhase((p) => { seen.push(p); });
    w.force('building');
    expect(w.phaseLen).toBe(90);
    run(w, 91);
    expect(w.state).toBe('gust');
    expect(w.phaseLen).toBe(20);
    run(w, 21);
    expect(w.state).toBe('storm');
    expect(w.phaseLen).toBeGreaterThanOrEqual(120);
    expect(w.phaseLen).toBeLessThanOrEqual(180);
    run(w, w.phaseLen + 1);
    expect(w.state).toBe('clearing');
    run(w, 61);
    expect(w.state).toBe('after');
    run(w, 181);
    expect(w.state).toBe('clear');
    expect(w.phaseLen).toBeGreaterThanOrEqual(20 * 60);
    expect(w.phaseLen).toBeLessThanOrEqual(30 * 60);
    expect(seen).toEqual(['building', 'gust', 'storm', 'clearing', 'after', 'clear']);
    expect(STORM_PHASES).toHaveLength(6);
  });

  it('the storm is wet, windy and dark; the after has the rainbow', () => {
    const w = new Weather({ seed: 3, world: world() });
    w.force('storm', 0.5);
    w.update(0.1);
    expect(w.stormActive).toBe(true);
    expect(w.overcast).toBeGreaterThan(0.95);
    expect(w.rain).toBeGreaterThan(0.9);
    expect(w.windSpeed ?? 0).toBeGreaterThanOrEqual(18);
    expect(w.windSpeed ?? 99).toBeLessThanOrEqual(24);
    w.force('after', 0.3);
    w.update(0.1);
    expect(w.stormActive).toBe(false);
    expect(w.rain).toBe(0);
    expect(w.rainbow).toBeGreaterThan(0.9);
    expect(w.wet).toBeGreaterThan(0.5);
  });

  it('a boss fight (hold) keeps the clear phase from ending', () => {
    const w = new Weather({ seed: 5, world: world() });
    w.hold = true;
    run(w, w.phaseLen + 30, 1);
    expect(w.state).toBe('clear');
  });
});

describe('Weather — lightning', () => {
  it('strikes the highest thing near its cell, telegraphing 1.2 s first', () => {
    const tree: Exposed = { x: 60, z: 0, top: 18, kind: 'tree', ref: 'spruce' };
    const w = new Weather({ seed: 11, world: world({ trees: [tree] }) });
    const tele: Strike[] = [], hits: Strike[] = [];
    w.onTelegraph((s) => { tele.push(s); }); w.onStrike((s) => { hits.push(s); });
    w.force('storm');
    // run until a strike lands near the tree
    for (let i = 0; i < 4000 && !hits.some((h) => h.kind === 'tree'); i++) w.update(0.05);
    const h = hits.find((s) => s.kind === 'tree');
    expect(h).toBeDefined();
    expect(h?.ref).toBe('spruce');
    expect(h?.y).toBe(18);
    expect(tele.length).toBeGreaterThanOrEqual(hits.length);
  });

  it('GET LOW on open ground in the storm; crouching clears it; a nearby taller tree clears it; shelter clears it', () => {
    const player: Partial<LightningPlayer> = {};
    const w = new Weather({ seed: 2, world: world({ player }) });
    w.force('storm');
    w.update(0.3);
    expect(w.getLow).toBe(true);
    const crouched = new Weather({ seed: 2, world: world({ player: { crouched: true } }) });
    crouched.force('storm'); crouched.update(0.3);
    expect(crouched.getLow).toBe(false);
    const mounted = new Weather({ seed: 2, world: world({ player: { crouched: true, mounted: true } }) });
    mounted.force('storm'); mounted.update(0.3);
    expect(mounted.getLow).toBe(true);
    const trees = new Weather({ seed: 2, world: world({ trees: [{ x: 10, z: 0, top: 15, kind: 'tree' }] }) });
    trees.force('storm'); trees.update(0.3);
    expect(trees.getLow).toBe(false);
    const yurt = new Weather({ seed: 2, world: world({ player: { sheltered: true } }) });
    yurt.force('storm'); yurt.update(0.3);
    expect(yurt.getLow).toBe(false);
    const clear = new Weather({ seed: 2, world: world() });
    clear.update(0.3);
    expect(clear.getLow).toBe(false);
  });

  it('a player who stays proud in the storm gets struck (60), unless they move off', () => {
    const w = new Weather({ seed: 9, world: world() });
    let dmg = 0;
    w.onPlayerHit((d) => { dmg += d; });
    w.force('storm');
    run(w, 170, 0.05);
    expect(dmg).toBeGreaterThanOrEqual(60);
    expect(dmg % 60).toBe(0);
  });
});

describe('DayClock', () => {
  it('a day is ~26 minutes of play and the phases come in order', () => {
    const c = steppeClock({ start: 7.01 });
    expect(c.dayMinutes).toBeCloseTo(DEFAULT_SCHEDULE.reduce((a, s) => a + s.minutes, 0));
    expect(c.dayMinutes).toBeGreaterThanOrEqual(24);
    expect(c.dayMinutes).toBeLessThanOrEqual(30);
    const order: string[] = [];
    c.onPhase((p) => { order.push(p); });
    for (let t = 0; t < c.dayMinutes * 60 + 1; t += 1) c.update(1);
    expect(order).toEqual(['golden', 'dusk', 'night', 'dawn', 'day']);
  });

  it('onDusk / onNight / onDawn fire on entering their phase, and set() fires too', () => {
    const c = steppeClock({ start: 12 });
    const got: string[] = [];
    c.onDusk(() => { got.push('dusk'); }); c.onNight(() => { got.push('night'); }); c.onDawn(() => { got.push('dawn'); });
    void c.set('dusk'); void c.set('night'); void c.set('dawn');
    expect(got).toEqual(['dusk', 'night', 'dawn']);
  });

  it('forSun starts on the def sun (Nalati: azimuth 250, elevation 26)', () => {
    const c = clockForSun({ azimuth: 250, elevation: 26 });
    expect(c.sunElevation).toBeCloseTo(26, 5);
    expect(c.sunAzimuth).toBeCloseTo(250, 5);
    expect(c.dayPhase).toBe('day');
  });

  it('the sun rises in the east, stands south at noon, sets in the west; light 1 by day, 0.4 at night', () => {
    const c = steppeClock({ start: 6 });
    expect(c.sunElevation).toBeCloseTo(0, 5); expect(c.sunAzimuth).toBeCloseTo(90, 5);
    void c.set(12); expect(c.sunElevation).toBeCloseTo(58, 5); expect(c.sunAzimuth).toBeCloseTo(180, 5);
    expect(lightLevel(c)).toBeCloseTo(1, 5);
    void c.set(18); expect(c.sunElevation).toBeCloseTo(0, 5); expect(c.sunAzimuth).toBeCloseTo(270, 5);
    void c.set(0); expect(c.sunElevation).toBeLessThan(-50); expect(lightLevel(c)).toBeCloseTo(0.4, 5);
  });
});

describe('Weather — saved and restored (SF72: a renderer-free host carries the storm in its snapshot)', () => {
  it('continues a storm exactly from its saved state: the phase clock, the numbers, the stream, an armed strike, GET LOW', () => {
    const trees: Exposed[] = [{ x: 20, z: 10, top: 9, kind: 'tree' }, { x: -60, z: 80, top: 12, kind: 'thing' }];
    const strikes = (w: Weather): string[] => { const out: string[] = []; w.onStrike((s) => { out.push(`${s.kind} ${s.x.toFixed(3)} ${s.z.toFixed(3)}`); }); return out; };
    const steps = (w: Weather, n: number): void => { for (let i = 0; i < n; i++) w.update(0.1); };
    const whole = new Weather({ seed: 3, world: world({ trees }) }), seenWhole = strikes(whole);
    const first = new Weather({ seed: 3, world: world({ trees }) });
    for (const w of [whole, first]) w.force('gust', 0.5);
    steps(whole, 2000); steps(first, 1000);
    const saved = structuredClone(first.snapshot());
    const resumed = new Weather({ seed: 99, world: world({ trees }) }), seenResumed = strikes(resumed);
    resumed.restore(saved);
    expect(resumed.snapshot()).toEqual(first.snapshot());
    steps(resumed, 1000);
    expect(resumed.snapshot()).toEqual(whole.snapshot());
    expect(seenResumed.length).toBeGreaterThan(0); expect(seenWhole.slice(-seenResumed.length)).toEqual(seenResumed);
    expect(() => { resumed.restore({ ...saved, state: 'hail' as never }); }).toThrow(RangeError);
  });

  it('refuses to save an armed strike on a tree it holds a reference to', () => {
    // a tall tree wherever the storm looks: every strike takes it
    const w = new Weather({ seed: 5, world: { ...world(), exposed: (x, z, _r, out) => { out.push({ x, z, top: 40, kind: 'tree', ref: {} }); } } });
    w.force('storm', 0.1);
    for (let i = 0; i < 2000 && w.pending === null; i++) w.update(0.05);
    expect(w.pending?.ref).toBeDefined();
    expect(() => w.snapshot()).toThrow('cannot be saved');
  });
});
