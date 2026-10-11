import { afterAll, describe, expect, it, vi } from 'vitest';
import { admitSpeciesBrains } from "../src/game/plugin/brain";
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../src/shards/driftwood-isle/data/brains';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { creature } from './fake/creature';
import { STRIDER_BRAIN, RAY_BRAIN, SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES } from '../src/shards/sunscar-dunes/data/brains';
import { speciesBrains } from '../src/sdk/speciesBrains';

const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
const rows = [
  { id: 'species.crab', kind: 'crab', label: 'Crab', variants: [], brain: { archetype: 'skirmisher', data: CRAB_BRAIN } },
  { id: 'species.sailor', kind: 'sailor', label: 'Sailor', variants: [], brain: { archetype: 'guardian', data: SAILOR_BRAIN } },
  { id: 'species.monkey', kind: 'monkey', label: 'Monkey', variants: [], brain: { archetype: 'perch-hunter', data: MONKEY_BRAIN } },
] as const;
// Species variants are mutable rows; the catalogue never mutates the caller's arrays.
const catalogueRows = rows.map(row => ({ id: row.id, kind: row.kind, label: row.label, variants: [], brain: row.brain }));

describe('species rows with trusted native body recipes', () => {
  it('admits Signal archetype profiles before construction and retains the original native policy spellings', () => {
    expect(STRIDER_BRAIN.archetype).toBe('grazer'); expect(RAY_BRAIN.archetype).toBe('diver');
    const catalogue = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
    expect(catalogue.kinds.has('duneStrider')).toBe(true); expect(catalogue.kinds.has('duneRay')).toBe(true);
    const row = SIGNAL_SPECIES.find(value => value.kind === 'duneStrider');
    const profile = STRIDER_BRAIN;
    if (row === undefined || profile.archetype !== 'grazer') throw new Error('Missing authored strider profile');
    expect(() => admitSpeciesBrains([{ ...row, brain: { ...profile, phaseSlots: 0 } }], [])).toThrow('phase slots');
    expect(() => admitSpeciesBrains([{ ...row, brain: { ...profile,
      data: { ...profile.data, faceSeconds: 0 } } }], [])).toThrow();
    expect(() => admitSpeciesBrains([{ ...row, brain: profile }], [])).toThrow('undeclared strike');
  });
  it.each(['crab', 'sailor', 'monkey'])('refuses automatic body installation for %s before any actor is constructed', kind => {
    const catalogue = admitSpeciesBrains(catalogueRows, []);
    expect(() => catalogue.bind(kind)).toThrow('trusted native body adapter');
    const actor = creature('crab', 'small').animal;
    expect(() => catalogue.policy(kind, actor)).toThrow('trusted native body adapter');
  });
  it('admits every row before construction, rejects unknown fields and copies the tuning', () => {
    expect(() => admitSpeciesBrains([{ id: 'species.crab', kind: 'crab', label: 'Crab', variants: [],
      brain: { archetype: 'skirmisher', data: { ...CRAB_BRAIN, attackDuration: 0 } } }], [])).toThrow();
    const extra = { ...CRAB_BRAIN, unlimited: true };
    expect(() => admitSpeciesBrains([{ id: 'species.crab', kind: 'crab', label: 'Crab', variants: [],
      brain: { archetype: 'skirmisher', data: extra } }], [])).toThrow();
    const data = { ...CRAB_BRAIN, awareRadius: 9 }, actor = creature('crab', 'small').animal;
    const catalogue = admitSpeciesBrains([{ id: 'species.crab', kind: 'crab', label: 'Crab', variants: [],
      brain: { archetype: 'skirmisher', data } }], []);
    data.awareRadius = 10;
    const policy = catalogue.decision('crab', actor).policy;
    expect(policy.snapshot()).toContain('"awareRadius":9');
    expect(() => catalogue.decision('missing', actor)).toThrow('declares no brain');
  });
  it('creates one native body per binding and preserves the live archetype witness', () => {
    const catalogue = admitSpeciesBrains(catalogueRows, []), fixture = creature('crab', 'small');
    const think = vi.fn(), act = vi.fn(), create = vi.fn(() => ({ think, act }));
    const bound = catalogue.bind('crab', create), before = fixture.animal.snapshot(), rng = fixture.ctx.rng.snapshot();
    expect(create).not.toHaveBeenCalled();
    expect(catalogue.witness(fixture.animal)).toBeNull();
    bound.act(fixture.animal, fixture.ctx); bound.think(fixture.animal, fixture.ctx); bound.act(fixture.animal, fixture.ctx);
    expect(create).toHaveBeenCalledTimes(1); expect(think).toHaveBeenCalledTimes(1); expect(act).toHaveBeenCalledTimes(2);
    expect(catalogue.witness(fixture.animal)).toBe('skirmisher');
    expect(fixture.animal.snapshot()).toEqual(before); expect(fixture.ctx.rng.snapshot()).toEqual(rng);
    const policy = catalogue.decision('crab', fixture.animal).policy;
    policy.restore(policy.snapshot());
    expect(fixture.animal.snapshot()).toEqual(before); expect(fixture.ctx.rng.snapshot()).toEqual(rng);
  });
});
