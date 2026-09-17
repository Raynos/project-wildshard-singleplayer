// The chunk's terrain shape. Pure functions so the same field drives the mesh,
// player collision, tree placement and grass.
import { Noise2D, smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF, ROAD_WIDTH, ROAD_LENGTH, SEED } from '../core/config';

const n = new Noise2D(SEED);
const n2 = new Noise2D(SEED + 7);

/** Trail polylines (xz). Roads enter at the four edge midpoints and meet a loop through the hollow. */
export const TRAILS: [number, number][][] = [
  // N entry → centre
  [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH], [-8, -150], [-30, -95], [-22, -40], [0, -10]],
  // S entry → centre
  [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH], [12, 150], [35, 95], [20, 45], [0, -10]],
  // W entry → centre
  [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0], [-150, 10], [-95, 30], [-45, 20], [0, -10]],
  // E entry → centre
  [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0], [150, -12], [95, -35], [50, -25], [0, -10]],
  // spur to the ridge cabin
  [[35, 95], [70, 120], [110, 135]],
];

export const CABIN_SITES = [
  { x: -14, z: -34, rot: 0.35 },
  { x: 62, z: 30, rot: -1.1 },
  { x: 118, z: 142, rot: 2.4 },
];

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

/** distance to the nearest trail centreline */
export function trailDistance(x: number, z: number): number {
  let d = Infinity;
  for (const poly of TRAILS) for (let i = 0; i < poly.length - 1; i++) d = Math.min(d, distToSegment(x, z, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]));
  return d;
}

/** 0..1: how much this point is inside the mandated flat entry road at an edge midpoint */
function entryRoadMask(x: number, z: number): number {
  const half = ROAD_WIDTH / 2 + 3;
  const along = (a: number, b: number) => smoothstep(half + 22, half, Math.abs(a)) * smoothstep(CHUNK_HALF - ROAD_LENGTH - 25, CHUNK_HALF - ROAD_LENGTH + 5, Math.abs(b));
  return Math.max(along(x, z), along(z, x));
}

export function cabinMask(x: number, z: number): number {
  let m = 0;
  for (const c of CABIN_SITES) {
    const d = Math.hypot(x - c.x, z - c.z);
    m = Math.max(m, smoothstep(22, 11, d));
  }
  return m;
}

/** raw landscape height, metres */
function landscape(x: number, z: number): number {
  const s = 0.0035;
  let h = n.fbm(x * s, z * s, 5, 2.0, 0.5) * 16;        // rolling hills
  h += n2.ridged(x * 0.0018 + 3.1, z * 0.0018, 3) * 14 - 6; // ridges
  h += n.fbm(x * 0.03, z * 0.03, 3) * 0.9;                 // small bumps
  // gentle bowl in the middle so the cabins sit in a hollow with sight lines
  const r = Math.hypot(x, z + 10);
  h -= smoothstep(220, 40, r) * 5;
  // rim: rise toward the chunk edges except where the roads enter (feels like a bounded shard)
  const edge = Math.max(Math.abs(x), Math.abs(z)) / CHUNK_HALF;
  h += smoothstep(0.78, 1.0, edge) * 4.5;
  return h;
}

export function heightAt(x: number, z: number): number {
  let h = landscape(x, z);
  // trails: flatten a little and carve a shallow bed
  const td = trailDistance(x, z);
  const trailW = smoothstep(9, 2.5, td);
  h -= trailW * 0.35;
  // cabin pads: flatten to the pad's height
  for (const c of CABIN_SITES) {
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

export function normalAt(x: number, z: number, eps = 0.6): [number, number, number] {
  const hl = heightAt(x - eps, z), hr = heightAt(x + eps, z);
  const hd = heightAt(x, z - eps), hu = heightAt(x, z + eps);
  const nx = hl - hr, nz = hd - hu, ny = 2 * eps;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

/** splat weights: [forest floor, grass, rock, dirt trail] */
export function splatAt(x: number, z: number): [number, number, number, number] {
  const [, ny] = normalAt(x, z, 1.0);
  const slope = 1 - ny;
  const h = heightAt(x, z);
  const td = trailDistance(x, z);
  const rock = smoothstep(0.16, 0.34, slope) + smoothstep(0.55, 0.75, n2.fbm(x * 0.02, z * 0.02, 3) + smoothstep(14, 24, h) * 0.3);
  const trail = smoothstep(5.5 + n.get(x * 0.1, z * 0.1) * 1.5, 1.5, td) + cabinMask(x, z) * 0.6;
  const grassN = n.fbm(x * 0.012 + 50, z * 0.012, 4);
  const grass = smoothstep(-0.05, 0.35, grassN) * smoothstep(0.25, 0.08, slope) * (1 - smoothstep(2, 10, h) * 0.5);
  let w0 = 1, w1 = clamp(grass, 0, 1), w2 = clamp(rock, 0, 1), w3 = clamp(trail, 0, 1);
  // priority blend: trail > rock > grass > floor
  w2 *= 1 - w3; w1 *= (1 - w3) * (1 - w2); w0 = Math.max(0, 1 - w1 - w2 - w3);
  const s = w0 + w1 + w2 + w3;
  return [w0 / s, w1 / s, w2 / s, w3 / s];
}

export function inChunk(x: number, z: number, margin = 0) {
  return Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin;
}
