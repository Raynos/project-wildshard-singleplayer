import * as THREE from 'three';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { smoothstep } from '../core/noise';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk, CABIN_SITES, TRAILS } from './Heightfield';
import { loadLod, prepModel } from './Cabin';
import type { Sky } from './Sky';
import { noReflect } from './Water';
import type { Forest } from './Forest';
import type { Collider } from '../player/Player';
import { CulledInstances, CulledBatch } from './Culling';
import { TIER_CONFIG } from '../core/tier';

/**
 * Forest props: mossy boulders, cut stumps, fallen logs and a few low bushes around the cabins.
 *
 *   const props = new Props(sky, forest);
 *   scene.add(await props.build());
 *   player.colliders.push(...props.colliders);   // large boulders only
 *
 * Everything is an InstancedMesh (one per glTF primitive — 6 boulder shapes, 1 stump, 1 trunk,
 * 1 bush = 9 draw calls) built from the meshoptimizer-simplified `<id>_lod.glb` photoscans
 * (see scripts/simplify-models.mjs). Placement is deterministic (Rng(SEED+…)), follows the
 * terrain normal, sinks into the ground, avoids tree trunks via `forest.nearby`, keeps off the
 * trails (trailDistance > 4 for logs) and out of the cabin pads (cabinMask < 0.2, stumps excepted).
 */

export class Props {
  group = new THREE.Group();
  colliders: Collider[] = [];
  counts = { rocks: 0, stumps: 0, logs: 0, bushes: 0 };
  withBushes = false;

  constructor(private sky: Sky, private forest: Forest) {}

  async build(): Promise<THREE.Group> {
    const [rocks, stump, trunk] = await Promise.all([loadLod('rock_moss_set_01'), loadLod('tree_stump_01'), loadLod('dead_tree_trunk')]);
    this.rocks(prepModel(rocks.scene, this.sky));
    this.stumps(prepModel(stump.scene, this.sky));
    this.logs(prepModel(trunk.scene, this.sky));
    // bushes: implemented but off by default — low-poly clumps read as blobs next to the photoscans
    if (this.withBushes) this.bushes();
    if (!TIER_CONFIG.reflectDetail) noReflect(this.group);
    return this.group;
  }

  /** a random point on a random trail segment */
  private trailPoint(rng: Rng): [number, number] {
    const poly = rng.pick(TRAILS), i = rng.int(0, poly.length - 2), t = rng.next();
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) throw new Error('[props] trail polyline shorter than 2 points');
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  private treeFree(x: number, z: number, r: number) {
    for (const t of this.forest.nearby(x, z, r)) if (Math.hypot(t.x - x, t.z - z) < t.r + r) return false;
    return true;
  }

  /** one draw call per shape, but only the instances in the padded view frustum / within range are live (see Culling.ts) */
  private instanced(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], local: THREE.Matrix4) {
    if (matrices.length === 0) return;
    const im = new THREE.InstancedMesh(geometry, material, matrices.length);
    im.castShadow = true; im.receiveShadow = true;
    geometry.computeBoundingSphere();
    const bs = geometry.boundingSphere;
    if (!bs) throw new Error('[props] no bounding sphere');
    const tmp = new THREE.Matrix4(), c = new THREE.Vector3(), sc = new THREE.Vector3();
    const all = new Float32Array(matrices.length * 16), bounds = new Float32Array(matrices.length * 4);
    matrices.forEach((m, i) => {
      tmp.multiplyMatrices(m, local); tmp.toArray(all, i * 16);
      c.copy(bs.center).applyMatrix4(tmp); sc.setFromMatrixScale(tmp);
      bounds[i * 4] = c.x; bounds[i * 4 + 1] = c.y; bounds[i * 4 + 2] = c.z; bounds[i * 4 + 3] = bs.radius * Math.max(sc.x, sc.y, sc.z);
    });
    const culled = new CulledInstances(im, all, bounds, TIER_CONFIG.propsFar, 40, TIER_CONFIG.propsMinAngular);
    this.forest.onViewChange((f, v) => culled.cull(f, v));
    this.group.add(im);
  }

  /** compose a matrix that sits an object on the terrain, aligned to the normal, yawed and scaled */
  private static place(x: number, z: number, yaw: number, scale: number, sink: number, tilt = 1, out = new THREE.Matrix4()) {
    const [nx, ny, nz] = normalAt(x, z, 1.0);
    const up = new THREE.Vector3(nx, ny, nz).lerp(new THREE.Vector3(0, 1, 0), 1 - tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    return out.compose(new THREE.Vector3(x, heightAt(x, z) - sink, z), q, new THREE.Vector3(scale, scale, scale));
  }

  // ── boulders: 6 shapes from rock_moss_set_01, recentred so each sits on its own base ──
  private rocks(parts: ReturnType<typeof prepModel>) {
    const rng = new Rng(SEED + 201);
    const shapes = parts.map((p) => {
      const g = p.geometry;
      g.computeBoundingBox();
      const bb = g.boundingBox, c = new THREE.Vector3();
      if (!bb) throw new Error('[props] no bounding box');
      bb.getCenter(c);
      const local = new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z); // centred, base on y=0
      const radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
      const height = bb.max.y - bb.min.y;
      return { ...p, local, radius, height, mats: [] as THREE.Matrix4[] };
    });
    let n = 0, tries = 0;
    while (n < 380 && tries++ < 30000) {
      // half the boulders line the trails (where the player actually walks), the rest follow the slopes
      let x: number, z: number;
      const nearTrail = rng.next() < 0.5;
      if (nearTrail) { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(3.5, 16); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      else { x = rng.range(-244, 244); z = rng.range(-244, 244); }
      if (!inChunk(x, z, 6) || cabinMask(x, z) > 0.2) continue;
      const td = trailDistance(x, z);
      if (td < 3) continue;
      const [, ny] = normalAt(x, z, 1.0);
      const slope = 1 - ny;
      // rocks favour slopes and the rocky ridges; a sprinkle everywhere
      if (!nearTrail && rng.next() > 0.18 + 0.82 * smoothstep(0.04, 0.3, slope)) continue;
      const shape = rng.pick(shapes);
      // log-distributed size: mostly knee-high, a few car-sized
      const scale = Math.exp(rng.range(Math.log(0.3), Math.log(1.7)));
      const r = shape.radius * scale;
      if (!this.treeFree(x, z, r * 0.6)) continue;
      if (td < r + 2) continue;
      const sink = shape.height * scale * (0.18 + 0.35 * smoothstep(0.05, 0.3, slope) + rng.range(0, 0.1));
      shape.mats.push(Props.place(x, z, rng.range(0, Math.PI * 2), scale, sink, 0.85));
      const above = shape.height * scale - sink;                  // height showing above ground
      if (above > 1.0) this.colliders.push({ x, z, hw: r * 0.6, hd: r * 0.6, rot: 0, yTop: heightAt(x, z) + above, yBottom: heightAt(x, z) - 1 });
      n++;
    }
    const mat0 = shapes[0]?.material;
    if (this.forest.path === 'batched' && mat0 !== undefined && shapes.every((s) => s.material === mat0)) {
      // one BatchedMesh for the six shapes (they share the photoscan's material): 1 draw + 1 shadow draw instead of 6 + 6
      const placements: { shape: number; matrix: THREE.Matrix4 }[] = [];
      shapes.forEach((s, k) => { for (const m of s.mats) placements.push({ shape: k, matrix: new THREE.Matrix4().multiplyMatrices(m, s.local) }); });
      const batch = new CulledBatch(shapes.map((s) => s.geometry), mat0, placements, TIER_CONFIG.propsFar, 40, TIER_CONFIG.propsMinAngular);
      batch.mesh.castShadow = true; batch.mesh.receiveShadow = true;
      this.forest.onViewChange((f, v) => batch.cull(f, v));
      this.group.add(batch.mesh);
    } else for (const s of shapes) this.instanced(s.geometry, s.material, s.mats, s.local);
    this.counts.rocks = n;
  }

  // ── stumps: along the trails and around the cabins, as if cut for firewood ──
  private stumps(parts: ReturnType<typeof prepModel>) {
    const rng = new Rng(SEED + 202);
    const mats: THREE.Matrix4[] = [];
    let tries = 0;
    while (mats.length < 70 && tries++ < 20000) {
      let x: number, z: number;
      if (rng.next() < 0.4) {
        const c = rng.pick(CABIN_SITES);
        const a = rng.range(0, Math.PI * 2), d = rng.range(9, 22);
        x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      } else { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(3.5, 14); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      if (!inChunk(x, z, 6)) continue;
      const td = trailDistance(x, z);
      if (td < 3.5 || (td > 14 && cabinMask(x, z) < 0.02)) continue;
      if (cabinMask(x, z) > 0.75) continue;                       // not on the pad itself
      const [, ny] = normalAt(x, z, 1.0);
      if (ny < 0.8) continue;
      if (!this.treeFree(x, z, 1.2)) continue;
      const scale = rng.range(0.8, 1.35);
      mats.push(Props.place(x, z, rng.range(0, Math.PI * 2), scale, 0.06 * scale, 0.7));
    }
    for (const p of parts) this.instanced(p.geometry, p.material, mats, p.matrix);
    this.counts.stumps = mats.length;
  }

  // ── fallen logs: lying along the slope, near trail edges but never on them ──
  private logs(parts: ReturnType<typeof prepModel>) {
    const rng = new Rng(SEED + 203);
    const mats: THREE.Matrix4[] = [];
    const p0 = parts[0];
    if (!p0) throw new Error('[props] dead_tree_trunk has no parts');
    p0.geometry.computeBoundingBox();
    const bb = p0.geometry.boundingBox;
    if (!bb) throw new Error('[props] no bounding box');
    const halfLen = (bb.max.x - bb.min.x) / 2, bottom = bb.min.y;
    let tries = 0;
    while (mats.length < 55 && tries++ < 30000) {
      let x: number, z: number;
      if (rng.next() < 0.7) { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(4.5, 12); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      else { x = rng.range(-240, 240); z = rng.range(-240, 240); }
      if (!inChunk(x, z, 7) || cabinMask(x, z) > 0.2) continue;
      const td = trailDistance(x, z);
      if (td < 4.5) continue;
      const [nx, ny, nz] = normalAt(x, z, 1.0);
      if (ny < 0.75) continue;
      const scale = rng.range(1.1, 1.8), hl = halfLen * scale;
      // orientation: mostly along the fall line, some random
      const yaw = rng.next() < 0.6 ? Math.atan2(-nz, nx) + rng.range(-0.5, 0.5) : rng.range(0, Math.PI * 2);
      const dx = Math.cos(yaw), dz = -Math.sin(yaw);               // local +X after yaw
      const ax = x + dx * hl, az = z + dz * hl, bx = x - dx * hl, bz = z - dz * hl;
      if (trailDistance(ax, az) < 4 || trailDistance(bx, bz) < 4) continue;
      if (!this.treeFree(x, z, 0.5) || !this.treeFree(ax, az, 0.4) || !this.treeFree(bx, bz, 0.4)) continue;
      // lie along the ground: pitch from the end heights, roll random
      const ya = heightAt(ax, az), yb = heightAt(bx, bz);
      // a log bridges concave ground on its ends and balances on convex ground in the middle: rest on the higher of the two
      const ym = Math.max((ya + yb) / 2, heightAt(x, z), (heightAt((x + ax) / 2, (z + az) / 2) + heightAt((x + bx) / 2, (z + bz) / 2)) / 2);
      const pitch = Math.atan2(ya - yb, 2 * hl);            // Rz(+pitch) lifts the +X end
      // roll happens around the log axis (local X): apply after yaw+pitch
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rng.range(0, Math.PI * 2));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ')).multiply(qRoll);
      // the terrain mesh is ~2 m per vertex, so lift thin logs a little above the analytic height rather than let them sink
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, ym - bottom * scale + 0.14 * scale, z), q, new THREE.Vector3(scale, scale, scale)));
    }
    for (const p of parts) this.instanced(p.geometry, p.material, mats, p.matrix);
    this.counts.logs = mats.length;
  }

  // ── low bushes near the cabins: clumps of dark needle-ish spheres, kept subtle ──
  private bushes() {
    const rng = new Rng(SEED + 204);
    const clump: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const r = rng.range(0.28, 0.5);
      const s = new THREE.IcosahedronGeometry(r, 2);
      // roughen the surface a little so it doesn't read as a perfect sphere
      const pos = s.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const f = 1 + (rng.next() - 0.5) * 0.28;
        pos.setXYZ(k, pos.getX(k) * f, pos.getY(k) * f * 0.75, pos.getZ(k) * f);
      }
      s.translate(rng.range(-0.45, 0.45), r * 0.55 + rng.range(-0.05, 0.05), rng.range(-0.45, 0.45));
      clump.push(s.toNonIndexed());
    }
    const geo = clump.reduce((a, b) => { const m = new THREE.BufferGeometry(); const A = a.getAttribute('position').array as Float32Array, B = b.getAttribute('position').array as Float32Array; const P = new Float32Array(A.length + B.length); P.set(A); P.set(B, A.length); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); return m; });
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1f3a1c, roughness: 1, metalness: 0, flatShading: true });
    this.sky.setupMaterial(mat);
    const mats: THREE.Matrix4[] = [];
    for (const c of CABIN_SITES) {
      let placed = 0, tries = 0;
      while (placed < 9 && tries++ < 300) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(7, 16);
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (trailDistance(x, z) < 3.5 || !this.treeFree(x, z, 1.0)) continue;
        mats.push(Props.place(x, z, rng.range(0, Math.PI * 2), rng.range(0.7, 1.3), 0.1, 0.5));
        placed++;
      }
    }
    this.instanced(geo, mat, mats, new THREE.Matrix4());
    this.counts.bushes = mats.length;
  }
}
