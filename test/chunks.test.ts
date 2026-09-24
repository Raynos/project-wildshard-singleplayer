// src/chunks/* — every authored shard satisfies the ChunkDef contract and the Wildshard fundamentals
// (500 m square, four entry roads level with no-man's-land at the edge midpoints), and the registry switches cleanly.
import { describe, expect, it, vi } from 'vitest';
import { loadSpecies } from './species';
import type { ChunkDef } from '../src/chunks/ChunkDef';
import { CHUNKS, DEFAULT_CHUNK, chunkSlugFromUrl, chunkUrl, findChunk, getActiveChunk, onActiveChunkChange, setActiveChunk } from '../src/chunks/registry';
import { landscapeHash } from '../src/chunks/terrain';
import { hasSpecies, speciesDef } from '../src/entities/species/registry';
import * as config from '../src/core/config';

const { CHUNK_HALF } = config;
loadSpecies();
const finite = (xs: readonly number[]): boolean => xs.every(Number.isFinite);
const EDGE_MIDPOINTS: [number, number][] = [[0, -CHUNK_HALF], [0, CHUNK_HALF], [-CHUNK_HALF, 0], [CHUNK_HALF, 0]];

describe('chunk registry data', () => {
  it('ids and slugs are unique and ids follow chunk://local/<slug>', () => {
    expect(new Set(CHUNKS.map((c) => c.slug)).size).toBe(CHUNKS.length);
    expect(new Set(CHUNKS.map((c) => c.id)).size).toBe(CHUNKS.length);
    for (const c of CHUNKS) {
      expect(c.id).toBe(`chunk://local/${c.slug}`);
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
    }
    expect(findChunk(DEFAULT_CHUNK)).toBeDefined();
  });

  it('seeds are distinct integers and picker fields are filled', () => {
    expect(new Set(CHUNKS.map((c) => c.seed)).size).toBe(CHUNKS.length);
    for (const c of CHUNKS) {
      expect(Number.isInteger(c.seed), c.slug).toBe(true);
      expect(c.treeCount, c.slug).toBeGreaterThanOrEqual(0);
      for (const s of [c.displayName, c.gridCoords, c.biome, c.blurb, c.thumbnail, c.heroPortrait, c.heroLandscape]) expect(s.length, c.slug).toBeGreaterThan(0);
    }
  });

  it('the spawn is inside the chunk, and on dry ground unless the shard is open water (Driftwood spawns on the pier deck)', () => {
    for (const c of CHUNKS) {
      expect(Math.abs(c.spawn.x), c.slug).toBeLessThan(CHUNK_HALF);
      expect(Math.abs(c.spawn.z), c.slug).toBeLessThan(CHUNK_HALF);
      if (!c.ocean) expect(c.terrain.heightAt(c.spawn.x, c.spawn.z), c.slug).toBeGreaterThan(c.terrain.waterLevel());
    }
  });

  it('every herd names a registered species, real variants, a positive count, a sane trail band and an in-chunk anchor', () => {
    for (const c of CHUNKS) {
      // Nalati's wolves / horses / sheep are placed by Wildlife (src/entities/Wildlife.ts), not by `fauna`
      if (c.slug !== 'nalati-grasslands') expect(c.fauna.length, c.slug).toBeGreaterThan(0);
      for (const h of c.fauna) {
        const at = `${c.slug}: ${h.kind}`;
        expect(hasSpecies(h.kind), at).toBe(true);
        expect(h.count, at).toBeGreaterThan(0);
        expect(h.trailBand[0], at).toBeLessThanOrEqual(h.trailBand[1]);
        const ids = speciesDef(h.kind).variants.map((v) => v.id);
        for (const v of h.variants ?? []) expect(ids, at).toContain(v);
        if (h.anchor) {
          expect(Math.abs(h.anchor.x), at).toBeLessThan(CHUNK_HALF);
          expect(Math.abs(h.anchor.z), at).toBeLessThan(CHUNK_HALF);
          expect(h.anchor.rMin, at).toBeLessThanOrEqual(h.anchor.rMax);
        }
      }
    }
  });

  it('look numbers (sky, fog, grade) are finite', () => {
    for (const c of CHUNKS) {
      const { sky, atmosphere: a, grade: g } = c;
      expect(finite([sky.sunIntensity, sky.envIntensity, sky.bgIntensity, sky.hemiIntensity, ...sky.sunColor]), c.slug).toBe(true);
      expect(finite([a.fogHeight, a.fogHeightFalloff, a.fogHeightDensity, a.fogDistDensity]), c.slug).toBe(true);
      expect(finite([g.saturation, g.brightness, g.contrast, g.gamma, ...g.lift, ...g.gain]), c.slug).toBe(true);
    }
  });
});

describe('chunk terrain', () => {
  it('the four entry roads meet no-man\'s-land at y = 0 on the edge midpoints', () => {
    for (const c of CHUNKS) for (const [x, z] of EDGE_MIDPOINTS) expect(c.terrain.heightAt(x, z), `${c.slug} @ ${x},${z}`).toBeCloseTo(0, 6);
  });

  it('the first four trails start at the edge midpoints (the mandated entry roads)', () => {
    for (const c of CHUNKS) {
      expect(c.terrain.trails.length, c.slug).toBeGreaterThanOrEqual(4);
      const starts = c.terrain.trails.slice(0, 4).map((t) => t[0]);
      for (const m of EDGE_MIDPOINTS) expect(starts, c.slug).toContainEqual(m);
    }
  });

  it('height, normals and splat weights are finite and well-formed across the chunk', () => {
    for (const c of CHUNKS) {
      const t = c.terrain;
      for (let x = -CHUNK_HALF; x <= CHUNK_HALF; x += 50) for (let z = -CHUNK_HALF; z <= CHUNK_HALF; z += 50) {
        const at = `${c.slug} @ ${x},${z}`;
        const h = t.heightAt(x, z);
        expect(Number.isFinite(h), at).toBe(true);
        expect(h, at).toBeGreaterThan(-60);
        // Nalati layout v2's snow ring (docs/design/nalati/layout-v2.md): the Crags and the west massif peak at +90 … +127
        expect(h, at).toBeLessThan(135);
        const [nx, ny, nz] = t.normalAt(x, z);
        expect(Math.hypot(nx, ny, nz), at).toBeCloseTo(1, 6);
        expect(ny, at).toBeGreaterThan(0);
        const w = t.splatAt(x, z);
        for (const v of w) expect(v, at).toBeGreaterThanOrEqual(0);
        expect(w[0] + w[1] + w[2] + w[3], at).toBeCloseTo(1, 6);
        for (const m of [t.cabinMask(x, z), t.pondMask(x, z)]) { expect(m, at).toBeGreaterThanOrEqual(0); expect(m, at).toBeLessThanOrEqual(1); }
      }
    }
  });

  it('trailDistance is 0 on a trail vertex and positive off it', () => {
    for (const c of CHUNKS) {
      const v = c.terrain.trails[0]?.[1];
      if (v === undefined) throw new Error(`${c.slug}: first trail has no second vertex`);
      expect(c.terrain.trailDistance(v[0], v[1]), c.slug).toBeCloseTo(0, 9);
      expect(c.terrain.trailDistance(CHUNK_HALF, CHUNK_HALF), c.slug).toBeGreaterThan(5); // the corners are off-road
    }
  });

  it('landscapeHash is stable per shard and tells shards apart', () => {
    const hashes = CHUNKS.map((c) => landscapeHash(c.terrain));
    expect(CHUNKS.map((c) => landscapeHash(c.terrain))).toEqual(hashes);
    expect(new Set(hashes).size).toBe(CHUNKS.length);
  });
});

describe('chunk registry switching', () => {
  it('reads ?chunk= from a query string, defaulting to Pine Hollow', () => {
    expect(chunkSlugFromUrl('?chunk=driftwood-isle&x=3')).toBe('driftwood-isle');
    expect(chunkSlugFromUrl('?x=3')).toBe(DEFAULT_CHUNK);
    expect(chunkSlugFromUrl('')).toBe(DEFAULT_CHUNK);
  });

  it('chunkUrl sets the chunk and keeps the other params', () => {
    const u = new URL(chunkUrl('driftwood-isle', 'https://example.test/?tier=phone&chunk=pine-hollow#x'));
    expect(u.searchParams.get('chunk')).toBe('driftwood-isle');
    expect(u.searchParams.get('tier')).toBe('phone');
    expect(u.hash).toBe('#x');
  });

  it('setActiveChunk rebinds config and notifies listeners only on a real switch; unknown slugs fall back', () => {
    const other = CHUNKS.find((c) => c.slug !== DEFAULT_CHUNK);
    if (other === undefined) throw new Error('needs a second shard');
    expect(getActiveChunk().slug).toBe(DEFAULT_CHUNK); // location is stubbed with no ?chunk=
    const seen = vi.fn<(def: ChunkDef) => void>();
    onActiveChunkChange(seen);

    expect(setActiveChunk(other.slug)).toBe(other);
    expect(config.SEED).toBe(other.seed);
    expect(config.CHUNK_ID).toBe(other.id);
    expect(config.TREE_COUNT).toBe(other.treeCount);
    setActiveChunk(other.slug); // same chunk: no second notification
    expect(seen).toHaveBeenCalledTimes(1);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(setActiveChunk('atlantis').slug).toBe(DEFAULT_CHUNK);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(config.SEED).toBe(getActiveChunk().seed);
  });
});
