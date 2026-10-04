import { expect, it } from 'vitest';
import { NALATI_GRASSLANDS as def } from '../../../src/shards/nalati-grasslands/manifest';
import { bootSources, bootFiles } from '../../../src/shards/nalati-grasslands/boot/files';
import { BOOT_STEPS } from '../../../src/shards/nalati-grasslands/boot/steps';
import { GPU_FILES } from '../../../src/shards/nalati-grasslands/ktx2.generated';
import { filePolicy } from '@wildshard/engine/data';
import before from './manifest-before.json';
import { COMPARE } from '../../../src/shards/nalati-grasslands/explore/compare';

it.each(['phone', 'desktop'] as const)('preserves frozen %s image and KTX2 boot lists', (tier) => {
  for (const tex of ['img', 'ktx2'] as const) { const frozen = before.sources[tier][tex], gpu = filePolicy(tier, tex, GPU_FILES).gpu; expect(bootSources(tier, tex)).toEqual({ ...frozen, props: frozen.props.map(gpu) }); }
  expect(bootFiles(tier)).toEqual(Object.values(before.sources[tier].img).flat());
});
it('preserves authored data and all loading labels and weights', () => {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Serialization deliberately omits functions from the frozen manifest data.
  const actual = JSON.parse(JSON.stringify(def)) as Record<string, unknown>;
  const old = before.data as Record<string, unknown>;
  for (const [key, value] of Object.entries(old)) {
    if (key === 'explore') { expect(actual[key]).toEqual({ art: value, compare: COMPARE }); continue; }
    if (key === 'weapon') { expect(actual[key]).toBe('custom'); continue; }
    if (key === 'uses' || key === 'trees' || key === 'ground') continue;
    expect(actual[key], key).toEqual(value);
  }
  expect({ ...def.trees, factory: 'spruce' }).toEqual(before.data.trees);
  for (const [key, value] of Object.entries(BOOT_STEPS)) expect(value).toEqual(before.steps[key as keyof typeof before.steps]);
});
/** deep equality with numbers within 1e-9 relative: CI's Linux libm and macOS differ in the last digit (e.g. 0.0024250667876447455 vs …645481) */
function expectNear(actual: unknown, expected: unknown, at: string): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(Math.abs(actual - expected), at).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
  } else if (Array.isArray(expected) && Array.isArray(actual)) {
    expect(actual.length, at).toBe(expected.length);
    expected.forEach((e, i) => { expectNear(actual[i], e, `${at}[${i}]`); });
  } else if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    expect(Object.keys(actual).sort(), at).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) expectNear((actual as Record<string, unknown>)[k], e, `${at}.${k}`);
  } else {
    expect(actual, at).toEqual(expected);
  }
}
it('preserves terrain, forest masks, ground colours and surface masks across 441 samples', () => {
  const t = def.ground.terrain;
  if (t === undefined) throw new Error('Missing terrain');
  for (const sample of before.samples) {
    const { x, z } = sample, h = t.heightAt(x, z), normal = t.normalAt(x, z), slope = 1 - normal[1];
    expectNear({ x, z, h, normal, splat: t.splatAt(x, z), forest: def.forest?.mask?.(x, z), ground: def.groundColor?.(x, z, h, slope, t, [0, 0, 0]), surface: def.surfaceAt?.(x, z, h, slope) }, sample, `${x},${z}`);
  }
});
