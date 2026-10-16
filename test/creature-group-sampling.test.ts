import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { sampleCreatureGroup, type CreatureGroupSpec } from '../src/game/plugin/brain';

test('group sampling keeps source order, accepted variants and borrowed joins, refusing before draws', () => {
  const rng = new Rng(357), events: string[] = [];
  const row: CreatureGroupSpec<'hunter'> = { kind: 'hunter', count: 3, herd: 2, variant: 'small', firstVariant: 'big',
    source: { kind: 'radial', centre: { x: 5, z: 9 }, radius: [1, 3], firstAtCentre: true } };
  const accepted = sampleCreatureGroup(row, rng, (_x, _z, index) => { events.push(`accept:${index}`); return index !== 1; }, sample => { events.push(`join:${sample.variant}`); rng.next(); });
  expect(accepted[0]).toMatchObject({ kind: 'hunter', variant: 'big', herd: 2, x: 5, z: 9 });
  expect(accepted.every(sample => Number.isFinite(sample.yaw) && sample.herd === row.herd)).toBe(true);
  expect(events).toEqual(['accept:0', 'join:big', 'accept:1', 'accept:2', 'join:small']);
  const points = [{ x: 7, z: -2 }, { x: 4, z: 8 }];
  const indexed = sampleCreatureGroup({ ...row, count: 2, variants: ['elder', null], source: { kind: 'indexed', points }, yaw: 0 }, rng);
  expect(indexed.map(sample => ({ x: sample.x, z: sample.z }))).toEqual(points);
  expect(indexed.map(sample => sample.variant)).toEqual(['elder', null]);
  const saved = rng.snapshot(), before = [...events];
  const joined = () => { events.push('invalid join'); };
  expect(() => sampleCreatureGroup({ ...row, count: 17 }, rng, undefined, joined)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, source: { kind: 'indexed', points: [] } }, rng, undefined, joined)).toThrow('group');
  expect(() => sampleCreatureGroup({ ...row, source: { kind: 'radial', centre: { x: 0, z: 0 }, radius: [4, 1] } }, rng, undefined, joined)).toThrow('group');
  expect(rng.snapshot()).toEqual(saved); expect(events).toEqual(before);
  const fallback = sampleCreatureGroup({ ...row, count: 1, source: { kind: 'radial', centre: points[0] ?? { x: 0, z: 0 }, radius: [0, 4], radiusLaw: 'area', attempts: 2, fallback: 'centre' } }, rng, () => false);
  expect(fallback[0]).toMatchObject(points[0] ?? {});
});
