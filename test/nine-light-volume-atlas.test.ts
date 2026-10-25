import { expect, test } from 'vitest';
import { layout } from './fixtures/nine-product-inputs';
import before from './fixtures/nine-admitted-output.json' with { type: 'json' };
import rawAtlas from '../public/assets/nine-dragon/authored/sign-atlas/signAtlas.json' with { type: 'json' };
import { parseNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/sections';
import { lightVolumeBlobs, lightVolumeRows, volumeSources } from '../src/shards/nine-dragon-stack/generators/lightVolumes';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('native inputs retain every original compressed volume byte and admitted cost', () => {
  const atlas = parseNativeSignAtlas(rawAtlas), blobs = lightVolumeBlobs(layout, atlas);
  expect(blobs.map(blob => ({ file: blob.file, bytes: blob.bytes.byteLength, hash: hashImmutableBytes(blob.bytes) })))
    .toEqual(before.blobs.filter(blob => blob.file.name.startsWith('looks/volumes-')));
  expect(Object.keys(lightVolumeRows(layout, atlas))).toHaveLength(8);
});

test.each(['phone', 'desktop'] as const)('the %s volume consumes supplied readonly native lamps', tier => {
  const atlas = parseNativeSignAtlas(rawAtlas), light = { at: [0, 130, 0], color: [.2, .4, .6], w: 6, h: 7, power: 8, spill: 9 };
  const supplied = { ...atlas, [tier]: { ...atlas[tier], placed: [], lights: [light] } };
  const original = volumeSources(tier, false, layout, atlas), changed = volumeSources(tier, false, layout, supplied);
  expect(changed.signs).toHaveLength(1);
  const lamp = changed.signs[0]; if (lamp === undefined) throw new Error('Missing supplied native lamp');
  expect(lamp.at.toArray()).toEqual(light.at);
  expect(lamp.color.toArray()).toEqual(light.color);
  expect({ w: lamp.w, h: lamp.h, power: lamp.power, spill: lamp.spill }).toEqual({ w: 6, h: 7, power: 8, spill: 9 });
  expect(changed.lanterns).toEqual(original.lanterns);
  expect(changed.ctxEmitters).toEqual(original.ctxEmitters);
  expect(changed.windows).toEqual(original.windows);
});

test('volume hits reuse equivalent native rows and invalidate an in-place lamp edit', () => {
  const atlas = parseNativeSignAtlas(rawAtlas), original = lightVolumeBlobs(layout, atlas);
  expect(lightVolumeBlobs(layout, structuredClone(atlas))).toBe(original);
  const lamp = { at: [0, 130, 0], color: [1, 0, 0], w: 3, h: 3, power: 1, spill: 1 };
  const supplied = { ...atlas, phone: { ...atlas.phone, lights: [...atlas.phone.lights, lamp] } };
  const added = lightVolumeBlobs(layout, supplied);
  expect(added.map(blob => blob.file.hash)).not.toEqual(original.map(blob => blob.file.hash));
  expect(lightVolumeBlobs(layout, supplied)).toBe(added);
  const addedRows = lightVolumeRows(layout, supplied);
  lamp.at[0] = 70;
  const moved = lightVolumeBlobs(layout, supplied);
  expect(moved.map(blob => blob.file.hash)).not.toEqual(added.map(blob => blob.file.hash));
  expect(lightVolumeRows(layout, supplied)).not.toBe(addedRows);
  expect(lightVolumeBlobs(layout, structuredClone(supplied))).toBe(moved);
});
