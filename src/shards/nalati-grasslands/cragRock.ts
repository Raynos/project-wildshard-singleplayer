/**
 * The snow ring's crag rock (layout v2, docs/design/nalati/layout-v2.md; the crags pass): the terrain gives the massifs
 * their arêtes, couloirs and strata (the chunk def's `crags`), this gives them a jagged silhouette and vertical faces
 * a 2 m height grid cannot carry — real faceted granite, not cards:
 *
 *   fins     blade-like towers standing ON the crests, long axis along the ridge (a serrated skyline from the bowl, the
 *            valley and the air), 5–18 m tall, sunk well into the ridge so no base shows
 *   ribs     buttresses standing AGAINST the steepest faces and the valley walls, long axis down the fall line, their
 *            tops just proud of the slope above — vertical walls with deep shadowed clefts between them
 *   blocks   squat broken towers on the steep shoulders lower down, where the crags rise out of the scree
 *
 * Every piece is a stack of jittered polygon rings (5–7 sides) tapering to a split crown, with a stepped ledge or two
 * (the strata — snow lies on them), flat-shaded. Merged into four meshes (one per quadrant of the ring, so the frustum
 * culls what is behind you) on one painterly material that paints them like the terrain's granite: the painted rock
 * texture triplanar in world space, vertical fractures and strata bands, snow on every face that looks up above the
 * snow line, blue in the shade. Placed from the terrain alone (seeded, deterministic): off the roads, the stream, the
 * POI clearings, the glacier and the ledges' spots.
 *
 *   const crags = buildCragRock(sky);   scene.add(crags.group);   await crags.register(registry, ctx, yieldTask);
 *   (the boot: `await buildCragRockSliced(sky, slicer(30).due)`, the same ring a slice at a time — SF67)
 *   (NALATI-MERGE P1: every fin, rib and tower as the hull of what it draws — the fins and ribs had no collision before)
 *
 * E306 / E315 second pass: the pieces are the crag rock model (src/shards/nalati-grasslands/models/cragRock.ts: the
 * fin, the rib, the tower, and their material), drawn from this placer's one rng stream in the old order (so the ring
 * is bit-identical) and placed `drawnInto` the four quadrant meshes; this file keeps where they stand.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D, smoothstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import type { ModelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { trailDistance } from '@wildshard/engine/world/Heightfield';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { inPoiClearing } from './world/clearings';
import { isPhoneTier } from './look/nalatiTextures';
import { LEOPARD_CAVE, ARGYMAQ_PASTURE, SNOW_LOTUS, WATCHTOWER } from './layout';
import { zoneAt, glacierMask, brookMask } from './world/terrain';
import { supportHull } from './world/solid';
import { cragRock, cragMaterial, finGeometry, ribGeometry, towerGeometry, type CragKind } from './models/cragRock';

export interface CragRock {
  group: THREE.Group; colliders: Collider[]; descs: ColliderDesc[]; count: { fins: number; ribs: number; blocks: number }; triangles: number;
  /** its pieces into the world registry (their hulls 150 a task: the phone's per-task collider budget) */
  register: (registry: WorldRegistry, ctx: ModelContext, yieldTask: () => Promise<void>) => Promise<readonly Placed[]>;
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────────────────────

const RING = 7; // the crest test's radius (m)

export function buildCragRock(sky: Sky, seed = 0xc4a9): CragRock {
  const steps = cragRockSteps(sky, seed);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}

/** `buildCragRock`, a task apart whenever `due` says the task is over budget (SF67: one ~180 ms task at 4x CPU); the same
 *  pieces from the same rng stream in the same order */
export async function buildCragRockSliced(sky: Sky, due: () => Promise<void> | null, seed = 0xc4a9): Promise<CragRock> {
  const steps = cragRockSteps(sky, seed);
  for (;;) {
    const step = steps.next(); if (step.done === true) return step.value;
    const pause = due(); if (pause !== null) await pause;
  }
}

function* cragRockSteps(sky: Sky, seed: number): Generator<void, CragRock> {
  const rng = new Rng(seed), jitter = new Noise2D(seed + 3);
  const colliders: Collider[] = [];
  const descs: ColliderDesc[] = [];
  const count = { fins: 0, ribs: 0, blocks: 0 };
  // four quadrant buckets (east / west × north / south of z = −110), each one mesh
  const parts: THREE.BufferGeometry[][] = [[], [], [], []];
  const occ = new Map<number, { x: number; z: number; r: number }[]>();
  const key = (x: number, z: number): number => (Math.floor(x / 12) + 64) * 1024 + Math.floor(z / 12) + 64;
  const free = (x: number, z: number, r: number): boolean => {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of occ.get(key(x + a * 12, z + b * 12)) ?? []) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
    return true;
  };
  const claim = (x: number, z: number, r: number): void => { const k = key(x, z); const l = occ.get(k) ?? []; l.push({ x, z, r }); occ.set(k, l); };
  // keep-outs: the cave, Argymaq's bench, the snow lotus, the watchtower's rock (their own agents dress them)
  const keepOut: [number, number, number][] = [[LEOPARD_CAVE.x, LEOPARD_CAVE.z, 22], [ARGYMAQ_PASTURE.x, ARGYMAQ_PASTURE.z, 34], [WATCHTOWER.x, WATCHTOWER.z, 22], ...SNOW_LOTUS.map((l): [number, number, number] => [l.x, l.z, l.r + 6])];
  const blocked = (x: number, z: number, r: number): boolean =>
    Math.abs(x) > 246 || Math.abs(z) > 246 || trailDistance(x, z) < 9 + r || inPoiClearing(x, z, 4 + r) || glacierMask(x, z) > 0.02 || brookMask(x, z) > 0 ||
    keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + r);
  const col = (): THREE.Color => new THREE.Color().setScalar(rng.range(0.3, 0.4)).offsetHSL(0, 0, 0).add(new THREE.Color(0, 0.004, 0.02));

  // the pieces placed (the crag rock model's copies): where each stands, its kind, its world box
  const placements: { x: number; y: number; z: number; variant: CragKind }[] = [];
  const boxes: number[] = [];
  const box = new THREE.Box3();
  const add = (kind: CragKind, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void => {
    const c = col();
    const n = g.getAttribute('position').count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    descs.push(supportHull(g, null, 'rock', true));
    g.computeBoundingBox();
    const b = g.boundingBox ?? box;
    placements.push({ x, y, z, variant: kind });
    boxes.push(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
    parts[(x < 0 ? 0 : 1) + (z < -110 ? 2 : 0)]?.push(g);
  };
  const lowest = (x: number, z: number, r: number): number => {
    let lo = heightAt(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; lo = Math.min(lo, heightAt(x + Math.cos(t) * r, z + Math.sin(t) * r)); }
    return lo;
  };

  const phone = isPhoneTier();
  const step = 4.5;
  for (let gx = -246; gx <= 246; gx += step) {
    yield; // a column of the grid at a time (the yield draws nothing)
    for (let gz = -246; gz <= 60; gz += step) {
      const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
      const roll = rng.next();
      const zs = zoneAt(x, z)[2];
      if (zs < 0.55) continue;
      const h = heightAt(x, z);
      if (h < 6) continue;
      // the local shape: the mean of a ring round the point (a crest stands above it), the gradient
      let sum = 0, bestPair = -Infinity, ridgeYaw = 0;
      const around: number[] = [];
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; const v = heightAt(x + Math.cos(t) * RING, z + Math.sin(t) * RING); around.push(v); sum += v; }
      for (let k = 0; k < 4; k++) { const pair = (around[k] ?? 0) + (around[k + 4] ?? 0); if (pair > bestPair) { bestPair = pair; ridgeYaw = -(k / 8) * Math.PI * 2; } }
      const crest = h - sum / 8;
      const gxh = heightAt(x + 1.5, z) - heightAt(x - 1.5, z), gzh = heightAt(x, z + 1.5) - heightAt(x, z - 1.5);
      const grad = Math.hypot(gxh, gzh) / 3; // rise per metre
      const downYaw = Math.atan2(-gxh, -gzh); // three.js yaw whose local +z points downhill … (sin, cos) of the fall line
      const dens = 0.55 + 0.45 * smoothstep(-0.3, 0.4, jitter.fbm(x * 0.02, z * 0.02, 2));
  
      const band = smoothstep(-0.1, 0.35, jitter.fbm(x * 0.017 + 9, z * 0.017 - 5, 3)); // where the cliff bands run
  
      if (crest > 1.6 && h > 46 && roll < 0.2 * dens * (phone ? 0.75 : 1)) {
        // ── a fin on the crest: a broad castellated tower, long axis along the ridge ──
        const hh = rng.range(3, 6) + smoothstep(50, 110, h) * rng.range(2, 6) + Math.min(4, crest * 0.5);
        const w = rng.range(7, 14), d = rng.range(4, 7.5);
        if (blocked(x, z, w * 0.5) || !free(x, z, w * 0.42)) continue;
        claim(x, z, w * 0.42);
        const base = lowest(x, z, w * 0.4) - 1.2;
        add('fin', finGeometry(rng, w, d, hh + (h - base)), x, base, z, ridgeYaw + rng.range(-0.2, 0.2), rng.range(-0.05, 0.05), rng.range(-0.06, 0.06));
        count.fins++;
      } else if (grad > 0.8 && roll < (0.15 + 0.85 * band) * 0.65 * (phone ? 0.75 : 1)) {
        // ── a rib against a steep face (≥ ~39°), long axis down the fall line, its top just proud of the slope above: side
        //    by side where a cliff band runs they make one vertical wall with clefts between the buttresses ──
        const len = rng.range(5, 10), thick = rng.range(3.5, 6.5);
        if (blocked(x, z, thick * 0.6) || !free(x, z, thick * 0.42)) continue;
        claim(x, z, thick * 0.42);
        const ux = x - Math.sin(downYaw) * len * 0.45, uz = z - Math.cos(downYaw) * len * 0.45;
        const topY = heightAt(ux, uz) + rng.range(0.3, 1.8) + band * 1.2;
        const base = lowest(x, z, len * 0.5) - 1.5;
        if (topY - base < 4) continue;
        // its top slants down the fall line with the face (a rib, not a flat-topped block), the downhill end still a
        // sheer drop
        add('rib', ribGeometry(rng, thick, len, topY - base, grad), x, base, z, downYaw + rng.range(-0.12, 0.12), 0, 0);
        count.ribs++;
      } else if (grad > 0.5 && grad <= 0.8 && h > 32 && roll > 0.95 - 0.04 * dens) {
        // ── a broken tower on a steep shoulder ──
        const sz = rng.range(4, 8);
        if (blocked(x, z, sz * 0.6) || !free(x, z, sz * 0.6)) continue;
        claim(x, z, sz * 0.6);
        const base = lowest(x, z, sz * 0.5) - 1;
        const top = h + rng.range(2.5, 6);
        add('tower', towerGeometry(rng, sz, top - base), x, base, z, rng.range(0, Math.PI * 2), 0, 0);
        if (grad < 0.7) colliders.push({ x, z, hw: sz * 0.4, hd: sz * 0.3, rot: 0, yBottom: base, yTop: top });
        count.blocks++;
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'nalati-crag-rock';
  const mat = cragMaterial(sky);
  let triangles = 0;
  for (const [i, list] of parts.entries()) {
    if (list.length === 0) continue;
    yield;
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    triangles += geo.getAttribute('position').count / 3;
    const m = new THREE.Mesh(geo, mat);
    m.name = `nalati-crag-rock-${i}`;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return {
    group, colliders, descs, count, triangles: Math.round(triangles),
    register: async (registry, ctx, yieldTask) => {
      const placed = place(cragRock, placements, {
        ctx, draw: 'merged', registry, drawnInto: { object: group, boxes: Float32Array.from(boxes), colliders: descs },
        piece: { solidFloor: true, split: { every: 150, yieldTask } },
      });
      await placed.registered;
      return [placed];
    },
  };
}
