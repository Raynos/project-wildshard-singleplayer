// PH-B2: the Ridge's granite kit is placed over the heightfield deterministically, clear of every trail and landmark, and
// the bear cave's data (scripts/blender/crags/build_cave.py) is self-consistent in its frame.
import { describe, expect, it } from 'vitest';
import { setActiveChunk } from '../src/chunks/registry';
import { placeCrags, caveLocal, caveWorld, skinWeight, CRAG_IDS, type CragId, type CragSize, type CaveMeta } from '../src/world/PineCrags';
import { trailDistance } from '../src/world/Heightfield';
import { DEN, LOOKOUT } from '../src/chunks/pineHollowLayout';
import kitJson from '../public/assets/models/pine-hollow-crags/crags.json?raw';
import caveJson from '../public/assets/models/pine-hollow-crags/cave.json?raw';

setActiveChunk('pine-hollow');
interface KitMeta { modules: Record<string, { lod0: number; lod1: number; min: number[]; max: number[] }> }
const kit = JSON.parse(kitJson) as KitMeta;
const cave = JSON.parse(caveJson) as CaveMeta;

/** crags.json's boxes are Blender's (z up, −y the front): the game's frame is (x, z, −y) */
function sizes(): Record<CragId, CragSize> {
  const out = {} as Record<CragId, CragSize>;
  for (const id of CRAG_IDS) {
    const m = kit.modules[id];
    if (!m) throw new Error(`crags.json has no ${id}`);
    const [x0 = 0, y0 = 0] = m.min, [x1 = 0, y1 = 0, z1 = 0] = m.max;
    out[id] = { hw: Math.max(-x0, x1), hd: Math.max(-y0, y1), h: z1 };
  }
  return out;
}

describe('the granite kit', () => {
  it('every module has both LODs in budget', () => {
    for (const id of CRAG_IDS) {
      const m = kit.modules[id];
      expect(m, id).toBeDefined();
      expect(m?.lod0 ?? 0, id).toBeLessThanOrEqual(4000);
      expect(m?.lod1 ?? 0, id).toBeLessThanOrEqual((m?.lod0 ?? 0) / 3);
    }
  });

  const a = placeCrags({ sizes: sizes() });
  it('places the same set every time (the navmesh bake runs the same code)', () => {
    expect(placeCrags({ sizes: sizes() })).toEqual(a);
    expect(a.length).toBeGreaterThan(80);
  });

  it('keeps the cliffs, tors and boulders off the trails, the lookout and the Den floor', () => {
    for (const p of a) {
      if (p.id.startsWith('scree')) continue;
      expect(trailDistance(p.x, p.z), `${p.id} at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`).toBeGreaterThan(2.4);
      expect(Math.hypot(p.x - LOOKOUT.x, p.z - LOOKOUT.z)).toBeGreaterThan(LOOKOUT.r + 8);
      expect(Math.hypot(p.x - DEN.x, p.z - DEN.z)).toBeGreaterThan(DEN.r - 7);
      const [lx, lz] = caveLocal(p.x, p.z);
      expect(lz > -9 && lz < 20 && Math.abs(lx) < 10, `${p.id} over the cave's hood`).toBe(false);
    }
  });

  it('the face skin stays off the trails and the lookout pad', () => {
    for (let x = -240; x <= 240; x += 7) for (let z = 120; z <= 245; z += 7) {
      if (trailDistance(x, z) < 3) expect(skinWeight(x, z)).toBe(0);
    }
    expect(skinWeight(LOOKOUT.x, LOOKOUT.z)).toBe(0);
  });
});

describe('the bear cave', () => {
  it('its frame turns and back', () => {
    const [x, z] = caveWorld(3.5, 21);
    const [lx, lz] = caveLocal(x, z);
    expect(lx).toBeCloseTo(3.5, 6); expect(lz).toBeCloseTo(21, 6);
  });

  it('the floor only steps down into the room, gently (walkable)', () => {
    for (let i = 1; i < cave.floor.length; i++) {
      const p = cave.floor[i - 1], q = cave.floor[i];
      if (!p || !q) continue;
      expect(q[1]).toBeLessThanOrEqual(p[1] + 1e-6);
      expect((p[1] - q[1]) / (q[0] - p[0])).toBeLessThan(0.2);
    }
  });

  it('has its holes and cuts past the lip, its spots, drips and shaft inside', () => {
    expect(cave.holes.length).toBeGreaterThan(5);
    expect(cave.cuts.length).toBe(cave.holes.length);
    for (const h of cave.holes) { expect(h.lz - h.hd).toBeGreaterThan(1); expect(h.y1).toBeGreaterThan(h.y0 + 1.5); }
    expect(cave.drips.length).toBeGreaterThanOrEqual(4);
    expect(cave.shaft.top[1]).toBeGreaterThan(cave.shaft.foot[1] + 3);
    expect(cave.spots.every((s) => s.lz > 0 && s.lz < 40)).toBe(true);
  });
});
