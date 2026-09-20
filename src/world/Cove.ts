/**
 * Cove — Wreck Cove's dressing (Driftwood Isle, plan rows C9): tidepools among rock rims on the cove flats (flat dark-blue
 * discs with a moving ripple, starfish on the rocks), a cascade down the crag face behind the wreck with a plunge pool,
 * and a cave mouth in the crag foot beside it with a warm ember glow inside (an emissive back wall + one point light).
 * Four draw calls (rocks + starfish + cave, pools, the cascade, the glow) and no textures.
 *
 *   const cove = new Cove(sky).build(Cove.forIsland());
 *   scene.add(cove.group); player.colliders.push(...cove.colliders);
 *   game.onUpdate((dt) => cove.update(dt));
 *   enemies: new Enemies(animals, { crabSites: cove.crabSites, … })   // the tidepool groups the Reef Crabs live at
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface CoveSpec {
  pools: { x: number; z: number; r: number }[];
  /** where the crab groups sit (a pool each) */
  crabSites: { x: number; z: number }[];
  /** the cascade: top and foot of the fall (world), width */
  fall: { top: [number, number]; foot: [number, number]; width: number };
  /** the cave mouth in the crag foot: position, facing (yaw of the opening), size */
  cave: { x: number; z: number; yaw: number; w: number; h: number; depth: number };
}

const C = {
  rock: new THREE.Color('#4c5058'), rockDark: new THREE.Color('#33363c'), rockWet: new THREE.Color('#3d4a52'),
  star: new THREE.Color('#e8622a'), starPurple: new THREE.Color('#6b3fa0'), caveIn: new THREE.Color('#141214'), ember: new THREE.Color('#ff8a2a'),
};

export class Cove {
  group = new THREE.Group();
  colliders: Collider[] = [];
  crabSites: { x: number; z: number }[] = [];
  private uniforms = { uTime: { value: 0 } };
  private glow!: THREE.PointLight;
  private emberMat!: THREE.MeshBasicMaterial;
  private t = 0;

  constructor(private sky: Sky) {}

  /** the island layout: pools on the cove flats east of the crag, the cascade + cave at the crag foot north-west of the wreck */
  static forIsland(): CoveSpec {
    return {
      pools: [
        { x: 138, z: 12, r: 2.3 }, { x: 143, z: 17, r: 1.5 }, { x: 134, z: 15, r: 1.2 },
        { x: 133, z: -8, r: 2.1 }, { x: 128, z: -13, r: 1.4 }, { x: 137, z: -3, r: 1.1 },
      ],
      crabSites: [{ x: 139, z: 13 }, { x: 132, z: -9 }],
      fall: { top: [120.5, 24.5], foot: [127.5, 18], width: 1.7 },
      cave: { x: 122.6, z: 17.2, yaw: -0.9, w: 2.6, h: 2.6, depth: 3.4 },
    };
  }

  build(spec: CoveSpec): this {
    const rng = new Rng(SEED ^ 0xc0e5);
    this.crabSites = spec.crabSites;
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.1, darkDown = true) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const p = ni.getAttribute('position');
      const n = p.count, c = new Float32Array(n * 3);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nrm = new THREE.Vector3(), col3 = new THREE.Color();
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
        nrm.copy(b).sub(a).cross(d.sub(a)).normalize();
        col3.copy(col).multiplyScalar(1 - jitter + rng.next() * jitter * 2);
        if (darkDown && nrm.y < -0.2) col3.multiplyScalar(0.7);
        for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col3.r; c[(i + j) * 3 + 1] = col3.g; c[(i + j) * 3 + 2] = col3.b; }
      }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };
    const rock = (x: number, z: number, r: number, y?: number, col = C.rock) => {
      const g = new THREE.IcosahedronGeometry(r, 0);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rng.range(0.75, 1.25), p.getY(i) * rng.range(0.5, 0.8), p.getZ(i) * rng.range(0.75, 1.25));
      g.rotateY(rng.range(0, 6.28));
      g.translate(x, (y ?? heightAt(x, z)) + r * 0.25, z);
      add(g, col, 0.12);
    };
    const starfish = (x: number, y: number, z: number, r: number, col: THREE.Color) => {
      const v: number[] = [];
      const rot = rng.range(0, 6.28);
      for (let k = 0; k < 5; k++) {
        const a0 = rot + (k / 5) * Math.PI * 2, a1 = a0 + Math.PI / 5, a2 = a0 + (2 * Math.PI) / 5;
        // each arm: a thin kite from the centre hub out to a tip, raised in the middle
        const tipX = x + Math.cos(a0) * r, tipZ = z + Math.sin(a0) * r;
        const lx = x + Math.cos(a1) * r * 0.35, lz = z + Math.sin(a1) * r * 0.35, rx = x + Math.cos(a0 - Math.PI / 5) * r * 0.35, rz = z + Math.sin(a0 - Math.PI / 5) * r * 0.35;
        v.push(x, y + r * 0.22, z, rx, y + 0.01, rz, tipX, y + 0.01, tipZ, x, y + r * 0.22, z, tipX, y + 0.01, tipZ, lx, y + 0.01, lz);
        void a2;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      add(g, col, 0.08, false);
    };

    // ── tidepools: a rim of dark rocks, the water disc a hand under the sand line, a starfish or two on the rim ──
    const poolParts: THREE.BufferGeometry[] = [];
    for (const p of spec.pools) {
      const gy = heightAt(p.x, p.z);
      const nR = Math.round(p.r * 3.2);
      for (let i = 0; i < nR; i++) {
        const a = (i / nR) * Math.PI * 2 + rng.range(-0.2, 0.2), rr = p.r + rng.range(-0.1, 0.35);
        const rx = p.x + Math.cos(a) * rr, rz = p.z + Math.sin(a) * rr;
        rock(rx, rz, rng.range(0.22, 0.5), undefined, rng.next() < 0.3 ? C.rockWet : C.rock);
        if (rng.next() < 0.28) starfish(rx + rng.range(-0.2, 0.2), heightAt(rx, rz) + 0.16, rz + rng.range(-0.2, 0.2), rng.range(0.12, 0.2), rng.next() < 0.7 ? C.star : C.starPurple);
      }
      const disc = new THREE.CircleGeometry(p.r + 0.05, 10);
      disc.rotateX(-Math.PI / 2); disc.translate(p.x, gy + 0.03, p.z);
      poolParts.push(disc);
      // a starfish under the water too
      if (rng.next() < 0.7) starfish(p.x + rng.range(-0.4, 0.4), gy - 0.02, p.z + rng.range(-0.4, 0.4), rng.range(0.14, 0.22), C.star);
    }
    // ── the cascade: a ribbon of quads hugging the crag face from top to foot, foam bands scroll down it; a plunge pool at the foot ──
    const fallParts: THREE.BufferGeometry[] = [];
    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot;
      const N = 14, w = spec.fall.width;
      const dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz), sx = -dz / len, sz = dx / len;   // across the fall
      const pos: number[] = [], uv: number[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = tx + dx * u, z = tz + dz * u;
        const y = heightAt(x, z) + 0.16 + 0.12 * Math.sin(u * 9) * (1 - u);
        const ww = w * (0.55 + 0.45 * u);
        pos.push(x - sx * ww / 2, y, z - sz * ww / 2, x + sx * ww / 2, y, z + sz * ww / 2);
        uv.push(0, u * 6, 1, u * 6);
      }
      const idx: number[] = [];
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      g.computeVertexNormals();
      fallParts.push(g.toNonIndexed());
      // rocks flanking the fall and the plunge pool at its foot
      for (let i = 0; i < 9; i++) { const u = rng.range(0.05, 0.95), side = i % 2 ? 1 : -1; const x = tx + dx * u + sx * side * (w * 0.7 + rng.range(0, 0.5)), z = tz + dz * u + sz * side * (w * 0.7 + rng.range(0, 0.5)); rock(x, z, rng.range(0.35, 0.8), undefined, C.rockWet); }
      const py = heightAt(fx, fz);
      const disc = new THREE.CircleGeometry(2.4, 12); disc.rotateX(-Math.PI / 2); disc.translate(fx + sx * 0 + dx / len * 1.2, py + 0.05, fz + dz / len * 1.2);
      poolParts.push(disc);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + rng.range(-0.2, 0.2); const x = fx + dx / len * 1.2 + Math.cos(a) * 2.6, z = fz + dz / len * 1.2 + Math.sin(a) * 2.6; rock(x, z, rng.range(0.3, 0.6), undefined, C.rockWet); }
    }
    // ── the cave mouth: a hollow dug into the crag foot, clad in boulders, an ember-lit back wall inside ──
    {
      const cv = spec.cave, cs = Math.cos(cv.yaw), sn = Math.sin(cv.yaw);
      const L = (lx: number, lz: number) => [cv.x + lx * cs + lz * sn, cv.z - lx * sn + lz * cs] as [number, number];
      // the floor is the ground at the MOUTH (the lowest point — the slope climbs into the crag behind it)
      const [mx, mz] = L(0, -cv.depth / 2);
      const gy = heightAt(mx, mz) - 0.05;
      const H = cv.h + Math.max(0, heightAt(cv.x, cv.z) - gy) * 0.5;
      // the hollow: a box open toward local -z (the mouth), interior near-black (the inward faces only)
      const inner = new THREE.BoxGeometry(cv.w, H, cv.depth);
      inner.deleteAttribute('uv');
      const ni = inner.toNonIndexed();
      const p = ni.getAttribute('position');
      const keep: number[] = [];
      for (let i = 0; i < p.count; i += 3) { if (p.getZ(i) < -cv.depth / 2 + 1e-3 && p.getZ(i + 1) < -cv.depth / 2 + 1e-3 && p.getZ(i + 2) < -cv.depth / 2 + 1e-3) continue; for (let j = 0; j < 3; j++) keep.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j)); }
      const hollow = new THREE.BufferGeometry(); hollow.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
      hollow.scale(-1, 1, 1);   // flip winding so the inside faces render
      hollow.rotateY(cv.yaw); hollow.translate(cv.x, gy + H / 2, cv.z);
      add(hollow, C.caveIn, 0.05, false);
      // cladding: boulders along both flanks, over the roof and round the mouth, each on its own bit of ground / the roof line
      for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
        const lz = -cv.depth / 2 + (i / 8) * (cv.depth + 0.6);
        const [x, z] = L(side * (cv.w / 2 + 0.45), lz);
        const r = rng.range(0.5, 0.85);
        rock(x, z, r, Math.max(heightAt(x, z), gy) + (i % 2) * 0.9, C.rock);
        if (i % 3 === 0) { const [x2, z2] = L(side * (cv.w / 2 + 0.3), lz); rock(x2, z2, rng.range(0.45, 0.7), gy + H - 0.2, C.rock); }
      }
      for (let i = 0; i < 7; i++) { const [x, z] = L(rng.range(-cv.w / 2, cv.w / 2), -cv.depth / 2 + 0.3 + rng.range(0, cv.depth)); rock(x, z, rng.range(0.6, 1.0), gy + H - 0.1 + rng.range(0, 0.3), C.rock); }
      // the mouth arch
      const arch: [number, number, number][] = [[-1.15, 0.2, 0.5], [1.15, 0.2, 0.5], [-1.25, 1.1, 0.5], [1.25, 1.1, 0.5], [-1.0, 2.0, 0.55], [1.0, 2.0, 0.55], [-0.4, 2.55, 0.55], [0.5, 2.6, 0.55]];
      for (const [ax, ay, ar] of arch) { const [x, z] = L(ax * cv.w / 2, -cv.depth / 2 - 0.15); rock(x, z, ar, gy + ay * (H / cv.h) - ar * 0.25, ay < 1 ? C.rockWet : C.rock); }
      // the ember-lit back wall + the light
      const back = new THREE.PlaneGeometry(cv.w * 0.6, H * 0.45);
      back.rotateY(Math.PI + cv.yaw);
      const [bx, bz] = L(0, cv.depth / 2 - 0.2);
      back.translate(bx, gy + H * 0.4, bz);
      this.emberMat = new THREE.MeshBasicMaterial({ color: C.ember.clone().multiplyScalar(1.2), fog: false });
      const ember = new THREE.Mesh(back, this.emberMat);
      this.group.add(ember);
      const [lx, lz] = L(0, 0.3);
      this.glow = new THREE.PointLight(0xff9a3a, 14, 11, 2);
      this.glow.position.set(lx, gy + 1.0, lz);
      this.group.add(this.glow);
      this.colliders.push({ x: cv.x, z: cv.z, hw: cv.w / 2 + 0.6, hd: cv.depth / 2 + 0.4, rot: -cv.yaw, yTop: gy + H + 1, yBottom: gy - 1 });
    }

    // ── meshes ──
    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    this.sky.setupMaterial(mat);
    const rocks = new THREE.Mesh(geo, mat);
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.group.add(rocks);

    const pools = mergeGeometries(poolParts, false);
    pools.computeBoundingSphere();
    const pmat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a2540'), roughness: 0.4, metalness: 0, transparent: true, opacity: 0.9, flatShading: true });
    this.patchRipple(pmat, 'cove-pool');
    this.sky.setupMaterial(pmat);
    const poolMesh = new THREE.Mesh(pools, pmat);
    poolMesh.receiveShadow = true; poolMesh.renderOrder = 1;
    this.group.add(poolMesh);

    const fall = mergeGeometries(fallParts, false);
    fall.computeBoundingSphere();
    const fmat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#bfe6f0'), roughness: 0.5, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    this.patchFall(fmat);
    this.sky.setupMaterial(fmat);
    const fallMesh = new THREE.Mesh(fall, fmat);
    fallMesh.renderOrder = 2;
    this.group.add(fallMesh);
    return this;
  }

  /** the pools: concentric ripple rings drift outward, the sun catches their crests */
  private patchRipple(mat: THREE.MeshStandardMaterial, key: string) {
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uTime'] = u.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float r = length(fract(vWp.xz * 0.11) - 0.5) * 9.0;          // a ripple centre per 9 m cell (each pool gets its own)
            float w = 0.5 + 0.5 * sin(r * 6.0 - uTime * 2.2) * sin(vWp.x * 3.1 + uTime) ;
            float crest = smoothstep(0.75, 1.0, w);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.4, 0.5), crest * 0.4 + 0.06 * sin(vWp.z * 5.0 + uTime * 1.7));
          }`);
    };
    mat.customProgramCacheKey = () => key;
  }

  /** the cascade: bands of foam scroll down the ribbon (uv.y runs top → foot), with a little sideways wobble */
  private patchFall(mat: THREE.MeshStandardMaterial) {
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uTime'] = u.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFuv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFuv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vFuv;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float band = 0.5 + 0.5 * sin((vFuv.y - uTime * 1.6) * 6.28 + sin(vFuv.x * 12.0 + uTime * 3.0) * 0.6);
            float foam = smoothstep(0.55, 0.95, band) * 0.6 + smoothstep(0.85, 1.0, vFuv.y) * 0.4;
            float edge = smoothstep(0.0, 0.18, vFuv.x) * smoothstep(1.0, 0.82, vFuv.x);
            diffuseColor.rgb = mix(vec3(0.45, 0.72, 0.8), vec3(0.98, 1.0, 1.0), foam);
            diffuseColor.a *= 0.55 + 0.45 * edge;
          }`);
    };
    mat.customProgramCacheKey = () => 'cove-fall';
  }

  update(dt: number): void {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    // the ember glow breathes
    const k = 0.85 + 0.15 * Math.sin(this.t * 2.3) * Math.sin(this.t * 0.7 + 1);
    this.glow.intensity = 14 * k;
    this.emberMat.color.copy(C.ember).multiplyScalar(0.8 + 0.5 * k);
  }
}
