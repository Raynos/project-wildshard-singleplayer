/**
 * buildTerrain(seed, spec) — compiles a `TerrainSpec` into the pure `ChunkTerrain` functions.
 *
 * The def supplies the raw landscape, the trails, cabin sites, an optional pond and the ground
 * splat rule; this adds what every Wildshard shard must have on top of that:
 *   · the four entry roads at the edge midpoints, levelled to y = 0 at the boundary and ramping
 *     up into the chunk over ROAD_LENGTH (a fundamentals requirement, not tuneable per chunk)
 *   · flat cabin pads at the landscape height of each site
 *   · a shallow bed carved along every trail
 *   · the pond basin dished below its water line
 * All of it stays closure-based (no `this`), so the functions can be re-exported and called
 * millions of times from the terrain mesh / placement loops without indirection.
 */
import { Noise2D, smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF, ROAD_WIDTH, ROAD_LENGTH } from '../core/config';
import type { ChunkTerrain, TerrainSpec, TerrainNoise, Vec2, CabinSite } from './ChunkDef';

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

/** 0..1: how much this point is inside the mandated flat entry road at an edge midpoint */
function entryRoadMask(x: number, z: number): number {
  const half = ROAD_WIDTH / 2 + 3;
  const along = (a: number, b: number) => smoothstep(half + 22, half, Math.abs(a)) * smoothstep(CHUNK_HALF - ROAD_LENGTH - 25, CHUNK_HALF - ROAD_LENGTH + 5, Math.abs(b));
  return Math.max(along(x, z), along(z, x));
}

export function buildTerrain(seed: number, spec: TerrainSpec): ChunkTerrain {
  const noise: TerrainNoise = { n: new Noise2D(seed), n2: new Noise2D(seed + 7) };
  const { n } = noise;
  const trails: Vec2[][] = spec.trails;
  const cabinSites: CabinSite[] = spec.cabinSites;
  const pond = spec.pond ?? null;
  const pondFill = spec.pondFill ?? 1.0;
  const landscape = (x: number, z: number) => spec.landscape(x, z, noise);

  function trailDistance(x: number, z: number): number {
    let d = Infinity;
    for (const poly of trails) for (let i = 0; i < poly.length - 1; i++) d = Math.min(d, distToSegment(x, z, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]));
    return d;
  }

  function cabinMask(x: number, z: number): number {
    let m = 0;
    for (const c of cabinSites) {
      const d = Math.hypot(x - c.x, z - c.z);
      m = Math.max(m, smoothstep(22, 11, d));
    }
    return m;
  }

  let _waterLevel: number | null = null;
  function waterLevel(): number {
    if (_waterLevel === null) _waterLevel = pond ? landscape(pond.x, pond.z) + pondFill : -1e4; // fills the natural basin below its rim
    return _waterLevel;
  }

  const pondMask = pond
    ? (x: number, z: number): number => {
        const d = Math.hypot(x - pond.x, z - pond.z) + n.get(x * 0.05, z * 0.05) * 3;
        return smoothstep(pond.r + 10, pond.r * 0.3, d);
      }
    : () => 0;

  function heightAt(x: number, z: number): number {
    let h = landscape(x, z);
    // pond basin: dish down to ~3 m below the water line
    const pm = pondMask(x, z);
    if (pm > 0) h = lerp(h, Math.min(h, waterLevel() - 1.6 - pm * 1.6), smoothstep(0.0, 0.5, pm));
    // trails: flatten a little and carve a shallow bed
    const td = trailDistance(x, z);
    const trailW = smoothstep(9, 2.5, td);
    h -= trailW * 0.35;
    // cabin pads: flatten to the pad's height
    for (const c of cabinSites) {
      const d = Math.hypot(x - c.x, z - c.z);
      const m = smoothstep(20, 9, d);
      if (m > 0) h = lerp(h, landscape(c.x, c.z), m);
    }
    // entry roads: must be level with no-man's land (y = 0) at the chunk boundary
    const rm = entryRoadMask(x, z);
    if (rm > 0) {
      const inward = CHUNK_HALF - Math.max(Math.abs(x), Math.abs(z));
      const ramp = smoothstep(ROAD_LENGTH - 15, ROAD_LENGTH + 30, inward); // 0 at edge → 1 deep inside
      h = lerp(lerp(0, h, ramp), h, 1 - rm);
    }
    return h;
  }

  function normalAt(x: number, z: number, eps = 0.6): [number, number, number] {
    const hl = heightAt(x - eps, z), hr = heightAt(x + eps, z);
    const hd = heightAt(x, z - eps), hu = heightAt(x, z + eps);
    const nx = hl - hr, nz = hd - hu, ny = 2 * eps;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }

  const terrain: ChunkTerrain = {
    heightAt, normalAt, trailDistance, cabinMask, pondMask, waterLevel,
    splatAt: (x, z) => {
      const [a, b, c, d] = spec.splat(x, z, terrain, noise);
      const s = a + b + c + d;
      return [a / s, b / s, c / s, d / s];
    },
    trails, cabinSites, pond,
  };
  return terrain;
}
