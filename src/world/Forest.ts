import * as THREE from 'three';
import { CHUNK_HALF, CHUNK_SIZE, TREE_COUNT, SEED } from '../core/config';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep } from '../core/noise';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk, pondMask } from './Heightfield';
import { TreeFactory, windUniforms } from './TreeFactory';
import type { Sky } from './Sky';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from '../core/tier';

export interface TreeInstance { x: number; y: number; z: number; r: number; variant: number; scale: number; rot: number; height: number; tint: THREE.Color }

const LOD_DIST = TIER_CONFIG.treeHiDist;   // metres: beyond this, the low-card geometry
const FAR_DIST = TIER_CONFIG.treeLoDist;   // metres: beyond this, the 2-quad baked impostor
const TWIG_DIST = TIER_CONFIG.treeTwigDist; // metres: within this, individual twig quads are drawn on the branches
const KEEP_NEAR = Math.max(45, TIER_CONFIG.shadowFar * 0.5); // metres: trees this close are never frustum-culled (their shadows reach into view)
const CULL_FOV_PAD = 24;                    // degrees added to the camera FOV for the cull frustum

/**
 * Per-frame bucketing: every tree has one precomputed matrix; on move (> 1.5 m) or turn (> 3°) the
 * buckets are refilled with only the trees inside a padded view frustum (or within KEEP_NEAR), by
 * distance band: hi cards + twigs (near), lo cards, far impostor. Trunks follow the same near/far
 * split so the far half never enters a shadow pass on the phone tier.
 */
export class Forest {
  group = new THREE.Group();
  trees: TreeInstance[] = [];
  private hi: THREE.InstancedMesh[] = [];
  private lo: THREE.InstancedMesh[] = [];
  private far: THREE.InstancedMesh[] = [];
  private trunks: THREE.InstancedMesh[] = [];
  private trunksFar: THREE.InstancedMesh[] = [];
  private twigs: THREE.InstancedMesh[] = [];
  private lastLodPos = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3(0, 0, 0);
  private grid = new Map<string, TreeInstance[]>();
  private mats!: Float32Array;   // 16 floats per tree
  private tints!: Float32Array;  // 3 floats per tree
  private frustum = new THREE.Frustum();
  private cullCam = new THREE.PerspectiveCamera();
  private projView = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private viewDir = new THREE.Vector3();

  constructor(private factory: TreeFactory, private sky: Sky) {}

  /** Soft canopy-density texture (for terrain darkening under trees, and grass thinning). */
  canopyMap!: THREE.DataTexture;

  build() {
    this.place();
    this.canopyMap = this.buildCanopyMap();
    this.sky.setupMaterial(this.factory.barkMaterial);
    this.sky.setupMaterial(this.factory.needleMaterial);
    this.sky.setupMaterial(this.factory.twigMaterial);
    this.sky.setupMaterial(this.factory.farMaterial);
    this.mats = new Float32Array(this.trees.length * 16);
    this.tints = new Float32Array(this.trees.length * 3);
    this.trees.forEach((t, i) => {
      this.tmpQ.setFromAxisAngle(this.tmpP.set(0, 1, 0), t.rot);
      this.tmpM.compose(this.tmpP.set(t.x, t.y, t.z), this.tmpQ, this.tmpS.set(t.scale, t.scale, t.scale));
      this.tmpM.toArray(this.mats, i * 16);
      this.tints[i * 3] = t.tint.r; this.tints[i * 3 + 1] = t.tint.g; this.tints[i * 3 + 2] = t.tint.b;
    });
    this.factory.variants.forEach((v, vi) => {
      const count = this.trees.filter((t) => t.variant === vi).length;
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean, depth?: THREE.Material, tint = true) => {
        const im = new THREE.InstancedMesh(geo, mat, count);
        im.castShadow = shadow; im.receiveShadow = true;
        if (depth) im.customDepthMaterial = depth;
        im.frustumCulled = false; // we do LOD bucketing + per-tree culling ourselves
        im.count = 0;
        if (tint) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(im);
        return im;
      };
      this.trunks.push(mk(v.trunk, this.factory.barkMaterial, true, undefined, false));
      this.trunksFar.push(mk(v.trunk, this.factory.barkMaterial, TIER_CONFIG.loTreeShadows, undefined, false));
      this.hi.push(mk(v.cardsHi, this.factory.needleMaterial, true, this.factory.needleDepth));
      this.lo.push(mk(v.cardsLo, this.factory.needleMaterial, TIER_CONFIG.loTreeShadows, this.factory.needleDepth));
      this.far.push(mk(v.far, this.factory.farMaterial, false));
      this.twigs.push(mk(v.twigs, this.factory.twigMaterial, true, this.factory.twigDepth));
    });
    return this;
  }

  private place() {
    const F = getActiveChunk().forest;
    const rng = new Rng(SEED + 99);
    const density = new Noise2D(SEED + 5);
    const cell = F.spacing; // metres between candidates → ~3400 candidates at 8.5, thinned by density
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
      const d = density.fbm(x * F.densityFreq, z * F.densityFreq, 3); // clearings & dense groves
      const keep = smoothstep(F.clearings[0], F.clearings[1], d) * 0.92 + 0.08;
      if (rng.next() > keep) continue;
      const roadEntry = (Math.abs(x) < 16 && Math.abs(z) > CHUNK_HALF - 95) || (Math.abs(z) < 16 && Math.abs(x) > CHUNK_HALF - 95);
      if (roadEntry) continue;
      if (trailDistance(x, z) < 9 + rng.range(0, 4)) continue;
      if (cabinMask(x, z) > 0.02) continue;
      if (pondMask(x, z) > 0.03) continue;
      const [, ny] = normalAt(x, z);
      if (ny < F.maxSlope) continue;                               // too steep
      const y = heightAt(x, z);
      const variant = rng.next() < F.largeVariantChance ? 3 : rng.int(0, 2);
      const scale = rng.range(0.8, 1.2);
      const v = this.factory.variants[variant];
      const tint = new THREE.Color().setHSL(F.tintHue + rng.range(F.tintHueJitter[0], F.tintHueJitter[1]), rng.range(F.tintSat[0], F.tintSat[1]), rng.range(F.tintLight[0], F.tintLight[1]));
      const t: TreeInstance = { x, y: y - 0.25, z, r: v.trunkRadius * scale + 0.15, variant, scale, rot: rng.range(0, Math.PI * 2), height: v.height * scale, tint };
      this.trees.push(t);
      const k = this.key(x, z);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k)!.push(t);
    }
  }

  private buildCanopyMap() {
    const N = 256, data = new Float32Array(N * N);
    const toCell = (v: number) => ((v + CHUNK_HALF) / CHUNK_SIZE) * N;
    for (const t of this.trees) {
      const r = (t.height * 0.16) / (CHUNK_SIZE / N); // crown radius in cells
      const cx = toCell(t.x), cz = toCell(t.z);
      const R = Math.ceil(r + 1);
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
        const x = Math.round(cx) + i, z = Math.round(cz) + j;
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        const d = Math.hypot(x - cx, z - cz) / r;
        if (d < 1) data[z * N + x] = Math.min(1, data[z * N + x] + (1 - d * d) * 0.7);
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
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
    const cam = this.sky.viewCamera;
    cam.getWorldDirection(this.viewDir);
    const moved = viewer.distanceToSquared(this.lastLodPos) > 1.5 * 1.5;
    const turned = this.viewDir.dot(this.lastDir) < Math.cos(3 * Math.PI / 180);
    if (!moved && !turned) return;
    this.lastLodPos.copy(viewer); this.lastDir.copy(this.viewDir);

    // padded view frustum for culling (the sphere test below is generous already; the pad covers the shadow lead-in)
    const cc = this.cullCam;
    cc.fov = cam.fov + CULL_FOV_PAD; cc.aspect = cam.aspect; cc.near = cam.near; cc.far = cam.far;
    cc.updateProjectionMatrix();
    this.projView.multiplyMatrices(cc.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);

    const V = this.hi.length;
    const nHi = new Int32Array(V), nLo = new Int32Array(V), nFar = new Int32Array(V), nT = new Int32Array(V), nTF = new Int32Array(V), nTw = new Int32Array(V);
    const put = (m: THREE.InstancedMesh, idx: number, i: number, tint: boolean) => {
      (m.instanceMatrix.array as Float32Array).set(this.mats.subarray(i * 16, i * 16 + 16), idx * 16);
      if (tint) (m.instanceColor!.array as Float32Array).set(this.tints.subarray(i * 3, i * 3 + 3), idx * 3);
    };
    const hiD2 = LOD_DIST * LOD_DIST, farD2 = FAR_DIST * FAR_DIST, twD2 = TWIG_DIST * TWIG_DIST, keepD2 = KEEP_NEAR * KEEP_NEAR;
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      const dx = t.x - viewer.x, dz = t.z - viewer.z, d2 = dx * dx + dz * dz;
      if (d2 > keepD2) {
        this.sphere.center.set(t.x, t.y + t.height * 0.5, t.z); this.sphere.radius = t.height * 0.6;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
      }
      const v = t.variant;
      if (d2 < hiD2) {
        put(this.hi[v], nHi[v]++, i, true);
        put(this.trunks[v], nT[v]++, i, false);
        if (d2 < twD2) put(this.twigs[v], nTw[v]++, i, true);
      } else if (d2 < farD2) {
        put(this.lo[v], nLo[v]++, i, true);
        put(this.trunksFar[v], nTF[v]++, i, false);
      } else {
        put(this.far[v], nFar[v]++, i, true);
      }
    }
    const commit = (list: THREE.InstancedMesh[], counts: Int32Array) => list.forEach((m, i) => {
      m.count = counts[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    commit(this.hi, nHi); commit(this.lo, nLo); commit(this.far, nFar); commit(this.trunks, nT); commit(this.trunksFar, nTF); commit(this.twigs, nTw);
  }
}
