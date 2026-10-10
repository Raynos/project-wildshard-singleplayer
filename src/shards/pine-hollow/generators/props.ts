/**
 * Pine Hollow's forest props scattered (E315 M2; G285: an offline bake). Build-time only: `scripts/bake-pine-props.mjs`
 * runs `bakePineProps` over Pine Hollow's baked terrain (the page's own grid), the scans' footprints (the boulder set's six
 * rocks and the fallen log, read from their LOD GLBs as the page loads them) and the forest's trunks (the physics bake's
 * `trees`), and writes every placement to `../data/props.json`; the page places the scans there (../world/props.ts) and
 * never runs this. test/shards/pine-hollow/props-bake.test.ts is the stale gate. Each kind's stream is the level seed's
 * (1337, the page's engine SEED while the props build) + 201 / 202 / 203.
 *
 * Placement follows the terrain normal, sinks into the ground, avoids tree trunks, keeps off the trails (trailDistance > 4
 * for logs) and out of the cabin pads (cabinMask < 0.2, stumps excepted). A solid copy standing in a declared entry's lanes
 * is left out (its slot counted, so the rest of the scatter stands exactly where it was).
 */
import * as THREE from 'three';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { smoothstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { normalAt, trailDistance, cabinMask, inChunk, CABIN_SITES, TRAILS } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ROCK_SOLID_ABOVE } from '../models/mossyBoulder';
import { inEntryLanes } from '../world/entryLanes';
import type { PropPose, PropRows } from '../world/props';
import source from '../shard.config';
import { PINE_SEED } from './undergrowth';

/** the scans' footprints at scale 1: each rock's radius and height, the log's half-length and lowest point */
export interface PropKit { rocks: readonly { radius: number; height: number }[]; log: { halfLen: number; bottom: number } }
/** a forest trunk the props step round */
export interface Trunk { x: number; z: number; r: number }

/** the scan's footprint in its own space, as the page's loaders measure it (the geometry's box, before its node transform) */
export function propKit(rocks: readonly THREE.BufferGeometry[], log: THREE.BufferGeometry): PropKit {
  const box = (g: THREE.BufferGeometry): THREE.Box3 => { g.computeBoundingBox(); return g.boundingBox ?? new THREE.Box3(); };
  const logBox = box(log);
  return {
    rocks: rocks.map((g) => { const bb = box(g); return { radius: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2, height: bb.max.y - bb.min.y }; }),
    log: { halfLen: (logBox.max.x - logBox.min.x) / 2, bottom: logBox.min.y },
  };
}

/** a placement's pose: position, rotation and uniform scale (the page composes the same matrix from it) */
function pose(p: THREE.Vector3, q: THREE.Quaternion, s: number): PropPose { return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, s]; }

export function bakePineProps(kit: PropKit, trunks: readonly Trunk[]): PropRows {
  // the trunks in 16 m cells, as the forest's TreeGrid holds them ("which trunks are near")
  const cells = new Map<string, Trunk[]>();
  for (const t of trunks) { const k = `${String(Math.floor(t.x / 16))},${String(Math.floor(t.z / 16))}`; const b = cells.get(k); if (b) b.push(t); else cells.set(k, [t]); }
  const treeFree = (x: number, z: number, r: number): boolean => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of cells.get(`${String(cx + i)},${String(cz + j)}`) ?? []) if (Math.hypot(t.x - x, t.z - z) < t.r + r) return false;
    return true;
  };
  /** a random point on a random trail segment */
  const trailPoint = (rng: Rng): [number, number] => {
    const poly = rng.pick(TRAILS), i = rng.int(0, poly.length - 2), t = rng.next();
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) throw new Error('[props] trail polyline shorter than 2 points');
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  /** an object sat on the terrain, aligned to the normal, yawed and scaled */
  const sit = (x: number, z: number, yaw: number, scale: number, sink: number, tilt: number): PropPose => {
    const [nx, ny, nz] = normalAt(x, z, 1.0);
    const up = new THREE.Vector3(nx, ny, nz).lerp(new THREE.Vector3(0, 1, 0), 1 - tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    return pose(new THREE.Vector3(x, heightAt(x, z) - sink, z), q, scale);
  };

  // ── boulders: the six shapes of rock_moss_set_01, each on its own base; per shape in scatter order (the draw order) ──
  const rockRng = new Rng(PINE_SEED + 201);
  const shapes = kit.rocks.map((s, k) => ({ ...s, k }));
  const byShape: PropRows['rocks'][] = shapes.map(() => []);
  let n = 0, tries = 0;
  while (n < 380 && tries++ < 30000) {
    // half the boulders line the trails (where the player actually walks), the rest follow the slopes
    let x: number, z: number;
    const nearTrail = rockRng.next() < 0.5;
    if (nearTrail) { const p = trailPoint(rockRng); const a = rockRng.range(0, Math.PI * 2), d = rockRng.range(3.5, 16); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
    else { x = rockRng.range(-244, 244); z = rockRng.range(-244, 244); }
    if (!inChunk(x, z, 6) || cabinMask(x, z) > 0.2) continue;
    const td = trailDistance(x, z);
    if (td < 3) continue;
    const [, ny] = normalAt(x, z, 1.0);
    const slope = 1 - ny;
    // rocks favour slopes and the rocky ridges; a sprinkle everywhere
    if (!nearTrail && rockRng.next() > 0.18 + 0.82 * smoothstep(0.04, 0.3, slope)) continue;
    const shape = rockRng.pick(shapes);
    // log-distributed size: mostly knee-high, a few car-sized
    const scale = Math.exp(rockRng.range(Math.log(0.3), Math.log(1.7)));
    const r = shape.radius * scale;
    if (!treeFree(x, z, r * 0.6)) continue;
    if (td < r + 2) continue;
    const sink = shape.height * scale * (0.18 + 0.35 * smoothstep(0.05, 0.3, slope) + rockRng.range(0, 0.1));
    const at = sit(x, z, rockRng.range(0, Math.PI * 2), scale, sink, 0.85);
    const solid = shape.height * scale - sink > ROCK_SOLID_ABOVE;   // height showing above ground
    n++;
    if (!(solid && inEntryLanes(source.entryways, CHUNK_HALF, x, z))) byShape[shape.k]?.push([shape.k, solid ? 1 : 0, ...at]);
  }

  // ── stumps: along the trails and around the cabins, as if cut for firewood ──
  const stumpRng = new Rng(PINE_SEED + 202);
  const stumps: PropPose[] = [];
  let gated = 0;
  tries = 0;
  while (stumps.length + gated < 70 && tries++ < 20000) {
    let x: number, z: number;
    if (stumpRng.next() < 0.4) {
      const c = stumpRng.pick(CABIN_SITES);
      const a = stumpRng.range(0, Math.PI * 2), d = stumpRng.range(9, 22);
      x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
    } else { const p = trailPoint(stumpRng); const a = stumpRng.range(0, Math.PI * 2), d = stumpRng.range(3.5, 14); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
    if (!inChunk(x, z, 6)) continue;
    const td = trailDistance(x, z);
    if (td < 3.5 || (td > 14 && cabinMask(x, z) < 0.02)) continue;
    if (cabinMask(x, z) > 0.75) continue;                       // not on the pad itself
    const [, ny] = normalAt(x, z, 1.0);
    if (ny < 0.8) continue;
    if (!treeFree(x, z, 1.2)) continue;
    const scale = stumpRng.range(0.8, 1.35), at = sit(x, z, stumpRng.range(0, Math.PI * 2), scale, 0.06 * scale, 0.7);
    // every stump collides: one standing in a declared entry's lanes is left out
    if (inEntryLanes(source.entryways, CHUNK_HALF, x, z)) { gated++; continue; }
    stumps.push(at);
  }

  // ── fallen logs: lying along the slope, near trail edges but never on them ──
  const logRng = new Rng(PINE_SEED + 203);
  const logs: PropPose[] = [];
  const { halfLen, bottom } = kit.log;
  tries = 0;
  while (logs.length < 55 && tries++ < 30000) {
    let x: number, z: number;
    if (logRng.next() < 0.7) { const p = trailPoint(logRng); const a = logRng.range(0, Math.PI * 2), d = logRng.range(4.5, 12); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
    else { x = logRng.range(-240, 240); z = logRng.range(-240, 240); }
    if (!inChunk(x, z, 7) || cabinMask(x, z) > 0.2) continue;
    const td = trailDistance(x, z);
    if (td < 4.5) continue;
    const [nx, ny, nz] = normalAt(x, z, 1.0);
    if (ny < 0.75) continue;
    const scale = logRng.range(1.1, 1.8), hl = halfLen * scale;
    // orientation: mostly along the fall line, some random
    const yaw = logRng.next() < 0.6 ? Math.atan2(-nz, nx) + logRng.range(-0.5, 0.5) : logRng.range(0, Math.PI * 2);
    const dx = Math.cos(yaw), dz = -Math.sin(yaw);               // local +X after yaw
    const ax = x + dx * hl, az = z + dz * hl, bx = x - dx * hl, bz = z - dz * hl;
    if (trailDistance(ax, az) < 4 || trailDistance(bx, bz) < 4) continue;
    if (!treeFree(x, z, 0.5) || !treeFree(ax, az, 0.4) || !treeFree(bx, bz, 0.4)) continue;
    // lie along the ground: pitch from the end heights, roll random
    const ya = heightAt(ax, az), yb = heightAt(bx, bz);
    // a log bridges concave ground on its ends and balances on convex ground in the middle: rest on the higher of the two
    const ym = Math.max((ya + yb) / 2, heightAt(x, z), (heightAt((x + ax) / 2, (z + az) / 2) + heightAt((x + bx) / 2, (z + bz) / 2)) / 2);
    const pitch = Math.atan2(ya - yb, 2 * hl);            // Rz(+pitch) lifts the +X end
    // roll happens around the log axis (local X): apply after yaw+pitch
    const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), logRng.range(0, Math.PI * 2));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ')).multiply(qRoll);
    // the terrain mesh is ~2 m per vertex, so lift thin logs a little above the analytic height rather than let them sink
    logs.push(pose(new THREE.Vector3(x, ym - bottom * scale + 0.14 * scale, z), q, scale));
  }
  return { rocks: byShape.flat(), stumps, logs };
}
