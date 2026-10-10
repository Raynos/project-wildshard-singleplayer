// oxlint-disable-next-line import/no-nodejs-modules -- Read the repository's layout contract.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { checkShardLayout, type ShardLayout } from '../scripts/check-shards.mjs';
import { SHARDS } from '../src/shards.generated';

const layout = JSON.parse(readFileSync('lint/shard-layout.json', 'utf8')) as ShardLayout;
it('accepts pure shardfile projects and still requires plugins for legacy projects', () => {
  expect(checkShardLayout({ example: ['shard.config.ts', 'README.md', 'assets/', 'behaviour/', 'quests/'] }, layout)).toEqual([]);
  expect(checkShardLayout({ example: ['manifest.ts', 'README.md', 'roster.ts', 'budgets.ts'] }, layout)).toContain('example: missing required plugin.ts');
});
it('gets all ten declared placements exclusively from the platform catalogue', () => {
  const grid = JSON.parse(readFileSync('src/game/grid/singleplayer.json', 'utf8')) as { placements: { slug: string; cell: number[]; size: number[]; instance: string }[] };
  expect(grid.placements).toHaveLength(10);
  for (const p of grid.placements) {
    expect(SHARDS.find((s) => s.slug === p.slug)?.placement).toEqual({ grid: p.cell, size: p.size, instance: p.instance });
    expect(readFileSync(`src/shards/${p.slug}/manifest.ts`, 'utf8')).not.toContain('placement:');
  }
});
