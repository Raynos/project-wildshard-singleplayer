// Explore World (project/archive/2026-09-23-explore-world.md): the parts that are pure data — a note's "go there" URL reopens the viewer
// on the same view (X6), and the shard's points of interest the mini map pins (X5).
import { describe, expect, it } from 'vitest';
import { reproUrl } from '#engine/ui/Feedback';
import { SHARDS, playable, findChunk } from '#game/shard/registry';
import { CHUNK_HALF } from '#engine/core/config';
import { registeredModels } from '#engine/explore/registry';
import { activeRegistry } from '#engine/world/registry';

const PLAYABLE_SHARDS = SHARDS.filter(playable);

describe('Explore World', () => {
  it('a note filed in the World Explorer reopens the same camera', () => {
    const url = new URL(reproUrl('https://w.test', { shard: 'driftwood-isle', explore: 'world', cam: [12.345, 30, -210.5, 0.5, -0.25], tier: 'phone' }));
    expect(url.searchParams.get('chunk')).toBe('driftwood-isle');
    expect(url.searchParams.get('explore')).toBe('world');
    expect(url.searchParams.get('cam')).toBe('12.35,30,-210.5,0.5,-0.25');
    expect(url.searchParams.has('at')).toBe(false);      // not the play-mode spot …
    expect(url.searchParams.has('skipintro')).toBe(false); // … and not straight into play
  });

  it('a note filed on the turntable reopens that model', () => {
    const url = new URL(reproUrl('https://w.test', { shard: 'driftwood-isle', explore: 'model', cam: [0, 5, 10, 0, 0], model: 'hut', view: 'facets' }));
    expect(url.searchParams.get('explore')).toBe('model');
    expect(url.searchParams.get('model')).toBe('hut');
  });

  it('a play-mode note still reopens play at the spot', () => {
    const url = new URL(reproUrl('https://w.test', { shard: 'driftwood-isle', pos: [1, 2, 3], yaw: 0, pitch: 0, weapon: 'sword' }));
    expect(url.searchParams.has('explore')).toBe(false);
    expect(url.searchParams.get('at')).toBe('1,2,3,0,0');
  });

  const EXPLORABLE = PLAYABLE_SHARDS.filter((m) => m.explore !== undefined).map((m) => m.slug);

  it.each(EXPLORABLE)("%s's points of interest are named, unique and inside the shard", (slug) => {
    const pois = findChunk(slug)?.pois ?? [];
    expect(pois.length).toBeGreaterThan(0);
    expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
    for (const p of pois) {
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(Math.abs(p.x), p.id).toBeLessThan(CHUNK_HALF);
      expect(Math.abs(p.z), p.id).toBeLessThan(CHUNK_HALF);
    }
  });

  it('only the explorable shards carry points of interest', () => {
    for (const c of PLAYABLE_SHARDS) if (!EXPLORABLE.includes(c.slug)) expect(c.pois ?? [], c.slug).toEqual([]);
  });

  it('explorer artwork is declared on the manifest', () => {
    for (const c of PLAYABLE_SHARDS) if (c.explore !== undefined) {
      for (const image of Object.values(c.explore)) expect(image, c.slug).toMatch(/\.(webp|jpe?g|png)$/);
    }
  });

  it('the model registry keeps one entry per id (a shard re-registering after a rebuild replaces it)', () => {
    const object = (): never => { throw new Error('not built in a test'); };
    const a = { id: 'model:test-a', name: 'A', category: 'nature' as const, file: 'x.ts', model: { id: 'test-a', category: 'nature' as const, live: true, object } };
    const before = registeredModels().length;
    activeRegistry().add(a); activeRegistry().add({ ...a, name: 'A2' });
    expect(registeredModels().length).toBe(before + 1);
    expect(registeredModels().find((m) => m.id === 'test-a')?.name).toBe('A2');
  });
});
