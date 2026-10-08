import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ShardManifest } from '../../src/game/shard/manifest';
import { SHARDS } from '../../src/shards.generated';
import { toLevelSpec } from '../../src/game/shard/spec';

describe('node-safe manifest to engine level boundary', () => {
  it.each(SHARDS)('copies $slug engine data without title metadata or game policy', (manifest) => {
    const level = toLevelSpec(manifest);
    expect(level.seed).toBe(manifest.seed); expect(level.treeCount).toBe(manifest.treeCount); expect(level.label).toBe(manifest.label);
    expect(level.id).toBe(manifest.slug); expect(level.spawn).toEqual(manifest.spawn);
    expect(level.sky).toEqual(manifest.sky); expect(level.atmosphere).toEqual(manifest.atmosphere); expect(level.grade).toEqual(manifest.grade);
    expect(level.horizon).toBe(manifest.horizon); expect(level.boundary).toBe(manifest.boundary);
    expect(level.ground.terrain).toBe(manifest.ground.terrain);
    expect(level.ground.structures).toBe(manifest.ground.structures === undefined ? undefined : true);
    for (const key of ['slug', 'name', 'blurb', 'card', 'status', 'order', 'bag', 'assetGlobs', 'ktx2', 'load']) expect(level).not.toHaveProperty(key);
  });
  it('filters game mechanisms and copies normalized loadout, audio, boot and tier data', () => {
    const first = SHARDS[0]; if (first === undefined) throw new Error('No manifests');
    const manifest = { ...first, uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'] as const, kitLook: 'toon' as const,
      boot: { files: () => ['/fixture.bin'], barrier: true }, audio: { ambience: 'fixture.ambience', score: 'fixture.score' },
      loadout: { weapons: ['fixture.weapon'], tools: [], start: ['fixture.weapon'] }, tiers: { phone: { ao: false } } };
    const level = toLevelSpec(manifest);
    expect(level.mechanisms).toEqual(['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice']); expect(level.boot).toBe(manifest.boot); expect(level.loadout).toBe(manifest.loadout);
    expect(level.audio).toBe(manifest.audio); expect(level.tiers).toBe(manifest.tiers); expect(level.kitLook).toBe('toon');
  });
});

it('rejects retired manifest compatibility tags', () => {
  type Mechanism = NonNullable<ShardManifest['uses']>[number];
  expectTypeOf<Extract<Mechanism, 'pack' | 'water' | 'creatures'>>().toEqualTypeOf<never>();
});
