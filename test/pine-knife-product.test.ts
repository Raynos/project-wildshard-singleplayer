import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { paintedPrimitives } from '@wildshard/game/plugin/geometry';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { KNIFE_LOOK } from '../src/shards/pine-hollow/generators/knifeLook';
import playback from '../src/shards/pine-hollow/data/heldToolPlayback.json' with { type: 'json' };
import { SECTIONS } from '../src/shards/pine-hollow/runtime/sections';
import { knifeRows, prepareKnifeRows, KNIFE_MODEL_URL } from '../src/shards/pine-hollow/runtime/models/skinningKnife';

const shardfile = emptyShardfile({ slug: 'pine-knife-test', name: 'Knife', author: 'Wildshard', revision: 1, seed: 1 });
function product(value: unknown) {
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['custom/heldToolPlayback', value]]), files: new Map(),
    read: () => Promise.reject(new Error('Knife section must already be admitted')), check: true });
}

test('the admitted knife preserves the original recipe, playback and stand-in buffers', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow'), custom = loaded.output.custom;
  const section = custom?.sections.find(entry => entry.name === 'custom/heldToolPlayback');
  const bytes = section === undefined ? undefined : custom?.files.get(section.path);
  if (bytes === undefined) throw new Error('Pine has no held tool section');
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes)), admitted = product(value), row = knifeRows(admitted);
  const { url, ...recipe } = row;
  expect(url).toBe(KNIFE_MODEL_URL);
  // Canonical recipe frozen from 78059658f's KNIFE_LOOK.
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(recipe)))).toBe('a95fac917706d614fa16b64e3e267f95236c4834f9ed9becfa185c1695cfb405');
  expect(recipe).toEqual({ ...KNIFE_LOOK, playback: playback.pose });
  const actual = paintedPrimitives(row.parts), before = paintedPrimitives(KNIFE_LOOK.parts);
  for (const name of Object.keys(before.attributes)) expect(actual.getAttribute(name).array).toEqual(before.getAttribute(name).array);
  expect(actual.index).toEqual(before.index);
  actual.dispose(); before.dispose();
  const parsed = v.parse(SECTIONS['custom/heldToolPlayback'], value);
  for (const look of [undefined, { ...parsed.look, extra: true }, { ...parsed.look, loadDelayMs: -1 },
    { ...parsed.look, parts: [{ kind: 'box', args: [], paint: '#fff', ops: [['rotateX', 'bad']] }] }]) {
    expect(() => knifeRows(product({ ...parsed, look }))).toThrow();
  }
  const fetch = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(admitted);
  try {
    await prepareKnifeRows();
    expect(fetch).toHaveBeenCalledWith('pine-hollow');
  } finally { fetch.mockRestore(); }
}, 30000);
