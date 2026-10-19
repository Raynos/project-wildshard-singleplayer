// oxlint-disable-next-line import/no-nodejs-modules -- Exact pre-bake constructor fingerprints are fixture evidence.
import { createHash } from 'node:crypto';
import { BufferGeometryLoader, type BufferGeometry } from 'three';
import { expect, it } from 'vitest';
import fight from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with { type: 'json' };
import { titanGeometry, titanBodyRows, titanPoseRows, titanArenaRows, titanFightPoseRows } from '../src/shards/nalati-grasslands/generators/stormTitanGeometry';
import * as authored from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import baseline from './fixtures/nalati-storm-titan.json' with { type: 'json' };

const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const numericHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => typeof item === 'number' ? Math.round(item * 1e9) / 1e9 : item)).digest('hex');
function fingerprint(g: BufferGeometry): string {
  const attributes = Object.fromEntries(Object.entries(g.attributes).map(([key, a]) => [key, {
    type: a.array.constructor.name, itemSize: a.itemSize, normalized: a.normalized, array: [...a.array],
  }]));
  return hash({ attributes, index: g.index === null ? null : { type: g.index.array.constructor.name, array: [...g.index.array] } });
}

it('retains every encounter, phase, reward and attack number', () => {
  expect(fight).toEqual({ ...authored });
  expect(fight.TITAN_ENCOUNTER.id).toBe('storm-titan');
  expect(fight.TITAN_PHASES.map(row => row.at)).toEqual([1, 0.6, 0.3]);
});

it('rebuilds the same numeric JSON without serialization UUIDs', () => {
  expect(numericHash({ ...titanGeometry(), body: titanBodyRows(), poses: [...titanPoseRows(), ...titanFightPoseRows()], arena: titanArenaRows(fight.TITAN_PLACE.arenaRadius,fight.TITAN_TUNING.cell,fight.TITAN_ARENA.grid) })).toBe(numericHash(geometry));
});

for (const tier of ['phone', 'desktop'] as const) it(`${tier}: preserves the original puff and mesh buffers`, () => {
  // Captured from 53d372727's unmodified constructors, before the bake replaced them.
  const rows = geometry[tier], expected = baseline[tier], loader = new BufferGeometryLoader();
  expect(rows.puffs).toHaveLength(expected.puffCount);
  // Preserve the original authored positions/phases to 1e-9; native libm
  // differs in lower float64 bits across the Mac and Linux CI.
  expect(numericHash(rows.puffs)).toBe(expected.puffsNanometres);
  const flames = loader.parse(rows.flames), eyes = loader.parse(geometry.eyes);
  try {
    expect(fingerprint(flames)).toBe(expected.flames);
    expect(fingerprint(eyes)).toBe(expected.eyes);
  } finally { flames.dispose(); eyes.dispose(); }
});
