/**
 * Escarpment rock outcrops (Nalati look pass, lever 5; world agent): weathered granite breaking out of the steep ground
 * — the escarpment's ravines and rock bands, the upper face under the north rim — as real, smooth
 * meshes (soft-bevelled blocks with a couple of rounded stones leaning on them), painted like the POI rocks: warm
 * granite, lichen on the tops, a darker foot where they sink into the turf. The Crags and Eagle Rock are the POI
 * agent's (src/world/nalati/Crags.ts, EagleRock.ts); the loose scatter is the dressing agent's.
 *
 * Placed from the terrain alone (seeded, deterministic): candidates on a jittered 7 m grid over the escarpment band,
 * kept where the ground is steep, clustered by a noise field, kept off the roads, the river, the stream and the POI
 * clearings. One merged mesh on the shared painterly POI material — one draw call (+ its shadow).
 *
 *   const rocks = buildOutcrops(sky);   scene.add(rocks.mesh);   registry.add({ …, colliders: rocks.descs, surface: 'rock' });
 *   (NALATI-MERGE P1: every big block and bank boulder as the hull of what it draws; `colliders` = their old boxes, data only)
 */
import * as THREE from 'three';
import { PaintKit, M, blob } from '../world/nalati/paint';
import { graniteBlock } from '../world/nalati/EagleRock';
import { inPoiClearing } from '../world/nalati/clearings';
import { heightAt, normalAt, trailDistance } from '../world/Heightfield';
import { Noise2D } from '../core/noise';
import { riverMask, rimZAt, RIVER, RIM_Z, outcropAt, BROOK, edgeBermAt } from '../chunks/nalati-grasslands';
import { CHUNK_HALF } from '../core/config';
import type { Collider } from '../player/Player';
import type { ColliderDesc } from '../world/registry';
import { supportHull } from '../world/nalati/solid';
import type { Sky } from '../world/Sky';

const C = {
  granite: new THREE.Color('#948d82'),
  warm: new THREE.Color('#a39179'),
  cool: new THREE.Color('#7f8189'),
  lichen: new THREE.Color('#b3a35a'),
  moss: new THREE.Color('#5f7433'),
  snow: new THREE.Color('#eef2f7'),
};

export interface Outcrops { mesh: THREE.Mesh; colliders: Collider[]; descs: ColliderDesc[]; count: number; triangles: number }

export function buildOutcrops(sky: Sky, seed = 0x0c7): Outcrops {
  const kit = new PaintKit(seed);
  const rng = kit.rng;
  const cluster = new Noise2D(seed + 11);
  const colliders: Collider[] = [];
  const descs: ColliderDesc[] = [];
  let count = 0;
  const step = 8;
  for (let gx = -244; gx <= 244; gx += step) for (let gz = RIM_Z - 10; gz <= 160; gz += step) {
    const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    const slope = 1 - ny;
    if (slope < 0.045) continue; // 1 − n.y: 0.045 ≈ 17°, 0.13 ≈ 30°
    const y0 = heightAt(x, z);
    if (y0 < -8.5 || y0 > 46) continue;
    if (trailDistance(x, z) < 7 || riverMask(x, z) > 0 || inPoiClearing(x, z, 4)) continue;
    if (Math.abs(x) > 238 || Math.abs(z) > 238) continue;
    // clustered where the ground paints rock (the def's outcropAt: rock breaking through the turf), grass between
    const c = outcropAt(x, z) * 1.25 - 0.2;
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
    const block = graniteBlock(w, h, d, rng.int(1, 1e6), 0.22), bm = M(x, y, z, yaw, 1, 1, 1, tilt * Math.cos(yaw - downYaw), tilt * Math.sin(yaw - downYaw));
    if (h > 1.1) descs.push(supportHull(block, bm, 'rock'));
    kit.add(block, tint, {
      matrix: bm,
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
    if (trailDistance(x, z) < 8 || inPoiClearing(x, z, 4)) continue;
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    if (1 - ny < 0.04) continue;
    const size = 1.2 + rng.next() * 2.2;
    const w = size * rng.range(1.6, 2.8), h = size * rng.range(0.9, 1.5), d = size * rng.range(1.0, 1.5);
    const downYaw = Math.atan2(nx, nz), yaw = downYaw + Math.PI / 2 + rng.range(-0.25, 0.25);
    const y = heightAt(x, z) - h * 0.3;
    const block = graniteBlock(w, h, d, rng.int(1, 1e6), 0.24), bm = M(x, y, z, yaw, 1, 1, 1, 0.12, 0);
    if (h > 1.1) descs.push(supportHull(block, bm, 'rock'));
    kit.add(block, rng.next() < 0.5 ? C.granite : C.warm, {
      matrix: bm, top: { color: C.lichen, threshold: 0.55, amount: 0.5 }, brush: 0.14, foot: 0.72,
    });
    if (h > 1.1) colliders.push({ x, z, hw: w * 0.42, hd: d * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
    count++;
  }
  // (Snow Lotus Valley's walls are src/nalati/cragRock.ts's: ribs standing against them, sunk into the rock)
  // the river's channels: boulders standing in the current (the white water breaks round them)
  for (let x = -240; x <= 240; x += 7) {
    if (rng.next() > 0.55 || Math.abs(x) < 16) continue;
    const u = rng.range(-0.9, 0.9), bx = x + rng.range(-3, 3), bz = RIVER.z(bx) + u * RIVER.half(bx);
    if (heightAt(bx, bz) > RIVER.level - 0.3) continue; // only where there is water over the bed
    const r = rng.range(0.5, 1.2);
    kit.add(blob(r, rng, 1, 0.65, 0.16), C.cool, { matrix: M(bx, heightAt(bx, bz) + r * 0.2, bz, rng.range(0, 6.28)), brush: 0.1, foot: 0.6 });
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
  // the meltwater stream (Snow Lotus Valley): boulders in its bed that the water runs round, heaped along both banks
  for (let i = 0; i + 1 < BROOK.length; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    for (let d = rng.range(0, 2); d < len; d += rng.range(1.8, 3.6)) {
      const px = a[0] + tx * d, pz = a[1] + tz * d;
      if (trailDistance(px, pz) < 5 || inPoiClearing(px, pz, 1)) continue;
      if (rng.next() < 0.45) {
        const r = rng.range(0.3, 0.75), u = rng.range(-0.9, 0.9);
        const bx = px - tz * u, bz = pz + tx * u;
        kit.add(blob(r, rng, 1, 0.62, 0.2), C.cool, { matrix: M(bx, heightAt(bx, bz) - r * 0.15, bz, rng.range(0, 6.28)), brush: 0.1, foot: 0.55 });
        count++;
      }
      for (const side of [-1, 1]) {
        if (rng.next() > 0.6) continue;
        const r = rng.range(0.45, 1.35), o = side * rng.range(1.9, 4.8);
        const bx = px - tz * o + rng.range(-0.8, 0.8), bz = pz + tx * o + rng.range(-0.8, 0.8);
        const stone = blob(r, rng, 1, 0.7, 0.22), tone = rng.next() < 0.6 ? C.cool : C.granite, sm = M(bx, heightAt(bx, bz) - r * 0.3, bz, rng.range(0, 6.28));
        if (r > 1.0) descs.push(supportHull(stone, sm, 'rock'));
        kit.add(stone, tone, {
          matrix: sm, top: { color: C.snow, threshold: 0.75, amount: 0.25 }, brush: 0.12, foot: 0.65,
        });
        if (r > 1.0) colliders.push({ x: bx, z: bz, hw: r * 0.7, hd: r * 0.7, rot: 0, yBottom: heightAt(bx, bz) - 1, yTop: heightAt(bx, bz) + r * 0.5 });
        count++;
      }
    }
  }
  // N23 (the edge berm): granite breaking out of the edge berm's crest and its steep upper face — clustered, the
  // spruce lines between — so its skyline is rock and trees, and nobody walks up the last metres onto the crest
  for (let s = -CHUNK_HALF + 3; s <= CHUNK_HALF - 3; s += 4.2) {
    for (let side = 0; side < 4; side++) {
      if (cluster.fbm(s * 0.035 + side * 23.1, 5.7, 2) < -0.08 || rng.next() > 0.7) continue;
      const d = rng.range(1.5, 9) ** 1.1;
      const x = side === 0 ? s : side === 1 ? -s : side === 2 ? CHUNK_HALF - d : -CHUNK_HALF + d;
      const z = side === 0 ? CHUNK_HALF - d : side === 1 ? -CHUNK_HALF + d : side === 2 ? -s : s;
      const rise = edgeBermAt(x, z);
      if (rise < 4 || trailDistance(x, z) < 9 || inPoiClearing(x, z, 2)) continue;
      const [nx, ny, nz] = normalAt(x, z, 1.5);
      const size = 1.1 + rng.next() * 2.4 * Math.min(1, rise / 12);
      const w = size * rng.range(1.3, 2.5), h = size * rng.range(0.9, 1.6), dd = size * rng.range(1.0, 1.5);
      const downYaw = Math.atan2(nx, nz), yaw = downYaw + Math.PI / 2 + rng.range(-0.5, 0.5);
      const tilt = Math.min(0.45, Math.acos(Math.min(1, ny)) * 0.5);
      const y = heightAt(x, z) - h * 0.3;
      const block = graniteBlock(w, h, dd, rng.int(1, 1e6), 0.24);
      const bm = M(x, y, z, yaw, 1, 1, 1, tilt * Math.cos(yaw - downYaw), tilt * Math.sin(yaw - downYaw));
      descs.push(supportHull(block, bm, 'rock'));
      const tint = rng.next() < 0.5 ? C.granite : rng.next() < 0.5 ? C.warm : C.cool;
      kit.add(block, tint, { matrix: bm, top: { color: C.lichen, threshold: 0.55, amount: 0.5 }, brush: 0.14, foot: 0.72 });
      colliders.push({ x, z, hw: w * 0.42, hd: dd * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
      count++;
    }
  }
  const triangles = Math.round(kit.triangleCount);
  const mesh = kit.mesh(sky, { ground: heightAt, ao: false, aoH: 0.8, aoMin: 0.6 });
  mesh.name = 'nalati-outcrops';
  return { mesh, colliders, descs, count, triangles };
}
