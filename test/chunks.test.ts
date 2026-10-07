import { terrainFor, type ShardManifest } from '../src/game/shard/manifest';
// Every authored shard satisfies the ShardManifest contract; the original world-grid shards retain their entry roads.
import { describe, expect, it, vi } from 'vitest';
import { loadSpecies } from './species';
import { SHARDS } from '../src/shards.generated';
import { playable, chunkSlugFromUrl, chunkUrl, findChunk, getActiveChunk, onActiveChunkChange, setActiveChunk, defaultChunk } from '../src/game/shard/registry';
import { landscapeHash } from '../src/engine/world/terrainField';
import { hasSpecies, speciesDef } from '../src/engine/entities/species/registry';
import * as config from '../src/engine/core/config';

const PLAYABLE_SHARDS = SHARDS.filter(playable);
/** G23: a structures-only world authors no terrain; the terrain checks below are for shards that do */
const TERRAIN_SHARDS = PLAYABLE_SHARDS.filter((c) => c.ground.terrain !== undefined);

const { CHUNK_HALF } = config;
loadSpecies();
const finite = (xs: readonly number[]): boolean => xs.every(Number.isFinite);
const EDGE_MIDPOINTS: [number, number][] = [[0, -CHUNK_HALF], [0, CHUNK_HALF], [-CHUNK_HALF, 0], [CHUNK_HALF, 0]];
// B83: these authored grid connections stay fixed, regardless of status. New shards choose their own roads.
const WORLD_GRID = new Set(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack']);

describe('chunk registry data', () => {
  it('ids and slugs are unique and ids follow chunk://local/<slug>', () => {
    expect(new Set(PLAYABLE_SHARDS.map((c) => c.slug)).size).toBe(PLAYABLE_SHARDS.length);
    expect(new Set(PLAYABLE_SHARDS.map((c) => c.slug)).size).toBe(PLAYABLE_SHARDS.length);
    for (const c of PLAYABLE_SHARDS) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/u);
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
    }
    expect(findChunk(defaultChunk())).toBeDefined();
  });

  it('seeds are distinct integers and picker fields are filled', () => {
    expect(new Set(PLAYABLE_SHARDS.map((c) => c.seed)).size).toBe(PLAYABLE_SHARDS.length);
    for (const c of PLAYABLE_SHARDS) {
      expect(Number.isInteger(c.seed), c.slug).toBe(true);
      expect(c.treeCount, c.slug).toBeGreaterThanOrEqual(0);
      for (const s of [c.name, c.label, c.biome, c.blurb, c.card.thumb, c.card.portrait, c.card.landscape]) expect(s.length, c.slug).toBeGreaterThan(0);
    }
  });

  it('the spawn is inside the chunk, and on dry ground unless the shard is open water (Driftwood spawns on the pier deck)', () => {
    for (const c of PLAYABLE_SHARDS) {
      expect(Math.abs(c.spawn.x), c.slug).toBeLessThan(CHUNK_HALF);
      expect(Math.abs(c.spawn.z), c.slug).toBeLessThan(CHUNK_HALF);
      if (!c.ocean) expect(terrainFor(c).heightAt(c.spawn.x, c.spawn.z), c.slug).toBeGreaterThan(terrainFor(c).waterLevel());
    }
  });

  it('every herd names a registered species, real variants, a positive count, a sane trail band and an in-chunk anchor', () => {
    for (const c of PLAYABLE_SHARDS) {
      // Nalati's wolves / horses / sheep are placed by Wildlife (src/shards/nalati-grasslands/creatures/wildlife.ts), not by `fauna`
      if (c.uses === undefined && c.slug !== 'nalati-grasslands') expect(c.spawns.length, c.slug).toBeGreaterThan(0);
      for (const h of c.spawns) {
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
    for (const c of PLAYABLE_SHARDS) {
      const { sky, atmosphere: a, grade: g } = c;
      expect(finite([sky.sunIntensity, sky.envIntensity, sky.bgIntensity, sky.hemiIntensity, ...sky.sunColor]), c.slug).toBe(true);
      expect(finite([a.fogHeight, a.fogHeightFalloff, a.fogHeightDensity, a.fogDistDensity]), c.slug).toBe(true);
      expect(finite([g.saturation, g.brightness, g.contrast, g.gamma, ...g.lift, ...g.gain]), c.slug).toBe(true);
    }
  });
});

describe('chunk terrain', () => {
  it('the four entry roads meet no-man\'s-land at y = 0 on the edge midpoints', () => {
    // in the authored frame: a field shifted at runtime (`datum`, Driftwood's G164 drop) meets the road through its decks
    for (const c of TERRAIN_SHARDS) for (const [x, z] of EDGE_MIDPOINTS) {
      const field = terrainFor(c);
      expect(field.heightAt(x, z) - (field.datum ?? 0), `${c.slug} @ ${x},${z}`).toBeCloseTo(0, 6);
    }
  });

  it('grid shards retain four midpoint entry trails; other shards have a trail from spawn', () => {
    // Include hidden teaching shards and experimental shards: each still needs a usable entry trail.
    for (const c of SHARDS.filter((m) => m.ground.terrain !== undefined)) {
      const trails = terrainFor(c).trails;
      if (WORLD_GRID.has(c.slug)) {
        expect(trails.length, c.slug).toBeGreaterThanOrEqual(4);
        const starts = trails.slice(0, 4).map((t) => t[0]);
        for (const m of EDGE_MIDPOINTS) expect(starts, c.slug).toContainEqual(m);
      } else {
        expect(trails.length, c.slug).toBeGreaterThanOrEqual(1);
        expect(trails.some((t) => {
          const start = t[0];
          return t.length >= 2 && start !== undefined && start[0] === c.spawn.x && start[1] === c.spawn.z;
        }), c.slug).toBe(true);
      }
    }
  });

  it('height, normals and splat weights are finite and well-formed across the chunk', () => {
    for (const c of TERRAIN_SHARDS) {
      const t = terrainFor(c);
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
    for (const c of TERRAIN_SHARDS) {
      const v = terrainFor(c).trails[0]?.[1];
      if (v === undefined) throw new Error(`${c.slug}: first trail has no second vertex`);
      expect(terrainFor(c).trailDistance(v[0], v[1]), c.slug).toBeCloseTo(0, 9);
      expect(terrainFor(c).trailDistance(CHUNK_HALF, CHUNK_HALF), c.slug).toBeGreaterThan(5); // the corners are off-road
    }
  });

  it('landscapeHash is stable per shard and tells shards apart', () => {
    const hashes = PLAYABLE_SHARDS.map((c) => landscapeHash(terrainFor(c)));
    expect(PLAYABLE_SHARDS.map((c) => landscapeHash(terrainFor(c)))).toEqual(hashes);
    expect(new Set(hashes).size).toBe(PLAYABLE_SHARDS.length);
  });
});

describe('chunk registry switching', () => {
  it('reads ?chunk= from a query string, defaulting to Driftwood Isle', () => {
    expect(chunkSlugFromUrl('?chunk=driftwood-isle&x=3')).toBe('driftwood-isle');
    expect(chunkSlugFromUrl('?x=3')).toBe(defaultChunk());
    expect(chunkSlugFromUrl('')).toBe(defaultChunk());
  });

  it('boots Driftwood from the PWA root, while explicit chunk URLs take precedence', () => {
    expect(chunkSlugFromUrl()).toBe(defaultChunk());
    expect(chunkSlugFromUrl('?chunk=pine-hollow')).toBe('pine-hollow');
    expect(chunkSlugFromUrl('')).toBe(defaultChunk());
  });

  it('chunkUrl sets the chunk and keeps the other params', () => {
    const u = new URL(chunkUrl('driftwood-isle', 'https://example.test/?tier=phone&chunk=pine-hollow#x'));
    expect(u.searchParams.get('chunk')).toBe('driftwood-isle');
    expect(u.searchParams.get('tier')).toBe('phone');
    expect(u.hash).toBe('#x');
  });

  it('setActiveChunk rebinds config and notifies listeners only on a real switch; unknown slugs fall back', () => {
    const other = PLAYABLE_SHARDS.find((c) => c.slug !== defaultChunk());
    if (other === undefined) throw new Error('needs a second shard');
    expect(getActiveChunk().slug).toBe(defaultChunk()); // location is stubbed with no ?chunk=
    const seen = vi.fn<(def: ShardManifest) => void>();
    onActiveChunkChange(seen);

    expect(setActiveChunk(other.slug)).toBe(other);
    expect(config.SEED).toBe(other.seed);
    expect(config.TREE_COUNT).toBe(other.treeCount);
    setActiveChunk(other.slug); // same chunk: no second notification
    expect(seen).toHaveBeenCalledTimes(1);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(setActiveChunk('atlantis').slug).toBe(defaultChunk());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(config.SEED).toBe(getActiveChunk().seed);
  });
});
