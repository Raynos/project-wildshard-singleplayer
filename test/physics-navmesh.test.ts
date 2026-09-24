// PHYSICS.md P6b: the baked navmesh (scripts/bake-navmesh.mjs → public/assets/baked/<slug>/navmesh.bin, read by
// src/physics/navmesh.ts). Both shards' files load in node; a path between two points on either side of a building goes
// round it (the straight line is blocked on the mesh, every leg of the path stays on it); water is not walkable; a wander
// target is reachable; and the query cost fits the plan's budget (path queries ≤ 0.3 ms per frame on the phone).
import { describe, expect, it } from 'vitest';
import { createFindNearestPolyResult, DEFAULT_QUERY_FILTER, findNearestPoly, findRandomPoint, raycast } from 'navcat';
import type * as THREE from 'three';
import { parseNavmesh, type Navmesh } from '../src/physics/navmesh';
import { Rng } from '../src/core/rng';
import driftwoodNav from '../public/assets/baked/driftwood-isle/navmesh.bin?inline';
import pineNav from '../public/assets/baked/pine-hollow/navmesh.bin?inline';

/** A `?inline` import is a data: URL (tests run in plain node, no file access): its bytes. */
const bytesOf = async (dataUrl: string): Promise<ArrayBuffer> => (await fetch(dataUrl)).arrayBuffer();

async function load(dataUrl: string): Promise<{ nav: Navmesh; ms: number }> {
  const buf = await bytesOf(dataUrl);
  const t0 = performance.now();
  const nav = parseNavmesh(buf);
  const ms = performance.now() - t0;
  if (nav === null) throw new Error('navmesh.bin did not parse');
  return { nav, ms };
}

interface P { x: number; y: number; z: number }

/** The walkable point at (x, z) — scanned down from above, so it is the top surface there (a deck over the ground). */
function onMesh(nav: Navmesh, x: number, z: number, radius: number): P {
  for (let y = 80; y > -20; y -= 3) {
    const p = nav.closestWalkable({ x, y, z }, radius);
    if (p !== null && Math.hypot(p.x - x, p.z - z) < 0.5) return { x: p.x, y: p.y, z: p.z };
  }
  throw new Error(`nothing walkable at (${x}, ${z})`);
}

/** Is the straight segment a → b walkable on the layer's mesh (navcat's 2D walkability ray from a)? */
function clear(nav: Navmesh, radius: number, a: P, b: P): boolean {
  const { mesh } = nav.layerFor(radius);
  const s = findNearestPoly(createFindNearestPolyResult(), mesh, [a.x, a.y, a.z], [0.5, 2, 0.5], DEFAULT_QUERY_FILTER);
  return s.success && raycast(mesh, s.nodeRef, s.position, [b.x, b.y, b.z], DEFAULT_QUERY_FILTER).t >= 1;
}

/** Does every point of a → b (every 10 cm) lie on the layer's mesh? (A path leg may run along an edge the ray grazes.) */
function onMeshAlong(nav: Navmesh, radius: number, a: P, b: P): boolean {
  const { mesh } = nav.layerFor(radius);
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1), hit = createFindNearestPolyResult();
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (!findNearestPoly(hit, mesh, [x, y, z], [0.1, 3, 0.1], DEFAULT_QUERY_FILTER).success) return false;
    if (Math.hypot(hit.position[0] - x, hit.position[2] - z) > 0.02) return false;
  }
  return true;
}

/**
 * Wall-clock bounds: as written on a dev machine, 4× on a shared CI runner (E76) — there they catch an order-of-magnitude
 * regression, not runner jitter (a docs-only push once tripped `mean < 0.3` at 0.317 ms and blocked the deploy).
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}; // no node typings in the tests
const TIME_SLACK = env['CI'] === undefined ? 1 : 4;

const length = (pts: readonly P[]): number => pts.reduce((sum, p, i) => { const q = pts[i - 1]; return q ? sum + Math.hypot(p.x - q.x, p.z - q.z) : sum; }, 0);

describe('navmesh (P6b)', () => {
  it('loads both shards in node, one layer per agent class', async () => {
    const di = await load(driftwoodNav), ph = await load(pineNav);
    expect(di.nav.layers.map((l) => l.radius)).toEqual([expect.closeTo(0.3, 5), expect.closeTo(0.5, 5)]);
    expect(ph.nav.layers.map((l) => l.radius)).toEqual([expect.closeTo(0.5, 5)]);
    // radius → layer: the smallest that covers it, the largest past them all
    expect(di.nav.layerFor(0.22).radius).toBeCloseTo(0.3);
    expect(di.nav.layerFor(0.33).radius).toBeCloseTo(0.5);
    expect(ph.nav.layerFor(0.9).radius).toBeCloseTo(0.5);
    for (const { nav } of [di, ph]) for (const l of nav.layers) expect(Object.keys(l.mesh.tiles).length).toBeGreaterThan(100);
    console.info(`[navmesh] parse: driftwood ${(di.nav.bytes / 1024).toFixed(0)} KB in ${di.ms.toFixed(1)} ms, pine hollow ${(ph.nav.bytes / 1024).toFixed(0)} KB in ${ph.ms.toFixed(1)} ms`);
    expect(di.ms + ph.ms).toBeLessThan(1000 * TIME_SLACK);
  });

  it('routes round a building: the straight line is blocked, every leg of the path stays on the mesh', async () => {
    // Pine Hollow's first cabin (-14, -34) for a deer; Driftwood's hut on the plateau (-22, -64) for a crab
    const cases = [
      { nav: (await load(pineNav)).nav, r: 0.33, a: [-24, -30], b: [-4, -38] },
      { nav: (await load(driftwoodNav)).nav, r: 0.22, a: [-34, -64], b: [-10, -64] },
    ] as const;
    for (const { nav, r, a, b } of cases) {
      const from = onMesh(nav, a[0], a[1], r), to = onMesh(nav, b[0], b[1], r);
      expect(clear(nav, r, from, to)).toBe(false); // the building is in the way
      expect(onMeshAlong(nav, r, from, to)).toBe(false);
      const path = nav.findPath(from, to, r);
      if (path === null) throw new Error('no path');
      expect(path.length).toBeGreaterThan(2);
      const end = path[path.length - 1];
      if (end === undefined) throw new Error('empty path');
      expect(Math.hypot(end.x - to.x, end.z - to.z)).toBeLessThan(0.1); // reached, not a partial path
      for (let i = 1; i < path.length; i++) {
        const p = path[i - 1], q = path[i];
        if (p && q) expect(onMeshAlong(nav, r, p, q)).toBe(true);
      }
      expect(length(path)).toBeGreaterThan(Math.hypot(to.x - from.x, to.z - from.z) + 0.5);
    }
  });

  it('leaves the water out: the open sea and the pond are not walkable', async () => {
    const di = (await load(driftwoodNav)).nav, ph = (await load(pineNav)).nav;
    expect(di.closestWalkable({ x: 200, y: 0, z: -200 }, 0.3)).toBeNull(); // open sea, south-east
    for (let y = -12; y < 4; y += 2) expect(ph.closestWalkable({ x: -56, y, z: 120 }, 0.5)).toBeNull(); // the pond's middle
    expect(ph.closestWalkable(onMesh(ph, 0, -200, 0.5), 0.5)).not.toBeNull(); // the south road is
  });

  it('picks a reachable wander target about the asked distance away', async () => {
    const { nav } = await load(pineNav);
    const rng = new Rng(7), from = onMesh(nav, -45, 20, 0.33);
    for (let i = 0; i < 20; i++) {
      const t = nav.randomPointNear(from, 20, 0.33, () => rng.next());
      if (t === null) throw new Error('no wander target');
      expect(Math.hypot(t.x - from.x, t.z - from.z)).toBeLessThan(40); // navcat bounds the polys searched, not the point
      const path = nav.findPath(from, t, 0.33);
      const end = path?.[path.length - 1];
      if (end === undefined) throw new Error('unreachable wander target');
      expect(Math.hypot(end.x - t.x, end.z - t.z)).toBeLessThan(0.1);
    }
  });

  it('costs well under the budget per query (wander, flee and charge lengths; a cross-map search is capped)', async () => {
    for (const [name, url] of [['driftwood-isle', driftwoodNav], ['pine-hollow', pineNav]] as const) {
      const { nav } = await load(url);
      const { mesh } = nav.layerFor(0.5);
      const rng = new Rng(11), rand = () => rng.next();
      const starts: P[] = [];
      while (starts.length < 300) { const s = findRandomPoint(mesh, DEFAULT_QUERY_FILTER, rand); if (s.success) starts.push({ x: s.position[0], y: s.position[1], z: s.position[2] }); }
      const out: THREE.Vector3[] = [];
      // warm up first (JIT + the query's lazily built tables), so the mean measures steady-state queries
      for (const s of starts.slice(0, 30)) nav.findPath(s, { x: s.x + 10, y: s.y, z: s.z }, 0.5, out);
      nav.resetStats();
      let paths = 0;
      for (const s of starts) {
        const a = rand() * Math.PI * 2, d = 5 + rand() * 25; // 5–25 m: wander targets, a flee leg, a charge
        if (nav.findPath(s, { x: s.x + Math.cos(a) * d, y: s.y, z: s.z + Math.sin(a) * d }, 0.5, out) !== null) paths++;
      }
      const mean = nav.stats.ms / nav.stats.queries;
      // the worst case: a goal across the shard, cut off at MAX_SEARCH_NODES
      const far = starts.slice(0, 20), t0 = performance.now();
      for (const s of far) nav.findPath(s, { x: -s.x, y: s.y, z: -s.z }, 0.5, out);
      const worst = (performance.now() - t0) / far.length;
      console.info(`[navmesh] ${name}: ${paths}/${starts.length} short paths, mean ${mean.toFixed(3)} ms; cross-map ${worst.toFixed(3)} ms`);
      expect(paths).toBeGreaterThan(starts.length * 0.9);
      expect(mean).toBeLessThan(0.3 * TIME_SLACK); // desktop node; the phone is ~4x — a few queries per 10 Hz think, not per frame
      expect(worst).toBeLessThan(5 * TIME_SLACK);
    }
  });
});
