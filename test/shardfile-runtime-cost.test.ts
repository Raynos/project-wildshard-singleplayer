import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { CONTENT_CAPS } from '../src/engine/core/config';

const source = () => emptyShardfile({ slug: 'runtime-cost', name: 'Runtime cost', author: 'Fixture', seed: 1, revision: 1 });
const cost = { webContentMB: 613, glMB: 272, engineBaseMB: 299, rev: '91f97bdfc', device: 'iOS Simulator Safari', evidence: 'progress/memory/sf22a-2026-10-04.json' };

it('round trips the provenance and derives the opaque runtime bound exactly once', () => {
  const parsed = parseShardfile({ ...source(), runtime: { entry: 'runtime/index.ts', cost } });
  expect(parsed.runtime?.cost).toEqual(cost);
  expect(runtimeAccountedBytes(parsed.runtime?.cost)).toBe(Math.ceil(586_000_000 / CONTENT_CAPS.residentFactor));
  expect(parsed.runtime).not.toHaveProperty('bytes');
});

it('keeps runtime cost optional for inactive transitions and refuses a data-only measured-total slot', () => {
  expect(parseShardfile({ ...source(), runtime: { entry: 'runtime/index.ts' } }).runtime).toEqual({ entry: 'runtime/index.ts' });
  expect(() => parseShardfile({ ...source(), cost })).toThrow();
});

it('refuses invalid measurements and missing provenance during ordinary shardfile admission', () => {
  for (const row of [
    { ...cost, rev: 'unknown' }, { ...cost, evidence: '' }, { ...cost, device: '' },
    { ...cost, glMB: -1 }, { ...cost, engineBaseMB: 885 },
    { ...cost, webContentMB: Number.MAX_VALUE }, { ...cost, gpuProcessMB: 255 },
  ]) expect(() => parseShardfile({ ...source(), runtime: { entry: 'runtime/index.ts', cost: row } })).toThrow();
});
