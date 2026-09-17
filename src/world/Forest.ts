import * as THREE from 'three';
import { CHUNK_HALF, TREE_COUNT, SEED } from '../core/config';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep } from '../core/noise';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk } from './Heightfield';
import { TreeFactory, windUniforms } from './TreeFactory';
import type { Sky } from './Sky';

export interface TreeInstance { x: number; y: number; z: number; r: number; variant: number; scale: number; rot: number; height: number }

const LOD_DIST = 110; // metres: beyond this, use the low-card geometry

export class Forest {
  group = new THREE.Group();
  trees: TreeInstance[] = [];
  private hi: THREE.InstancedMesh[] = [];
  private lo: THREE.InstancedMesh[] = [];
  private trunks: THREE.InstancedMesh[] = [];
  private lastLodPos = new THREE.Vector3(1e9, 0, 0);
  private grid = new Map<string, TreeInstance[]>();

  constructor(private factory: TreeFactory, private sky: Sky) {}

  build() {
    this.place();
    this.sky.setupMaterial(this.factory.barkMaterial);
    this.sky.setupMaterial(this.factory.needleMaterial);
    this.factory.variants.forEach((v, vi) => {
      const count = this.trees.filter((t) => t.variant === vi).length;
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, depth?: THREE.Material) => {
        const im = new THREE.InstancedMesh(geo, mat, count);
        im.castShadow = true; im.receiveShadow = true;
        if (depth) im.customDepthMaterial = depth;
        im.frustumCulled = false; // we do LOD bucketing ourselves; culling a whole InstancedMesh is pointless
        im.count = 0;
        this.group.add(im);
        return im;
      };
      this.trunks.push(mk(v.trunk, this.factory.barkMaterial));
      this.hi.push(mk(v.cardsHi, this.factory.needleMaterial, this.factory.needleDepth));
      this.lo.push(mk(v.cardsLo, this.factory.needleMaterial, this.factory.needleDepth));
    });
    return this;
  }

  private place() {
    const rng = new Rng(SEED + 99);
    const density = new Noise2D(SEED + 5);
    const cell = 8.5; // metres between candidates → ~3400 candidates, thinned by density
    const half = CHUNK_HALF - 6;
    const candidates: [number, number][] = [];
    for (let x = -half; x < half; x += cell) for (let z = -half; z < half; z += cell) {
      candidates.push([x + rng.range(-cell * 0.45, cell * 0.45), z + rng.range(-cell * 0.45, cell * 0.45)]);
    }
    // shuffle so thinning is unbiased
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }

    for (const [x, z] of candidates) {
      if (this.trees.length >= TREE_COUNT) break;
      if (!inChunk(x, z, 4)) continue;
      const d = density.fbm(x * 0.008, z * 0.008, 3);            // clearings & dense groves
      const keep = smoothstep(-0.45, 0.35, d) * 0.92 + 0.08;
      if (rng.next() > keep) continue;
      if (trailDistance(x, z) < 7 + rng.range(0, 3)) continue;
      if (cabinMask(x, z) > 0.02) continue;
      const [, ny] = normalAt(x, z);
      if (ny < 0.72) continue;                                     // too steep
      const y = heightAt(x, z);
      const variant = rng.next() < 0.1 ? 3 : rng.int(0, 2);
      const scale = rng.range(0.8, 1.2);
      const v = this.factory.variants[variant];
      const t: TreeInstance = { x, y: y - 0.25, z, r: v.trunkRadius * scale + 0.15, variant, scale, rot: rng.range(0, Math.PI * 2), height: v.height * scale };
      this.trees.push(t);
      const k = this.key(x, z);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k)!.push(t);
    }
  }

  private key(x: number, z: number) { return `${Math.floor(x / 16)},${Math.floor(z / 16)}`; }

  /** trees whose trunk might intersect a circle at (x,z) — for collision */
  nearby(x: number, z: number, radius = 2): TreeInstance[] {
    const out: TreeInstance[] = [];
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.grid.get(`${cx + i},${cz + j}`);
      if (list) for (const t of list) if (Math.hypot(t.x - x, t.z - z) < radius + t.r + 3) out.push(t);
    }
    return out;
  }

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpP = new THREE.Vector3();
  private tmpS = new THREE.Vector3();

  update(dt: number, viewer: THREE.Vector3) {
    windUniforms.uTime.value += dt;
    if (viewer.distanceToSquared(this.lastLodPos) < 6 * 6) return;
    this.lastLodPos.copy(viewer);
    const counts = this.hi.map(() => 0), countsLo = this.lo.map(() => 0), countsT = this.trunks.map(() => 0);
    for (const t of this.trees) {
      const dx = t.x - viewer.x, dz = t.z - viewer.z;
      const near = dx * dx + dz * dz < LOD_DIST * LOD_DIST;
      const target = near ? this.hi[t.variant] : this.lo[t.variant];
      const idx = near ? counts[t.variant]++ : countsLo[t.variant]++;
      this.tmpQ.setFromAxisAngle(this.tmpP.set(0, 1, 0), t.rot);
      this.tmpM.compose(this.tmpP.set(t.x, t.y, t.z), this.tmpQ, this.tmpS.set(t.scale, t.scale, t.scale));
      target.setMatrixAt(idx, this.tmpM);
      this.trunks[t.variant].setMatrixAt(countsT[t.variant]++, this.tmpM);
    }
    this.hi.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    this.lo.forEach((m, i) => { m.count = countsLo[i]; m.instanceMatrix.needsUpdate = true; });
    this.trunks.forEach((m, i) => { m.count = countsT[i]; m.instanceMatrix.needsUpdate = true; });
  }
}
