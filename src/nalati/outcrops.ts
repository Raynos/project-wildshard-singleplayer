/**
 * Escarpment rock outcrops (Nalati look pass, lever 5; world agent): weathered granite breaking out of the steep ground
 * — the gully walls, the spur shoulders, the upper face under the rim and the waterfall's head wall — as real, smooth
 * meshes (soft-bevelled blocks with a couple of rounded stones leaning on them), painted like the POI rocks: warm
 * granite, lichen on the tops, a darker foot where they sink into the turf. The Crags and Eagle Rock are the POI
 * agent's (src/world/nalati/Crags.ts, EagleRock.ts); the loose scatter is the dressing agent's.
 *
 * Placed from the terrain alone (seeded, deterministic): candidates on a jittered 7 m grid over the escarpment band,
 * kept where the ground is steep, clustered by a noise field, kept off the roads, the river, the POI clearings and the
 * fall. One merged mesh on the shared painterly POI material — one draw call (+ its shadow).
 *
 *   const rocks = buildOutcrops(sky);   scene.add(rocks.mesh);   player.colliders.push(...rocks.colliders);
 */
import * as THREE from 'three';
import { PaintKit, M, blob } from '../world/nalati/paint';
import { graniteBlock } from '../world/nalati/EagleRock';
import { inPoiClearing } from '../world/nalati/clearings';
import { heightAt, normalAt, trailDistance } from '../world/Heightfield';
import { Noise2D } from '../core/noise';
import { riverMask, rimZAt, RIVER, WATERFALL, RIM_Z } from '../chunks/nalati-grasslands';
import type { Collider } from '../player/Player';
import type { Sky } from '../world/Sky';

const C = {
  granite: new THREE.Color('#948d82'),
  warm: new THREE.Color('#a39179'),
  cool: new THREE.Color('#7f8189'),
  lichen: new THREE.Color('#b3a35a'),
  moss: new THREE.Color('#5f7433'),
};

export interface Outcrops { mesh: THREE.Mesh; colliders: Collider[]; count: number; triangles: number }

export function buildOutcrops(sky: Sky, seed = 0x0c7): Outcrops {
  const kit = new PaintKit(seed);
  const rng = kit.rng;
  const cluster = new Noise2D(seed + 11);
  const colliders: Collider[] = [];
  let count = 0;
  const step = 8;
  for (let gx = -244; gx <= 244; gx += step) for (let gz = RIM_Z - 30; gz <= 150; gz += step) {
    const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    const slope = 1 - ny;
    if (slope < 0.045) continue; // 1 − n.y: 0.045 ≈ 17°, 0.13 ≈ 30°
    const y0 = heightAt(x, z);
    if (y0 < -8.5 || y0 > 40) continue;
    if (trailDistance(x, z) < 7 || riverMask(x, z) > 0 || inPoiClearing(x, z, 4)) continue;
    if (Math.abs(x - WATERFALL.x) < 7 && z > WATERFALL.z - 6 && z < WATERFALL.z + 20) continue; // keep the fall's sheet clear
    if (Math.abs(x) > 238 || Math.abs(z) > 238) continue;
    // clustered: groups of rock on the steepest ground, bare grass between
    const c = cluster.fbm(x * 0.018, z * 0.018, 3);
    const keep = (c + 0.1) * 1.5 * Math.min(1, (slope - 0.035) * 10);
    if (rng.next() > keep) continue;

    // a block lying along the contour, tipped into the slope, sunk a third into the ground
    const size = 0.9 + rng.next() * (slope > 0.12 ? 2.4 : 1.5);
    const w = size * rng.range(1.4, 2.6), h = size * rng.range(0.7, 1.2), d = size * rng.range(1.0, 1.6);
    const downYaw = Math.atan2(nx, nz);                 // the heading the slope falls toward
    const yaw = downYaw + Math.PI / 2 + rng.range(-0.35, 0.35);
    const tilt = Math.min(0.5, Math.acos(Math.min(1, ny)) * 0.55);
    const y = y0 - h * 0.32;
    const tint = rng.next() < 0.5 ? C.granite : rng.next() < 0.5 ? C.warm : C.cool;
    kit.add(graniteBlock(w, h, d, rng.int(1, 1e6), 0.22), tint, {
      matrix: M(x, y, z, yaw, 1, 1, 1, tilt * Math.cos(yaw - downYaw), tilt * Math.sin(yaw - downYaw)),
      top: { color: C.lichen, threshold: 0.55, amount: 0.55 }, brush: 0.14, foot: 0.72,
    });
    // one or two rounded stones leaning on it, downhill
    const extra = rng.int(0, 2);
    for (let k = 0; k < extra; k++) {
      const r = size * rng.range(0.35, 0.6);
      const ox = x + Math.sin(downYaw) * (d * 0.5 + r * 0.6) + rng.range(-w * 0.4, w * 0.4);
      const oz = z + Math.cos(downYaw) * (d * 0.5 + r * 0.6) + rng.range(-w * 0.4, w * 0.4);
      kit.add(blob(r, rng, 1, 0.72, 0.2), tint, {
        matrix: M(ox, heightAt(ox, oz) - r * 0.25, oz, rng.range(0, 6.28)),
        top: { color: C.moss, threshold: 0.7, amount: 0.4 }, brush: 0.12, foot: 0.75,
      });
    }
    if (h > 1.1) colliders.push({ x, z, hw: w * 0.42, hd: d * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
    count++;
  }
  // the rim: a broken band of granite just under the plateau's lip, so the climb tops out through rock
  for (let x = -236; x <= 236; x += 4.5) {
    const c = cluster.fbm(x * 0.03 + 40, 3.3, 2);
    if (c < -0.12 || rng.next() > 0.75) continue;
    const z = rimZAt(x) + rng.range(4, 12);
    if (trailDistance(x, z) < 8 || inPoiClearing(x, z, 4) || Math.abs(x - WATERFALL.x) < 6) continue;
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    if (1 - ny < 0.04) continue;
    const size = 1.2 + rng.next() * 2.2;
    const w = size * rng.range(1.6, 2.8), h = size * rng.range(0.9, 1.5), d = size * rng.range(1.0, 1.5);
    const downYaw = Math.atan2(nx, nz), yaw = downYaw + Math.PI / 2 + rng.range(-0.25, 0.25);
    const y = heightAt(x, z) - h * 0.3;
    kit.add(graniteBlock(w, h, d, rng.int(1, 1e6), 0.24), rng.next() < 0.5 ? C.granite : C.warm, {
      matrix: M(x, y, z, yaw, 1, 1, 1, 0.12, 0), top: { color: C.lichen, threshold: 0.55, amount: 0.5 }, brush: 0.14, foot: 0.72,
    });
    if (h > 1.1) colliders.push({ x, z, hw: w * 0.42, hd: d * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
    count++;
  }
  // the river banks: rounded boulders along both edges of the gravel corridor and a few out on the bars
  for (let x = -244; x <= 244; x += 5) {
    for (const side of [-1, 1]) {
      if (cluster.fbm(x * 0.025 + side * 17, 9.1, 2) < -0.05 || rng.next() > 0.6) continue;
      const bank = side * (RIVER.half(x) + rng.range(-3, 2.5));
      const bx = x + rng.range(-2, 2), bz = RIVER.z(bx) + bank;
      if (trailDistance(bx, bz) < 6 || inPoiClearing(bx, bz, 2)) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const r = rng.range(0.45, 1.3), ox = bx + rng.range(-2, 2), oz = bz + rng.range(-1.5, 1.5);
        kit.add(blob(r, rng, 1, 0.7, 0.18), rng.next() < 0.5 ? C.cool : C.granite, {
          matrix: M(ox, Math.max(heightAt(ox, oz), RIVER.level - 0.4) - r * 0.3, oz, rng.range(0, 6.28)),
          top: { color: C.moss, threshold: 0.75, amount: 0.3 }, brush: 0.1, foot: 0.7,
        });
      }
      count++;
    }
  }
  const triangles = Math.round(kit.triangleCount);
  const mesh = kit.mesh(sky, { ground: heightAt, ao: false, aoH: 0.8, aoMin: 0.6 });
  mesh.name = 'nalati-outcrops';
  return { mesh, colliders, count, triangles };
}
