import { afterAll, expect, it, vi } from 'vitest';
import { admitSpeciesBrains } from '../src/game/plugin/brain';
import { parseRamGrazer } from '../src/format/grazers';
import { parseOrbitDiver, parseBurstFlyer } from '../src/format/flyers';
import { RamGrazerBrain } from '../src/engine/ai/ramGrazer';
import { OrbitDiverBrain } from '../src/engine/ai/orbitDiver';
import { BurstFlyerBrain } from '../src/engine/ai/burstFlyer';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { GOAT_BRAIN, RAY_BRAIN, WISP_BRAIN } from '../src/shards/far-reach/data/brains';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../src/shards/far-reach/data/strikes';
import { strike } from '../src/sdk/species';
import { strikeFromData } from '../src/engine/ai/strikeRows';
import { creature } from './fake/creature';

const release = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(release);
const declaredHome = { x: 0, z: -24, r: 22, y: 14 }, nativeHome = { x: 37, z: -41, r: 12, y: 25 };
const rows = [
  { id: 'sky.goat', kind: 'skyGoat', label: 'Sky Goat', variants: [], brain: { archetype: 'grazer' as const, data: { ...GOAT_BRAIN, kind: 'grazer' as const, pattern: 'wander-ram' as const } } },
  { id: 'sky.ray', kind: 'driftRay', label: 'Drift Ray', variants: [], brain: { archetype: 'diver' as const, data: { ...RAY_BRAIN, kind: 'diver' as const, pattern: 'orbit' as const, home: declaredHome } } },
  { id: 'sky.wisp', kind: 'galeWisp', label: 'Gale Wisp', variants: [], brain: { archetype: 'diver' as const, data: { ...WISP_BRAIN, kind: 'diver' as const, pattern: 'burst' as const, home: declaredHome } } },
];
const ram = strikeFromData(strike(RAM_DATA)), dive = strikeFromData(strike(DIVE_DATA)), burst = strikeFromData(strike(BURST_DATA));
const strikes = [strike(RAM_DATA), strike(DIVE_DATA), strike(BURST_DATA)];

it.each(['skyGoat', 'driftRay', 'galeWisp'])('%s refuses automatic installation before receiving its native body authority', kind => {
  const catalogue = admitSpeciesBrains(rows, strikes), actor = creature('crab', 'small').animal;
  expect(() => catalogue.bind(kind)).toThrow('trusted native body adapter');
  expect(() => catalogue.policy(kind, actor)).toThrow('trusted native body adapter');
  if (kind !== 'skyGoat') {
    expect(() => catalogue.bind(kind, () => ({ think: () => undefined, act: () => undefined }))).toThrow('native body home');
    expect(() => catalogue.decision(kind, actor)).toThrow('native body home');
    expect(() => catalogue.decision(kind, actor, { ...nativeHome, r: 0 })).toThrow('parameters');
  }
});
it('initializes each flight policy from its actual home and preserves every old constructor save byte without RNG or effects', () => {
  const catalogue = admitSpeciesBrains(rows, strikes), f = creature('crab', 'small'), actor = f.animal;
  const before = actor.snapshot(), rng = f.ctx.rng.snapshot();
  const goat = catalogue.decision('skyGoat', actor), ray = catalogue.decision('driftRay', actor, nativeHome), wisp = catalogue.decision('galeWisp', actor, nativeHome);
  expect(goat.archetype).toBe('ram-grazer'); expect(ray.archetype).toBe('orbit-diver'); expect(wisp.archetype).toBe('burst-flyer');
  expect(goat.policy.snapshot()).toBe(new RamGrazerBrain(actor, parseRamGrazer(GOAT_BRAIN), ram).snapshot());
  expect(ray.policy.snapshot()).toBe(new OrbitDiverBrain(actor, parseOrbitDiver({ ...RAY_BRAIN, home: nativeHome }), nativeHome, dive).snapshot());
  expect(wisp.policy.snapshot()).toBe(new BurstFlyerBrain(actor, parseBurstFlyer({ ...WISP_BRAIN, home: nativeHome }), nativeHome, burst).snapshot());
  expect(actor.snapshot()).toEqual(before); expect(f.ctx.rng.snapshot()).toEqual(rng); expect(f.hits).toEqual([]); expect(f.starts).toEqual([]);
});
it('binds the actual browser home once per body, keeps native callbacks and retains historical witness labels', () => {
  const catalogue = admitSpeciesBrains(rows, strikes), f = creature('crab', 'small'), home = vi.fn(() => nativeHome);
  const think = vi.fn(), act = vi.fn(), native = vi.fn(() => ({ think, act }));
  const bound = catalogue.bind('driftRay', native, home);
  expect(home).not.toHaveBeenCalled(); expect(native).not.toHaveBeenCalled(); expect(catalogue.witness(f.animal)).toBeNull();
  bound.think(f.animal, f.ctx); bound.act(f.animal, f.ctx); bound.think(f.animal, f.ctx);
  expect(home).toHaveBeenCalledTimes(1); expect(native).toHaveBeenCalledTimes(1); expect(think).toHaveBeenCalledTimes(2); expect(act).toHaveBeenCalledTimes(1);
  expect(catalogue.witness(f.animal)).toBe('orbit-diver');
});
it('admits and copies tuning and resolves every strike before constructing a policy', () => {
  expect(() => admitSpeciesBrains(rows, [])).toThrow('undeclared strike');
  const row = rows[0]; if (row === undefined) throw new Error('Missing goat declaration');
  expect(() => admitSpeciesBrains([{ ...row, brain: { archetype: 'grazer', data: { ...GOAT_BRAIN, kind: 'grazer', pattern: 'wander-ram', wanderMinSeconds: 6 } } }], strikes)).toThrow();
  const data = { ...GOAT_BRAIN, kind: 'grazer' as const, pattern: 'wander-ram' as const };
  const catalogue = admitSpeciesBrains([{ ...row, brain: { archetype: 'grazer', data } }], strikes);
  data.ramSpeed = 10;
  const saved = catalogue.decision('skyGoat', creature('crab', 'small').animal).policy.snapshot();
  expect(saved).toContain(String.raw`\"ramSpeed\":7.5`);
});
