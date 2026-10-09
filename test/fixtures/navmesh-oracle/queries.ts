// SF72 navmesh oracle: the recorded queries (test/navmesh-oracle.test.ts). Each shard's baked navmesh answers the same
// seeded set of queries a creature asks (HuntBrain's steerTo path, its steerNav clear-ahead probe, a wander target, the
// closest walkable point), on every layer plus a radius past the largest. source.json holds the answers the browser's
// module gave (recorded before the app binding moved out of src/engine/physics/navmesh.ts); the vitest run and a plain
// Node run (scripts/sim-node-loader.mjs, no renderer) must both give them back exactly.
import { DEFAULT_QUERY_FILTER, findRandomPoint } from 'navcat';
import type { Navmesh } from '../../../src/engine/physics/navmesh';
import { Rng } from '../../../src/engine/core/rng';

type XYZ = readonly [number, number, number];
export type OracleAnswer =
  | { q: 'closest'; at: XYZ; r: number; out: XYZ | null }
  | { q: 'path'; from: XYZ; to: XYZ; r: number; out: XYZ[] | null }
  | { q: 'near'; at: XYZ; radius: number; r: number; out: XYZ | null }
  | { q: 'ahead'; at: XYZ; yaw: number; dist: number; r: number; out: { clear: number; normalX: number; normalZ: number } | null };

/** the shards whose baked navmesh the oracle replays */
export const ORACLE_SHARDS = ['driftwood-isle', 'pine-hollow'] as const;
/** points per layer */
const POINTS = 16;

const xyz = (p: { x: number; y: number; z: number } | null): XYZ | null => (p === null ? null : [p.x, p.y, p.z]);
const at = (p: XYZ): { x: number; y: number; z: number } => ({ x: p[0], y: p[1], z: p[2] });

/** Ask `nav` the oracle's queries (seeded per shard), in order. */
export function oracleQueries(nav: Navmesh, seed: number): OracleAnswer[] {
  const rng = new Rng(seed), out: OracleAnswer[] = [];
  const largest = nav.layers[nav.layers.length - 1]?.radius ?? 0;
  for (const r of [...nav.layers.map((l) => l.radius), largest + 0.4]) {
    const { mesh } = nav.layerFor(r);
    const points: XYZ[] = [];
    for (let i = 0; i < POINTS; i++) {
      const p = findRandomPoint(mesh, DEFAULT_QUERY_FILTER, () => rng.next());
      if (p.success) points.push([p.position[0], p.position[1], p.position[2]]);
    }
    points.forEach((p, i) => {
      const off: XYZ = [p[0] + rng.range(-1.5, 1.5), p[1] + rng.range(0, 1.2), p[2] + rng.range(-1.5, 1.5)];
      out.push({ q: 'closest', at: off, r, out: xyz(nav.closestWalkable(at(off), r)) });
      const to = points[(i + 1) % points.length] ?? p;
      const path = nav.findPath(at(p), at(to), r);
      out.push({ q: 'path', from: p, to, r, out: path === null ? null : path.map((v) => [v.x, v.y, v.z] as const) });
      // a far goal: past the island's edge or the search budget, the path ends at the reachable point nearest it
      const far: XYZ = [p[0] + rng.range(-120, 120), p[1], p[2] + rng.range(-120, 120)];
      const farPath = nav.findPath(at(p), at(far), r);
      out.push({ q: 'path', from: p, to: far, r, out: farPath === null ? null : farPath.map((v) => [v.x, v.y, v.z] as const) });
      const radius = rng.range(5, 25);
      out.push({ q: 'near', at: p, radius, r, out: xyz(nav.randomPointNear(at(p), radius, r, () => rng.next())) });
      const yaw = rng.range(-Math.PI, Math.PI), dist = rng.range(2, 8);
      out.push({ q: 'ahead', at: p, yaw, dist, r, out: nav.clearAhead(at(p), yaw, dist, r) });
    });
  }
  return out;
}
