import { expect, it } from 'vitest';
import { NALATI_GRASSLANDS as def } from '#shards/nalati-grasslands/manifest';
import { bootSources, bootFiles } from '#shards/nalati-grasslands/boot/files';
import { BOOT_STEPS } from '#shards/nalati-grasslands/boot/steps';
import { GPU_FILES } from '#shards/nalati-grasslands/ktx2.generated';
import { filePolicy } from '#engine/data';
import before from './manifest-before.json';

it.each(['phone', 'desktop'] as const)('preserves frozen %s image and KTX2 boot lists', (tier) => {
  for (const tex of ['img', 'ktx2'] as const) { const frozen = before.sources[tier][tex], gpu = filePolicy(tier, tex, GPU_FILES).gpu; expect(bootSources(tier, tex)).toEqual({ ...frozen, props: frozen.props.map(gpu) }); }
  expect(bootFiles(tier)).toEqual(Object.values(before.sources[tier].img).flat());
});
it('preserves authored data and all loading labels and weights', () => {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Serialization deliberately omits functions from the frozen manifest data.
  const actual = JSON.parse(JSON.stringify(def)) as Record<string, unknown>;
  const old = before.data as Record<string, unknown>;
  for (const [key, value] of Object.entries(old)) {
    if (key === 'weapon') { expect(actual[key]).toBe('custom'); continue; }
    if (key === 'uses' || key === 'trees' || key === 'ground') continue;
    expect(actual[key], key).toEqual(value);
  }
  expect({ ...def.trees, factory: 'spruce' }).toEqual(before.data.trees);
  for (const [key, value] of Object.entries(BOOT_STEPS)) expect(value).toEqual(before.steps[key as keyof typeof before.steps]);
});
it('preserves terrain, forest masks, ground colours and surface masks across 441 samples', () => {
  const t = def.ground.terrain;
  if (t === undefined) throw new Error('Missing terrain');
  for (const sample of before.samples) {
    const { x, z } = sample, h = t.heightAt(x, z), normal = t.normalAt(x, z), slope = 1 - normal[1];
    expect({ x, z, h, normal, splat: t.splatAt(x, z), forest: def.forest?.mask?.(x, z), ground: def.groundColor?.(x, z, h, slope, t, [0, 0, 0]), surface: def.surfaceAt?.(x, z, h, slope) }).toEqual(sample);
  }
});
