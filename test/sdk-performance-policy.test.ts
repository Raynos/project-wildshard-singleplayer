// oxlint-disable-next-line import/no-nodejs-modules -- Check canonical project provenance without modifying any shared source.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Author projects live outside the checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real legacy project and an outside author project.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { validateProject } from '@wildshard/sdk/project';
import { projectPerformancePolicy } from '../src/sdk/performancePolicy';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { validateShardfileAssets } from '../src/game/shardfile/validate';

it('warns only for canonical old-six checkout projects, never a borrowed slug or outside copy', () => {
  const shard = emptyShardfile({ slug: 'pine-hollow', name: 'Borrowed', author: 'Fixture', revision: 1, seed: 1 });
  const outside = mkdtempSync(join(tmpdir(), 'sf62-policy-'));
  try {
    expect(projectPerformancePolicy(undefined, shard)).toBe('refuse');
    expect(projectPerformancePolicy(outside, shard)).toBe('refuse');
    expect(projectPerformancePolicy(resolve('src/shards/pine-hollow'), shard)).toBe('warn');
    shard.budgets.library.compressed = CONTENT_CAPS.library.compressed + 1;
    expect(() => validateProject(shard, new Map(), outside)).toThrow('PERFORMANCE REPORT');
    expect(validateProject(shard, new Map(), resolve('src/shards/pine-hollow'))).toEqual(shard);
    shard.budgets.library.resident = 1_000_000_000;
    expect(validateProject(shard, new Map(), resolve('src/shards/pine-hollow'))).toEqual(shard);
    expect(() => validateShardfileAssets(shard, new Map(), () => '')).toThrow('total exceeds envelope');
    shard.identity.slug = 'new-shard';
    expect(projectPerformancePolicy(resolve('src/shards/pine-hollow'), shard)).toBe('refuse');
  } finally { rmSync(outside, { recursive: true, force: true }); }
});
