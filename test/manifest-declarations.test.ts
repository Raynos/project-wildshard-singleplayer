import { expect, it } from 'vitest';
import nalati from '../src/shards/nalati-grasslands/manifest';
import nine from '../src/shards/nine-dragon-stack/manifest';
import expected from './fixtures/manifest-declarations.json' with { type: 'json' };
import type { ShardManifest } from '@wildshard/game/shard/manifest';

/** Snapshot the predecessor's declarations, including ordered download art,
 * without serializing native query/callback owners or variable boot products. */
function fixedDeclarations(manifest: ShardManifest): unknown {
  const { ground: _ground, dev: _dev, trustedRuntime: _runtime, navigation: _navigation, ...fixed } = manifest;
  const { palette: _palette, ...minimap } = fixed.minimap ?? {};
  const { files: _files, sources: _sources, steps: _steps, lateReads: _late, ...boot } = fixed.boot ?? {};
  return JSON.parse(JSON.stringify({ ...fixed, minimap, boot }, (_key, value: unknown) => {
    if (typeof value === 'function') return undefined;
    return value === Infinity ? 'Infinity' : value;
  }));
}

it('retains Nalati discovery, forest, budgets and ordered art from 230be1ccc', () => {
  expect(fixedDeclarations(nalati)).toEqual(expected['nalati-grasslands']);
});

it('retains Nine discovery, forest, budgets and ordered art from 230be1ccc', () => {
  expect(fixedDeclarations(nine)).toEqual(expected['nine-dragon-stack']);
});

it('keeps the four native camera poses and unbounded Nine attacker allocation', async () => {
  expect(nine.fight?.attackers).toBe(Infinity);
  expect(Object.keys(await nine.dev?.poses() ?? {})).toEqual(['A', 'B', 'C', 'D']);
});

it('keeps Nalati camera eyes bound to the installed terrain owner', async () => {
  const original = nalati.ground, terrain = original.terrain;
  if (terrain === undefined) throw new Error('Nalati has no native terrain');
  try {
    nalati.ground = { ...original, terrain: { ...terrain, heightAt: () => 25 } };
    const camp = (await nalati.dev?.poses())?.['camp'];
    expect(camp?.eye).toEqual([60, 26.68, 214]);
  } finally { nalati.ground = original; }
});
