// The procedural sound bank (src/audio/gen.ts) and the footstep surface map (src/audio/Surface.ts), checked offline: every
// sound renders finite, in range and not silent; the surfaces / materials differ where the ear says they should (spectral
// balance); the reverb rooms decay in their target times; loops are seamless; renders are deterministic.
import { describe, expect, test } from 'vitest';
import * as G from '../src/audio/gen';
import { Biquad, bandEnergy, centroid, rt60 } from '../src/audio/dsp';
import { SurfaceMap } from '../src/audio/Surface';

const sr = 48000;
const db = (e: number) => 10 * Math.log10(Math.max(1e-20, e));
const peak = (b: Float32Array) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); return m; };
const finite = (b: Float32Array) => b.every((v) => Number.isFinite(v));

describe('gen: every sound renders', () => {
  const all: [string, Float32Array][] = [
    ...G.STEP_KINDS.map((k): [string, Float32Array] => [`step-${k}`, G.footstep(k, sr, 1)]),
    ['whoosh', G.whoosh(sr, 1)], ['whoosh-heavy', G.whoosh(sr, 1, true)],
    ...G.MATERIALS.map((m): [string, Float32Array] => [`impact-${m}`, G.impact(m, sr, 1)]),
    ...G.ENEMIES.map((e): [string, Float32Array] => [`vocal-${e}`, G.vocal(e, sr, 1)]),
    ...(['boar', 'crab', 'sailor'] as const).map((e): [string, Float32Array] => [`windup-${e}`, G.windup(e, sr, 1)]),
    ['hurt', G.hurt(sr, 1)], ['death', G.death(sr, 1)], ['plunge-down', G.plunge(sr, 1, false)], ['plunge-up', G.plunge(sr, 1, true)],
  ];
  test.each(all)('%s: finite, peak-normalised, short, not silent', (_n, b) => {
    expect(finite(b)).toBe(true);
    expect(peak(b)).toBeGreaterThan(0.85);
    expect(peak(b)).toBeLessThanOrEqual(0.95);
    expect(b.length / sr).toBeLessThan(1.8);
    expect(Math.abs(b[b.length - 1] ?? 1)).toBeLessThan(1e-3); // faded out: no click at the end
  });
  test('deterministic per seed, different across seeds', () => {
    expect(G.footstep('planks', sr, 3)).toEqual(G.footstep('planks', sr, 3));
    expect(G.footstep('planks', sr, 3)).not.toEqual(G.footstep('planks', sr, 4));
  });
});

describe('gen: the surfaces sound like themselves', () => {
  const s = Object.fromEntries(G.STEP_KINDS.map((k) => [k, G.footstep(k, sr, 2)])) as Record<G.StepKind, Float32Array>;
  const hi = (k: G.StepKind) => db(bandEnergy(s[k], sr, 2000, 8000)), lo = (k: G.StepKind) => db(bandEnergy(s[k], sr, 60, 250));
  test('dry sand and grass are grainy / swishy (bright); planks are hollow (low, dark)', () => {
    expect(centroid(s.sand, sr)).toBeGreaterThan(centroid(s.planks, sr) * 2.5);
    expect(centroid(s.grass, sr)).toBeGreaterThan(centroid(s.planks, sr) * 3);
    expect(hi('planks')).toBeLessThan(hi('sand') - 10);
  });
  test('wet sand is darker than dry sand', () => {
    expect(centroid(s.wetSand, sr)).toBeLessThan(centroid(s.sand, sr) / 3);
  });
  test('planks ring in the board modes (100–300 Hz) longer than stone does', () => {
    const tail = (b: Float32Array) => b.subarray(Math.round(0.12 * sr));
    expect(db(bandEnergy(tail(s.planks), sr, 100, 300))).toBeGreaterThan(db(bandEnergy(tail(s.stone), sr, 100, 300)) + 6);
  });
  test('water has the most mid splash; rock / stone have a bright contact click', () => {
    expect(db(bandEnergy(s.water, sr, 250, 2000))).toBeGreaterThan(Math.max(...(['sand', 'grass', 'rock', 'planks', 'stone'] as const).map((k) => db(bandEnergy(s[k], sr, 250, 2000)))));
    expect(hi('rock')).toBeGreaterThan(hi('planks') + 6);
    expect(hi('stone')).toBeGreaterThan(hi('planks') + 3);
    expect(lo('wetSand')).toBeGreaterThan(lo('grass'));
  });
});

describe('gen: combat', () => {
  test('a heavy whoosh is lower than a light one', () => {
    expect(centroid(G.whoosh(sr, 1, true), sr)).toBeLessThan(centroid(G.whoosh(sr, 1), sr) * 0.6);
  });
  test('materials: shell + stone are bright and short, flesh is a low thump, wood rings mid', () => {
    const c = Object.fromEntries(G.MATERIALS.map((m) => [m, centroid(G.impact(m, sr, 1), sr)])) as Record<G.Material, number>;
    expect(c.flesh).toBeLessThan(c.wood);
    expect(db(bandEnergy(G.impact('shell', sr, 1), sr, 1500, 6000))).toBeGreaterThan(db(bandEnergy(G.impact('flesh', sr, 1), sr, 1500, 6000)) + 6);
    expect(db(bandEnergy(G.impact('stone', sr, 1), sr, 800, 6000))).toBeGreaterThan(db(bandEnergy(G.impact('wood', sr, 1), sr, 800, 6000)));
  });
  test('vocals: the monkey screeches high, the sailor and the boar are low', () => {
    const m = centroid(G.vocal('monkey', sr, 1), sr);
    expect(m).toBeGreaterThan(1000);
    expect(centroid(G.vocal('sailor', sr, 1), sr)).toBeLessThan(m / 2);
    expect(centroid(G.vocal('boar', sr, 1), sr)).toBeLessThan(m / 2);
  });
  test('hurt / death carry a voice (the 250–2 kHz formant band within 6 dB of the body thump)', () => {
    for (const b of [G.hurt(sr, 1), G.hurt(sr, 2), G.death(sr, 1)]) expect(db(bandEnergy(b, sr, 250, 2000))).toBeGreaterThan(db(bandEnergy(b, sr, 60, 250)) - 6);
  });
});

describe('gen: rooms and loops', () => {
  test.each([['hold', 0.6], ['cave', 1.5], ['shrine', 2.5]] as const)('%s IR decays in %s s (mid band, ±15 %%), unit energy, decorrelated L/R', (room, target) => {
    const [L, R] = G.impulse(room, sr, 1);
    const mid = L.slice(); new Biquad('bandpass', 1000, 0.7, sr).apply(mid);
    expect(rt60(mid, sr)).toBeGreaterThan(target * 0.85);
    expect(rt60(mid, sr)).toBeLessThan(target * 1.15);
    let e = 0, x = 0; for (let i = 0; i < L.length; i++) { e += (L[i] ?? 0) ** 2; x += (L[i] ?? 0) * (R[i] ?? 0); }
    expect(e).toBeCloseTo(1, 3);
    expect(Math.abs(x)).toBeLessThan(0.2);
  });
  test.each([true, false])('the noise loop (pink %s) is seamless and level', (pink) => {
    const b = G.noiseLoop(sr, 1, pink);
    expect(b.length).toBe(4 * sr);
    let e = 0; for (const v of b) e += v * v;
    const rms = Math.sqrt(e / b.length);
    expect(Math.abs((b[0] ?? 0) - (b[b.length - 1] ?? 0))).toBeLessThan(rms * 4);
    expect(rms).toBeGreaterThan(0.1);
    expect(rms).toBeLessThan(1.2); // float buffers: the pink loop runs hot (the bed gains are set against it)
  });
  test('the bubble bed loops without a click', () => {
    const b = G.bubbleBed(sr, 1);
    expect(b.length).toBe(6 * sr);
    expect(Math.abs((b[0] ?? 0) - (b[b.length - 1] ?? 0))).toBeLessThan(0.02);
  });
});

describe('SurfaceMap', () => {
  // a test island: the sea at 0.8; a beach ramp rising east (x) at 5 cm / m, a cliff (steep) past x = 120, a sand path at z = 0
  const sea = 0.8;
  const heightAt = (x: number, _z: number) => (x < 120 ? sea - 1 + x * 0.05 : sea + 5 + (x - 120) * 1.2);
  const trailDistance = (_x: number, z: number) => Math.abs(z - 50);
  const pier = { floorHeightAt: (x: number, z: number) => (Math.abs(x) < 2 && z < -10 ? sea + 1.2 : undefined) };
  const dais = { floorHeightAt: (x: number, z: number) => (Math.hypot(x - 100, z - 100) < 5 ? heightAt(100, 100) + 0.4 : undefined) };
  const map = new SurfaceMap({ sea, heightAt, trailDistance, decks: [pier, null], stone: [dais] });
  test('decks are planks only at deck height; the shrine dais is stone', () => {
    expect(map.surfaceAt(0, -20, sea + 1.2)).toBe('planks');
    expect(map.surfaceAt(0, -20, sea - 1)).toBe('water'); // under the pier
    expect(map.surfaceAt(100, 100, heightAt(100, 100) + 0.4)).toBe('stone');
  });
  test('the ground as the terrain paints it: water → wet sand → sand → grass (sand on a path), rock on the cliff', () => {
    expect(map.surfaceAt(5, 0, 0)).toBe('water');
    expect(map.surfaceAt(26, 0, 0)).toBe('wetSand');   // 0.3 m above the sea
    expect(map.surfaceAt(50, 0, 0)).toBe('sand');      // 1.5 m
    expect(map.surfaceAt(100, 0, 0)).toBe('grass');    // 4 m
    expect(map.surfaceAt(100, 49, 0)).toBe('sand');    // on the path
    expect(map.surfaceAt(130, 0, 0)).toBe('rock');     // the cliff
  });
});
