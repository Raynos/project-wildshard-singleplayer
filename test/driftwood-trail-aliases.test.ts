import { expect, test } from 'vitest';
import { TRAIL_SPECIMENS, trailSpecimensFrom } from '../src/shards/driftwood-isle/generators/trailSpecimens';
import { trailSpecimenBank } from '../src/shards/driftwood-isle/generators/trailsideModels';
import { NATIVE_VIEW } from '../src/shards/driftwood-isle/generators/nativeView';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/driftwood-trail-aliases-original.json' with { type: 'json' };

test('owned trail aliases retain original order, metadata and every payload hash', () => {
  expect(TRAIL_SPECIMENS).toEqual(original);
  expect(Object.keys(TRAIL_SPECIMENS)).toEqual(Object.keys(original));
  expect(NATIVE_VIEW.TRAIL_SPECIMENS).toEqual(original);
  const bank = trailSpecimenBank();
  for (const url of Object.values(TRAIL_SPECIMENS)) {
    const name = bank.byUrl[url]; if (name === undefined) throw new Error('Missing owned trail alias');
    const bytes = bank.glbs.get(name); if (bytes === undefined) throw new Error('Missing owned trail bytes');
    expect(url.endsWith(`/trail-${hashImmutableBytes(bytes)}.glb`)).toBe(true);
  }
});

test('trail aliases refuse missing or ambiguous owned content', () => {
  const url = TRAIL_SPECIMENS.fencePost, aliases = { ...trailSpecimenBank().byUrl }, name = aliases[url];
  if (name === undefined) throw new Error('Missing original alias control');
  delete aliases[url]; expect(() => trailSpecimensFrom(aliases)).toThrow('requires one owned alias');
  aliases[url] = name; aliases[`/duplicate${url}`] = name;
  expect(() => trailSpecimensFrom(aliases)).toThrow('requires one owned alias');
});
