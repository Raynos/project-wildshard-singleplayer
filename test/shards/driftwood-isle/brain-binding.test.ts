import { afterAll, expect, it } from 'vitest';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { DRIFTWOOD_SPECIES } from '../../../src/shards/driftwood-isle/species/install';
import { declaredCreatureRows } from '../../../src/shards/driftwood-isle/runtime/brains';
import { creature } from '../../fake/creature';

const restore = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restore);
it('keeps the unique captain native and replaces only the three declared ordinary policies', () => {
  const rows = declaredCreatureRows();
  for (const row of DRIFTWOOD_SPECIES) {
    const declared = rows.find(entry => entry.id === row.id);
    if (row.kind === 'captain') expect(declared).toBe(row);
    else { expect(declared?.think).not.toBe(row.think); expect(declared?.act).not.toBe(row.act); expect(declared?.variants).toEqual(row.variants); }
  }
});
it('the hybrid sailor rises, swings and sinks through the existing native recipes', () => {
  const row = declaredCreatureRows().find(entry => entry.kind === 'sailor');
  if (row?.think === undefined || row.act === undefined) throw new Error('Missing guardian binding');
  const f = creature('sailor', 'sailor', {}, undefined, row.think, row.act); f.advance(230);
  expect(f.states.slice(0, 4)).toEqual(['rise', 'stalk', 'attack', 'stalk']);
  expect(f.hits.map(hit => hit.damage)).toContain(14);
  f.ctx.player.z = 30; f.advance(480); expect(f.states.at(-1)).toBe('hide');
});
it('the hybrid ground monkey preserves bite contact and finite native fallback motion', () => {
  const row = declaredCreatureRows().find(entry => entry.kind === 'monkey');
  if (row?.think === undefined || row.act === undefined) throw new Error('Missing perch binding');
  const f = creature('monkey', 'monkey', {}, undefined, row.think, row.act); f.advance(240);
  expect(f.hits.length).toBeGreaterThan(0);
  f.ctx.player.z = 50; f.advance(1000); expect(f.states.at(-1)).toBe('idle');
  expect([...f.animal.position, f.animal.yaw].every(Number.isFinite)).toBe(true);
});
