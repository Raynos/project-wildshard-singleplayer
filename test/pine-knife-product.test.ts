import { expect, test } from 'vitest';
import * as v from 'valibot';
import { paintedPrimitives } from '@wildshard/game/plugin/geometry';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { KNIFE_LOOK } from '../src/shards/pine-hollow/generators/knifeLook';
import playback from '../src/shards/pine-hollow/data/heldToolPlayback.json' with { type: 'json' };
import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { heldToolRows } from '../src/game/plugin/heldTool';

test('the admitted knife preserves the original recipe, playback and stand-in buffers', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const catalogue = v.parse(HeldEquipmentSchema,outputPlatformPayloads(loaded.output.platform,['held/equipment']).get('held/equipment'));
  const value = catalogue.tool, row = heldToolRows(value);
  const { url, loadedLevel, loadSystemId, ...recipe } = row;
  expect(url).toBe('/assets/pine-hollow/weapons/skinning-knife.glb');
  expect([loadedLevel, loadSystemId]).toEqual(['pine-hollow', 'shard.pine.knife.load']);
  // Canonical recipe frozen from 78059658f's KNIFE_LOOK.
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(recipe)))).toBe('a95fac917706d614fa16b64e3e267f95236c4834f9ed9becfa185c1695cfb405');
  expect(recipe).toEqual({ ...KNIFE_LOOK, playback: playback.pose });
  const actual = paintedPrimitives(row.parts), before = paintedPrimitives(KNIFE_LOOK.parts);
  for (const name of Object.keys(before.attributes)) expect(actual.getAttribute(name).array).toEqual(before.getAttribute(name).array);
  expect(actual.index).toEqual(before.index);
  actual.dispose(); before.dispose();
  const parsed = v.parse(HeldEquipmentSchema.entries.tool,value);
  for (const look of [undefined, { ...parsed.look, extra: true }, { ...parsed.look, loadDelayMs: -1 },
    { ...parsed.look, parts: [{ kind: 'box', args: [], paint: '#fff', ops: [['rotateX', 'bad']] }] }]) {
    expect(() => heldToolRows({ ...parsed, look })).toThrow();
  }
}, 30000);
