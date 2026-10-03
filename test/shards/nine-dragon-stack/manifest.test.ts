import { afterEach, describe, expect, it } from 'vitest';
import { toLevelSpec } from '#game';
import { SHARDS } from '../../../src/shards.generated';
import { playable } from '#game/shard/registry';
import { PUBLIC_BYTES } from '#game/boot/bytes.generated';
import { PACKS } from '#game/boot/packs.generated';
import { gpuUrl } from '#engine/boot/bytes';
import { chunkFiles } from '#engine/boot/manifest';
import { initializeTier, TIER } from '#engine/core/tier';
import manifest from '#shards/nine-dragon-stack/manifest';

const originalTier = TIER;
afterEach(() => { initializeTier(originalTier); });

describe('Nine Dragon full shard manifest', () => {
  it.each(['phone', 'desktop'] as const)('declares byte-counted %s files and a complete world pack', (tier) => {
    initializeTier(tier);
    const files = manifest.boot?.files(tier);
    if (files === undefined) throw new Error('Nine Dragon must declare its boot');
    expect(files.length).toBeGreaterThan(0);
    expect(new Set(files).size).toBe(files.length);
    const bytes: Readonly<Record<string, number>> = PUBLIC_BYTES;
    for (const file of files) expect(bytes[file], file).toBeGreaterThan(0);
    const pack = PACKS[manifest.slug]?.[tier];
    expect(pack).toBeDefined();
    expect(chunkFiles(manifest, 'img').trees).toEqual([]);
    expect(pack?.files.map(([url]) => url).sort()).toEqual(files.map((url) => gpuUrl(url, 'img')).sort());
  });
  it('discovers the experimental shard and projects only engine data', () => {
    expect(SHARDS.filter(playable)).toContain(manifest);
    const level = toLevelSpec(manifest);
    expect(level.ground.structures).toBe(true);
    expect(level.mechanisms).toEqual(['hover', 'explore', 'practice']);
    expect(level.loadout).toMatchObject({ weapons: ['weapon.jian'], tools: ['tool.fei-zhua', 'tool.hoverboard'], start: ['weapon.jian', 'tool.hoverboard'] });
    expect(manifest.bag).toEqual({ tabs: ['map', 'gear'], pack: { slots: 0 } });
    expect(level.species).toEqual([]);
    expect(level.spawns).toEqual([]);
    expect(level.fight.attackers).toBe(Infinity);
    expect(level.explore?.compare?.map((target) => target.id)).toEqual(['gate', 'stair']);
    expect(level).not.toHaveProperty('bag');
    expect(level).not.toHaveProperty('dev');
  });
});
