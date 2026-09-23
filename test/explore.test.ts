// Explore World (docs/plans/EXPLORE-WORLD.md): the parts that are pure data — a note's "go there" URL reopens the viewer
// on the same view (X6), and the shard's points of interest the mini map pins (X5).
import { describe, expect, it } from 'vitest';
import { reproUrl } from '../src/ui/Feedback';
import { CHUNKS, findChunk } from '../src/chunks/registry';
import { CHUNK_HALF } from '../src/core/config';

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

  it("Driftwood's points of interest are named, unique and inside the shard", () => {
    const pois = findChunk('driftwood-isle')?.pois ?? [];
    expect(pois.length).toBeGreaterThanOrEqual(6);
    expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
    for (const p of pois) {
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(Math.abs(p.x), p.id).toBeLessThan(CHUNK_HALF);
      expect(Math.abs(p.z), p.id).toBeLessThan(CHUNK_HALF);
    }
  });

  it('only Driftwood carries points of interest for now (D4: Explore is Driftwood-only)', () => {
    for (const c of CHUNKS) if (c.slug !== 'driftwood-isle') expect(c.pois ?? [], c.slug).toEqual([]);
  });
});
