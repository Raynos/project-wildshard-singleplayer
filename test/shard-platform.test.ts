// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed baseline list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkShares, shardLines, type ShardPlatformList } from '../scripts/shard-platform.mjs';

// SHARD-PLATFORM SP5: the 80/20 metric (docs/plans/SHARD-PLATFORM.md §1).
const recorded = JSON.parse(readFileSync('lint/shard-platform.json', 'utf8')) as ShardPlatformList;

describe('SP5 the custom share', () => {
  it('holds every enforced ceiling and names only shards that exist', () => {
    expect(checkShares(recorded, shardLines())).toEqual([]);
  });
  it('counts generators/ and data/ on the data side and everything else as runtime', () => {
    const lines = { alpha: { generators: 70, data: 10, runtime: 20 } };
    expect(checkShares({ baseline: { alpha: 100 }, enforced: { alpha: 20 } }, lines)).toEqual([]);
    expect(checkShares({ baseline: { alpha: 100 }, enforced: { alpha: 19 } }, lines)[0]).toContain('ceiling 19');
    expect(checkShares({ baseline: { gone: 1 }, enforced: {} }, lines)[0]).toContain("doesn't exist");
  });
});
