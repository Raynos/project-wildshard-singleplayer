// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- the immutable shipping declaration fixture has a source/provenance hash.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- fixture integrity is SHA-256, not a gameplay API.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- exact continuation comparison keeps signed zero and all numeric fields.
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { StrikeRunner, type StrikeActor, type StrikeContext, type StrikeSpec } from '../../src/engine/ai/strikes';
import { strikeFromData, strikeWeight, type StrikeWeight } from '../../src/engine/ai/strikeRows';
import { species, strike } from '../../src/sdk/species';
import * as ray from '../fixtures/species/signal-ray';
import * as strider from '../fixtures/species/signal-strider';
import * as skitter from '../fixtures/species/signal-skitterer';
import * as matriarch from '../fixtures/species/signal-matriarch';
import * as pine from '../fixtures/species/pine';
import * as sky from '../fixtures/species/sky';
import * as roc from '../fixtures/species/sky-roc';
import * as wisp from '../fixtures/species/sky-wisp';
import provenance from '../fixtures/species/provenance.json' with { type: 'json' };
import { SWOOP } from '../../src/shards/sunscar-dunes/runtime/species/duneRay';
import { CHARGE, HORNS } from '../../src/shards/sunscar-dunes/runtime/species/strider';
import { BITE } from '../../src/shards/sunscar-dunes/runtime/species/skitterer';
import { MAW, TAIL_SWEEP, BUFFET } from '../fixtures/species-oracle/matriarch';
import { DUNE_RAY, RAY } from '../../src/shards/sunscar-dunes/data/species/duneRay';
import { DUNE_STRIDER, STRIDE } from '../../src/shards/sunscar-dunes/data/species/strider';
import { SKITTERER_DATA, SKITTER } from '../../src/shards/sunscar-dunes/data/species/skitterer';
import { MATRIARCH_DATA, MATRIARCH, MATRIARCH_HP } from '../../src/shards/sunscar-dunes/data/species/matriarch';
import { PINE_LANES, PINE_STRIKES } from '../../src/shards/pine-hollow/combat/strikes';
import { RAM, DIVE } from '../../src/shards/far-reach/runtime/strikes';
import { STOOP, GALE_WALL, SWEEP } from '../../src/shards/far-reach/runtime/stormRocBrain';
import { BURST } from '../../src/shards/far-reach/species/galeWisp';

const tables = [
  { name: 'Signal', old: [ray.SWOOP, strider.CHARGE, strider.HORNS, skitter.BITE, matriarch.MAW, matriarch.TAIL_SWEEP, matriarch.BUFFET],
    current: [SWOOP, CHARGE, HORNS, BITE, MAW, TAIL_SWEEP, BUFFET] },
  { name: 'Pine', old: [...Object.values(pine.PINE_LANES), ...Object.values(pine.PINE_STRIKES)], current: [...Object.values(PINE_LANES), ...Object.values(PINE_STRIKES)] },
  { name: 'Sky', old: [sky.RAM, sky.DIVE, roc.STOOP, roc.GALE_WALL, roc.SWEEP, wisp.BURST], current: [RAM, DIVE, STOOP, GALE_WALL, SWEEP, BURST] },
];
const declaredWeight = (row: StrikeSpec): StrikeWeight => row.id === strider.CHARGE.id
  ? { kind: 'horizontal-distance', above: 5, near: 0.2, far: 2 }
  : { kind: 'constant', value: row.id === matriarch.TAIL_SWEEP.id ? 2 : 1 };
const dataOf = (row: StrikeSpec) => strike({ ...row, weight: declaredWeight(row), range: Number.isFinite(row.range) ? row.range : null });
function body(events: unknown[]): StrikeActor {
  return { position: { x: 0, y: 0, z: 0 }, alive: true, scale: 1, yaw: 0,
    startAttack: seconds => { events.push(['start', seconds]); }, cancelAttack: () => { events.push(['cancel']); },
    setMotion: (yaw, speed, turn) => { events.push(['motion', yaw, speed, turn]); } };
}
function context(actor: StrikeActor, events: unknown[], tick: number): StrikeContext {
  const edge = [5 - Number.EPSILON * 4, 5, 5 + Number.EPSILON * 4, 0, 1.4, 1.9, 3.2, 7, 11.5, 17, 30, 40][tick % 12] ?? 0;
  return { actor, target: { x: actor.position.x, y: actor.position.y + (tick % 7 === 0 ? 8 : 0), z: actor.position.z + edge },
    airborne: tick % 3 === 0, ringRadius: (tick % 8) * 0.25,
    canReach: () => tick % 11 !== 0, hit: row => { events.push(['hit', row.id, row.damage, row.tags]); } };
}

describe('SDK gameplay rows preserve shipping strike decisions', () => {
  it('pins exact declaration text captured from committed source, never a rewritten oracle', () => {
    expect(provenance.records).toHaveLength(8);
    for (const row of provenance.records) {
      const text = readFileSync(`test/fixtures/species/${row.fixture}`);
      expect(createHash('sha256').update(text).digest('hex')).toBe(row.fixtureHash);
      expect(row.sourceHash).toMatch(/^[a-f0-9]{64}$/u);
    }
  });
  it('moves every Signal tuning and species number unchanged', () => {
    expect([RAY, STRIDE, SKITTER, MATRIARCH, MATRIARCH_HP]).toEqual([ray.RAY, strider.STRIDE, skitter.SKITTER, matriarch.MATRIARCH, matriarch.MATRIARCH_HP]);
    expect([DUNE_RAY, DUNE_STRIDER, SKITTERER_DATA, MATRIARCH_DATA]).toEqual([ray.DUNE_RAY, strider.DUNE_STRIDER, skitter.SKITTERER_DATA, matriarch.MATRIARCH_DATA]);
  });
  it.each(tables)('$name: every table row and score stays bit-identical at boundaries', ({ old, current }) => {
    expect(current).toHaveLength(old.length);
    for (let i = 0; i < old.length; i++) {
      const before = old[i], after = current[i]; if (before === undefined || after === undefined) throw new Error('Missing table row');
      const { weight: _old, ...a } = before, { weight: _new, ...b } = after;
      expect(b).toEqual(a);
      const declared = strikeFromData(dataOf(after));
      for (let tick = 0; tick < 120; tick++) {
        const ctx = context(body([]), [], tick);
        expect(after.weight(ctx)).toBe(before.weight(ctx));
        expect(declared.weight(ctx)).toBe(before.weight(ctx));
      }
    }
  });
  it.each(tables)('$name: 10k real runner decisions, contacts and mid-strike restore stay exact', ({ old, current }) => {
    const declared = current.map(row => strikeFromData(dataOf(row)));
    const a = new StrikeRunner(), b = new StrikeRunner();
    const ae: unknown[] = [], be: unknown[] = [], aa = body(ae), ba = body(be);
    let starts = 0;
    for (let tick = 0; tick < 10000; tick++) {
      const ca = context(aa, ae, tick), cb = context(ba, be, tick);
      for (let row = 0; row < old.length; row++) {
        const os = old[row], ds = declared[row]; if (os === undefined || ds === undefined) throw new Error('Missing score');
        if (!Object.is(os.weight(ca), ds.weight(cb))) throw new Error(`Score changed at ${tick}/${row}`);
      }
      if (!a.busy) {
        const ap = a.pick(old, ca), bp = b.pick(declared, cb);
        if (ap?.id !== bp?.id) throw new Error(`Pick changed at ${tick}`);
        if (ap !== null && bp !== null) { a.start(ap, aa, ca.target); b.start(bp, ba, cb.target); starts++; }
      }
      const dt = tick % 5 === 0 ? 1 / 30 : 1 / 60;
      a.update(dt, ca); b.update(dt, cb);
      if (!isDeepStrictEqual(a.snapshot(), b.snapshot()) || !isDeepStrictEqual(ae, be)) throw new Error(`Continuation changed at ${tick}`);
      ae.length = 0; be.length = 0;
      if (tick === 5000) { const saved = a.snapshot(); b.restore(saved, declared); expect(be).toEqual([]); }
    }
    expect(starts).toBeGreaterThan(10);
  });
  it('strictly refuses functions, malformed weights, nonfinite values, unknown native callbacks and invalid shapes', () => {
    const base = dataOf(strider.CHARGE);
    for (const weight of [() => 1, { kind: 'constant', value: Number.NaN }, { kind: 'horizontal-distance', above: -1, far: 2, near: 1 }, { kind: 'constant', value: 1, extra: 2 }]) expect(() => strike({ ...base, weight })).toThrow();
    expect(() => strike({ ...base, shape: { kind: 'ring', inner: 4, outer: 1 } })).toThrow();
    expect(() => strike({ ...base, range: Infinity })).toThrow();
    expect(() => species({ ...DUNE_RAY, think: () => undefined })).toThrow();
    expect(() => species({ ...DUNE_RAY, variants: [{ ...DUNE_RAY.variants[0], scale: [2, 1] }] })).toThrow();
    expect(strikeWeight({ kind: 'constant', value: -0 }, context(body([]), [], 0))).toBe(-0);
    expect(strikeFromData({ ...base, range: null }).range).toBe(Infinity);
  });
});
