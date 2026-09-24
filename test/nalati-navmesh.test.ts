// NALATI-MERGE P3: Nalati's baked navmesh (scripts/bake-navmesh.mjs's Nalati branch: the terrain, every registered POI /
// outcrop / crag-rock / dressing collider, the paths; the Kunes corridor and the brook left out). One 0.3 m layer; a path
// goes round the camp's hitching rail; the river is not walkable but the bridge is; `clearAhead` (the packs' and the
// herd's steering) sees the rail; the P4 footpaths reach Eagle Rock's scramble, the cave porch and Argymaq's pasture.
import { describe, expect, it } from 'vitest';
import { parseNavmesh, type Navmesh } from '../src/physics/navmesh';
import { ARGYMAQ_TRAIL, CAVE_TRAIL, EAGLE_TRAIL, riverZAt } from '../src/chunks/nalatiLayout';
import nalatiNav from '../public/assets/baked/nalati-grasslands/navmesh.bin?inline';

interface P { x: number; y: number; z: number }

async function load(): Promise<Navmesh> {
  const nav = parseNavmesh(await (await fetch(nalatiNav)).arrayBuffer());
  if (nav === null) throw new Error('navmesh.bin did not parse');
  return nav;
}

/** the top walkable point at (x, z), scanned down from above */
function onMesh(nav: Navmesh, x: number, z: number): P {
  for (let y = 120; y > -20; y -= 3) {
    const p = nav.closestWalkable({ x, y, z }, 0.3);
    if (p !== null && Math.hypot(p.x - x, p.z - z) < 0.6) return { x: p.x, y: p.y, z: p.z };
  }
  throw new Error(`nothing walkable at (${x}, ${z})`);
}

const length = (pts: readonly P[]): number => pts.reduce((sum, p, i) => { const q = pts[i - 1]; return q ? sum + Math.hypot(p.x - q.x, p.z - q.z) : sum; }, 0);

describe('Nalati navmesh (NALATI-MERGE P3)', () => {
  it('loads one 0.3 m layer inside the boot budget', async () => {
    const nav = await load();
    expect(nav.layers.map((l) => l.radius)).toEqual([expect.closeTo(0.3, 5)]);
    expect(nav.layerFor(0.49).radius).toBeCloseTo(0.3); // Kokbori paths on it too
    expect(nav.bytes).toBeLessThan(300 * 1024); // ~250 KB raw, ~128 KB brotli on the wire
  });

  it('routes round the camp\'s hitching rail (a registered POI collider)', async () => {
    const nav = await load();
    // the rail runs north–south at x = 71, z 211.5 … 218.5; its trough south of it
    const from = onMesh(nav, 68, 215), to = onMesh(nav, 74.5, 215);
    const path = nav.findPath(from, to, 0.3);
    if (path === null) throw new Error('no path');
    const end = path[path.length - 1];
    if (end === undefined) throw new Error('empty path');
    expect(Math.hypot(end.x - to.x, end.z - to.z)).toBeLessThan(0.1);
    expect(length(path)).toBeGreaterThan(Math.hypot(to.x - from.x, to.z - from.z) + 2); // round an end, not through
  });

  it('steers by it: clearAhead is blocked by the rail, and a bearing round it is clear', async () => {
    const nav = await load();
    const at = onMesh(nav, 68.5, 215);
    const west = nav.clearAhead(at, Math.PI / 2, 5, 0.3); // +x = west (three's yaw: sin → x); the rail 2.5 m on
    if (west === null) throw new Error('off the mesh');
    expect(west.clear).toBeLessThan(0.7);
    expect(west.normalX).toBeLessThan(-0.5); // the wall faces back at the wolf
    const others = [0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4].map((y) => nav.clearAhead(at, y, 5, 0.3)?.clear ?? 0);
    expect(Math.max(...others)).toBe(1);
  });

  it('leaves the Kunes out and carries the road over it on the bridge', async () => {
    const nav = await load();
    for (const x of [60, -80, 150]) {
      const z = riverZAt(x);
      for (let y = -12; y < -4; y += 1) expect(nav.closestWalkable({ x, y, z }, 0.3)).toBeNull();
    }
    const north = onMesh(nav, 0, 200), south = onMesh(nav, 3, 146);
    const path = nav.findPath(north, south, 0.3, [], 1 << 14);
    const end = path?.[path.length - 1];
    if (end === undefined) throw new Error('no path over the bridge');
    expect(Math.hypot(end.x - south.x, end.z - south.z)).toBeLessThan(0.1);
    expect(Math.max(...(path ?? []).map((p) => p.y))).toBeGreaterThan(-6.5); // up on the deck (−6), not in the gully
  });

  it('walks the P4 footpaths end to end', async () => {
    const nav = await load();
    for (const trail of [EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL]) {
      const a = trail[0], b = trail[trail.length - 1];
      if (a === undefined || b === undefined) throw new Error('empty trail');
      const from = onMesh(nav, a[0], a[1]), to = onMesh(nav, b[0], b[1]);
      const path = nav.findPath(from, to, 0.3, [], 1 << 14);
      const end = path?.[path.length - 1];
      if (end === undefined) throw new Error('no path');
      expect(Math.hypot(end.x - to.x, end.z - to.z)).toBeLessThan(0.5);
      expect(Math.abs(end.y - to.y)).toBeLessThan(0.5);
    }
  });
});
