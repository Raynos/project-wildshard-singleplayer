import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { sampleCreatureGroup, type CreatureGroupSpec } from '../src/game/plugin/brain';
import { PineNightDirector, preparePineNightDirector, type NightActor, type NightSpec } from '../src/shards/pine-hollow/runtime/nightDirector';
import { pineNightSpec } from '../src/shards/pine-hollow/quest/nightSpec';

const ground = (x: number, z: number): number => Math.sin(x * 0.05) * 3 + Math.cos(z * 0.07) * 2;

test('group sampling keeps source order, accepted variants and data gates, refusing before draws', () => {
  const rng = new Rng(357);
  const row: CreatureGroupSpec<'hunter'> = { kind: 'hunter', count: 3, herd: 2, variant: 'small', firstVariant: 'big',
    source: { kind: 'radial', centre: { x: 5, z: 9 }, radius: [1, 3], firstAtCentre: true } };
  const accepted = sampleCreatureGroup(row, rng);
  expect(accepted[0]).toMatchObject({ kind: 'hunter', variant: 'big', herd: 2, x: 5, z: 9 });
  expect(accepted.map(sample => sample.variant)).toEqual(['big', 'small', 'small']);
  expect(accepted.every(sample => Number.isFinite(sample.yaw) && sample.herd === row.herd)).toBe(true);
  const points = [{ x: 7, z: -2 }, { x: 4, z: 8 }];
  const indexed = sampleCreatureGroup({ ...row, count: 2, variants: ['elder', null], source: { kind: 'indexed', points }, yaw: 0 }, rng);
  expect(indexed.map(sample => ({ x: sample.x, z: sample.z }))).toEqual(points);
  expect(indexed.map(sample => sample.variant)).toEqual(['elder', null]);
  const faced = sampleCreatureGroup({ ...row, count: 1, face: { x: 5, z: 20 }, source: { kind: 'indexed', points } }, rng);
  expect(faced[0]?.yaw).toBe(Math.atan2(5 - 7, 20 + 2));
  const saved = rng.snapshot();
  expect(() => sampleCreatureGroup({ ...row, count: 17 }, rng)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, source: { kind: 'indexed', points: [] } }, rng)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, source: { kind: 'radial', centre: { x: 0, z: 0 }, radius: [4, 1] } }, rng)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, accept: { minHeight: 0 } }, rng)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, yaw: 0, face: { x: 0, z: 0 } }, rng)).toThrow('group');
  expect(rng.snapshot()).toEqual(saved);
  const fallback = sampleCreatureGroup({ ...row, count: 1, accept: { bound: 0.001 },
    source: { kind: 'radial', centre: points[0] ?? { x: 0, z: 0 }, radius: [0, 4], radiusLaw: 'area', attempts: 2, fallback: 'centre' } }, rng);
  expect(fallback[0]).toMatchObject(points[0] ?? {});
});

/** The retired callback form of the radial draw (`Rng.range`, a borrowed accept), kept as the oracle for Driftwood's crab groups. */
function retiredRadial(centre: { x: number; z: number }, count: number, rng: Rng, accept: (x: number, z: number) => boolean): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  for (let index = 0; index < count; index++) {
    const angle = rng.range(0, Math.PI * 2), radius = index === 0 ? 0 : rng.range(1.2, 2.8);
    const x = centre.x + Math.cos(angle) * radius, z = centre.z + Math.sin(angle) * radius;
    if (!accept(x, z)) continue;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2) });
  }
  return out;
}

test('Driftwood crab groups on data gates match the retired accept callback bit for bit', () => {
  for (let seed = 0; seed < 200; seed++) {
    const a = new Rng(seed ^ 0xe11e), b = new Rng(seed ^ 0xe11e), centre = { x: seed * 1.7 - 150, z: 80 - seed * 0.9 }, water = 0.4;
    const old = retiredRadial(centre, 5, a, (x, z) => !(ground(x, z) < water + .15));
    const now = sampleCreatureGroup({ kind: 'crab', count: 5, herd: 0, variant: 'small', firstVariant: 'big',
      source: { kind: 'radial', centre, radius: [1.2, 2.8], firstAtCentre: true }, accept: { minHeight: water + .15 } }, b, { heightAt: ground });
    expect(now.map(({ x, z, yaw }) => ({ x, z, yaw }))).toEqual(old);
    expect(b.snapshot()).toEqual(a.snapshot());
  }
});

/** Pine's retired roamer loop (runtime/nightDirector.ts before sampleCreatureGroup), verbatim, as the oracle. */
function retiredRoamer(spec: NightSpec, p: { x: number; z: number }, anywhere: boolean, next: () => number, height: (x: number, z: number) => number): { x: number; z: number; yaw: number } | null {
  for (let tries = 0; tries < 12; tries++) {
    const ang = next() * Math.PI * 2, rr = Math.sqrt(next()) * 0.8;
    const x = spec.region.x + Math.sin(ang) * spec.region.ax * rr, z = spec.region.z + Math.cos(ang) * spec.region.az * rr;
    const dp = Math.hypot(x - p.x, z - p.z);
    if (!anywhere && (dp < 45 || dp > 150)) continue;
    if (anywhere && (dp < 18 || dp > 60)) continue;
    if (Math.hypot(x - spec.exclude.x, z - spec.exclude.z) < spec.exclude.blend + 8) continue;
    if (Math.abs(x) > 235 || Math.abs(z) > 235 || height(x, z) < spec.water + 0.6) continue;
    return { x, z, yaw: Math.atan2(p.x - x, p.z - z) };
  }
  return null;
}

test('Pine night roamers on sampleCreatureGroup rows spawn exactly where the retired loop did', async () => {
  const create = await preparePineNightDirector(), spec = pineNightSpec(4);
  const height = (x: number, z: number): number => spec.water + ground(x, z);
  let spawned = 0;
  for (let seed = 0; seed < 120; seed++) {
    const player = { x: spec.region.x + (seed % 11 - 5) * 14, y: 0, z: spec.region.z + (seed % 7 - 3) * 19 };
    const oracle = new Rng(seed).fork('pine.night'), live = new Rng(seed).fork('pine.night');
    const expected: { x: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < 4; i++) { const at = retiredRoamer(spec, player, true, () => oracle.next(), height); if (at !== null) expected.push(at); }
    const got: { x: number; z: number; yaw: number }[] = [];
    const brain = new PineNightDirector<NightActor>(create(), {
      night: () => 1, errand: () => false, onErrandDone: () => undefined, stream: live, ground: { heightAt: height },
      spawn: (_kind, x, z, yaw) => { got.push({ x, z, yaw }); return { position: { x, y: 0, z }, alive: true, hp: 1, maxHp: 1, lookWeight: 1, setMotion: () => undefined }; },
      own: () => undefined, release: () => undefined, retire: () => undefined, burst: () => undefined, shot: () => undefined,
    }, spec);
    brain.force(player);
    expect(got).toEqual(expected);
    expect(live.snapshot()).toEqual(oracle.snapshot());
    spawned += got.length;
  }
  expect(spawned).toBeGreaterThan(100);
});
