// oxlint-disable-next-line import/no-nodejs-modules -- Pin the exact predecessor's metadata and double-precision coordinates.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import pine from '../src/shards/pine-hollow/data/layout.generated.json' with { type: 'json' };
import nine from '../src/shards/nine-dragon-stack/boot/metadata.generated.json' with { type: 'json' };
import { creekSurfaceAt } from '../src/shards/pine-hollow/behaviour/layout';

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

it('retains every Pine coordinate and discovery anchor from ac722f90c', () => {
  const fixed = Object.fromEntries(Object.entries(pine).filter(([name]) => name !== 'beaverPoolLevel'));
  expect(digest(fixed)).toBe('cd5c2991da80c6159aa96f2a0d5a324c9ff6fd8b82630aa3db0b6cf6c47b3277');
  expect(pine.SPURS['den']).toBe(pine.DEN_TRAIL);
  expect(pine.SPURS['lookout']).toBe(pine.LOOKOUT_TRAIL);
  expect(pine.GRADED.paths[0]).toBe(pine.LOOKOUT_TRAIL);
});

it('retains Nine fixed boot fields, including spawn, bounds and ordered pins', () => {
  expect(digest(nine.rows)).toBe('8e35e459c26e4ce2c46c2f68afa0bd1f8169f5412e79b153497eb31a4fe25219');
});

it('keeps the beaver pool level live after fixed layout data leaves runtime', () => {
  const initial = pine.beaverPoolLevel.y;
  try {
    pine.beaverPoolLevel.y = pine.BEAVER_POOL.full;
    expect(creekSurfaceAt(pine.BEAVER_POOL.centre)).toBe(pine.BEAVER_POOL.full);
    pine.beaverPoolLevel.y = pine.BEAVER_POOL.drained;
    expect(creekSurfaceAt(pine.BEAVER_POOL.centre)).toBeLessThan(pine.BEAVER_POOL.full);
    expect(pine.BEAVER_POOL.full).toBe(initial);
  } finally { pine.beaverPoolLevel.y = initial; }
});
