// PH-B2: the Ridge's granite kit is placed over the heightfield deterministically, clear of every trail and landmark, and
// the bear cave's data (scripts/blender/pine-hollow/crags/build_cave.py) is self-consistent in its frame.
import { describe, expect, it } from 'vitest';
import { setActiveChunk } from '../../../src/game/shard/registry';
import { placeCrags, skinWeight, skinTile } from '../../../src/shards/pine-hollow/generators/crags';
import { caveLocal, caveWorld, skinGeometry, CRAG_IDS, CRAG_HERO, type CragId, type CragSize } from '../../../src/shards/pine-hollow/world/cragBake';
import type { CaveMeta } from '../../../src/shards/pine-hollow/world/crags';
import { trailDistance, normalAt } from '../../../src/engine/world/Heightfield';
import { DEN, LOOKOUT } from '../../../src/shards/pine-hollow/layout';
import kitJson from '../../../public/assets/models/pine-hollow-crags/crags.json?raw';
import caveJson from '../../../public/assets/models/pine-hollow-crags/cave.json?raw';
import kitBJson from '../../../public/assets/models/pine-hollow-crags/crags-b.json?raw';

setActiveChunk('pine-hollow');
interface KitMeta { modules: Record<string, { lod0: number; lod1: number; min: number[]; max: number[] }> }
const kitB = JSON.parse(kitBJson) as KitMeta;
/** the kit as the game merges it (PineCrags.load): crags-b.glb's cliff bands, buttress, slab and hero over crags.glb's tors,
 * boulders and scree (E350 F-X1: crags.glb no longer carries the big modules) */
const kit: KitMeta = { modules: { ...(JSON.parse(kitJson) as KitMeta).modules, ...kitB.modules } };
const cave = JSON.parse(caveJson) as CaveMeta;

/** crags.json's and crags-b.json's boxes are Blender's (z up, −y the front): the game's frame is (x, z, −y) */
function sizes(): Record<CragId, CragSize> {
  const out = {} as Record<CragId, CragSize>;
  for (const id of CRAG_IDS) {
    const m = kit.modules[id];
    if (!m) throw new Error(`neither crags.json nor crags-b.json has ${id}`);
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
  it('places the same set every time (the bake is deterministic)', () => {
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

describe('the crags Jake picked (E322 F-L2 B)', () => {
  const hb = kitB.modules[CRAG_HERO];
  const hero: CragSize | undefined = hb ? { hw: Math.max(-(hb.min[0] ?? 0), hb.max[0] ?? 0), hd: Math.max(-(hb.min[1] ?? 0), hb.max[1] ?? 0), h: hb.max[2] ?? 0 } : undefined;
  const b = placeCrags({ sizes: { ...sizes(), ...(hero ? { hero } : {}) } });

  it('the fused modules keep the kit\'s budgets', () => {
    for (const [id, m] of Object.entries(kitB.modules)) {
      expect(m.lod0, id).toBeLessThanOrEqual(id === CRAG_HERO ? 9000 : 4000);
      expect(m.lod1, id).toBeLessThanOrEqual(m.lod0 / 3);
    }
  });

  it('places the hero once, and every module off the trails, the lookout and the Den floor', () => {
    expect(b.filter((p) => p.id === CRAG_HERO)).toHaveLength(1);
    expect(b.length).toBeGreaterThan(60);
    for (const p of b) {
      if (p.id.startsWith('scree')) continue;
      expect(trailDistance(p.x, p.z), `${p.id} at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`).toBeGreaterThan(2.4);
      expect(Math.hypot(p.x - LOOKOUT.x, p.z - LOOKOUT.z)).toBeGreaterThan(LOOKOUT.r + 8);
      expect(Math.hypot(p.x - DEN.x, p.z - DEN.z)).toBeGreaterThan(DEN.r - 7);
    }
  });

  it('the skin\'s stepped bands barely fold back into the slope (the old skin: 9.8 % of its area)', () => {
    const folded = (): number => {
      let area = 0, back = 0;
      for (const [x0, z0] of [[-64, 160], [0, 160], [-128, 160]] as const) {
        const blocks = skinTile(x0, z0, 64, 1), g = blocks ? skinGeometry(blocks.pos, blocks.ao, blocks.index) : null;
        const p = g?.getAttribute('position'), idx = g?.getIndex();
        if (!p || !idx) continue;
        for (let i = 0; i < idx.count; i += 3) {
          const [ia, ib, ic] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
          const ux = p.getX(ib) - p.getX(ia), uy = p.getY(ib) - p.getY(ia), uz = p.getZ(ib) - p.getZ(ia);
          const vx = p.getX(ic) - p.getX(ia), vy = p.getY(ic) - p.getY(ia), vz = p.getZ(ic) - p.getZ(ia);
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
          if (l === 0) continue;
          const [tx, ty, tz] = normalAt((p.getX(ia) + p.getX(ib) + p.getX(ic)) / 3, (p.getZ(ia) + p.getZ(ib) + p.getZ(ic)) / 3, 2.5);
          area += l;
          if ((nx * tx + ny * ty + nz * tz) / l < -0.3) back += l;
        }
      }
      return back / Math.max(1e-9, area);
    };
    expect(folded()).toBeLessThan(0.059);
  }, 20_000); // builds three 64 m skin tiles: well under 1 s locally, over 5 s under CI coverage (9e0db1430; assertions unchanged)
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
    expect(cave.cuts.length).toBeGreaterThan(cave.holes.length); // the physics cut runs the whole cave, the drawn hole only the shallow part
    for (const h of cave.holes) { expect(h.lz - h.hd).toBeGreaterThan(1); expect(h.y1).toBeGreaterThan(h.y0 + 1.5); }
    expect(cave.drips.length).toBeGreaterThanOrEqual(4);
    expect(cave.shaft.top[1]).toBeGreaterThan(cave.shaft.foot[1] + 3);
    expect(cave.spots.every((s) => s.lz > 0 && s.lz < 40)).toBe(true);
  });
});
