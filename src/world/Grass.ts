import * as THREE from 'three';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep, lerp } from '../core/noise';
import { heightAt, normalAt, splatAt, inChunk, pondMask, waterLevel } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { windUniforms } from './TreeFactory';
import type { Sky } from './Sky';
import type { Forest } from './Forest';

/**
 * Wind-swept grass carpet around the player (Skyrim SE / Horizon style).
 *
 *   const grass = new Grass(sky, forest).build();
 *   scene.add(grass.group);
 *   game.onUpdate((dt) => grass.update(dt, player.position));
 *
 * One InstancedMesh (one draw call, 75k slots, ~25–35k live clumps) of grass *clumps* — 3 crossed,
 * curved blade quads each, drawn from a procedural Canvas2D blade atlas — that follows the player
 * in a 4 m cell grid (toroidal slot table, 28×28 cells × 96 slots). A cell is (re)seeded from a
 * hash of its coordinates, so the same square metre always grows the same grass. Density comes
 * from the terrain splat (dense on the grass layer, sparse on forest floor, none on trail / rock /
 * cabin pads / inside trunks). Instances sit on `heightAt`, tilt to the cell's `normalAt`, and get
 * a per-instance colour (yellow-green ↔ deep green patches, olive-brown on the forest floor).
 * Everything else is in the shader: gust-front wind (windUniforms.uTime), distance LOD (3 → 2 → 1
 * quads, then every other clump, then shrink to 0 in the outer FADE metres), fake root AO,
 * translucent light-wrap / sun backlight, alpha sharpening so distant grass keeps its coverage.
 * The CPU only works when the player crosses a cell boundary (≈0.13 ms per cell, at most
 * `params.budget` cells per frame; the first fill after a spawn/teleport is done at once, ~50 ms).
 *
 * Public: `group`, `mesh`, `material`, `update(dt, playerPos)`, `radius`,
 *         `params` = { budget, windStrength } (live tunables).
 */

const RADIUS = 55;         // metres: ring around the player that has grass
const FADE = 10;           // metres: outer band where instances scale down to 0
const CELL = 4;            // metres per cell
const N = Math.ceil((RADIUS * 2) / CELL); // 28 cells per side
const K = 96;              // instance slots per cell → 75 264 instances

const grassUniforms = {
  uGrassWind: { value: 1.0 },
  uRadius: { value: RADIUS },
  uFade: { value: FADE },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.93, 0.8) },
};

export class Grass {
  group = new THREE.Group();
  mesh!: THREE.InstancedMesh;
  material!: THREE.MeshStandardMaterial;
  readonly radius = RADIUS;
  /** live tunables */
  params = { budget: 6, windStrength: 1.0 };

  private slotKeyX = new Int32Array(N * N).fill(0x7fffffff);
  private slotKeyZ = new Int32Array(N * N).fill(0x7fffffff);
  private queue: number[] = [];       // cell indices (cx * 1e5 + cz) pending reseed
  private queued = new Set<number>();
  private lastCellX = 0x7fffffff;
  private lastCellZ = 0x7fffffff;
  private patchNoise = new Noise2D(SEED + 31);
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpP = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpN = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private zeroM = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private sky: Sky, private forest: Forest) {}

  build() {
    const geo = buildClumpGeometry();
    this.material = this.buildMaterial();
    this.mesh = new THREE.InstancedMesh(geo, this.material, N * N * K);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * N * K * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    // start with everything collapsed
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < N * N * K; i++) this.zeroM.toArray(arr, i * 16);
    this.group.add(this.mesh);
    grassUniforms.uSunDir.value.copy(this.sky.sunDir);
    grassUniforms.uSunColor.value.copy(this.sky.sunColor);
    return this;
  }

  private buildMaterial() {
    const tex = makeBladeAtlas();
    const mat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
      color: new THREE.Color(1, 1, 1),
    });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, grassUniforms);
      shader.uniforms.uTime = windUniforms.uTime;
      shader.uniforms.uWindStrength = windUniforms.uWindStrength;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform float uTime; uniform float uWindStrength; uniform float uGrassWind; uniform float uRadius; uniform float uFade;
          attribute float quadId;
          varying float vH;`)
        .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
          {
            mat3 im = mat3( instanceMatrix );
            vec3 ipos = ( modelMatrix * vec4( instanceMatrix[3].xyz, 1.0 ) ).xyz;
            float dist = distance( ipos, cameraPosition );
            float rnd = fract( sin( dot( ipos.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            float fade = 1.0 - smoothstep( uRadius - uFade, uRadius, dist );
            // LOD: far clumps lose their 3rd and then 2nd quad, then every other clump, before the ring fade
            if ( quadId > 1.5 ) fade *= 1.0 - smoothstep( 18.0, 26.0, dist );
            else if ( quadId > 0.5 ) fade *= 1.0 - smoothstep( 32.0, 40.0, dist );
            if ( rnd < 0.5 ) fade *= 1.0 - smoothstep( 38.0, 46.0, dist );
            // widen the surviving card a little so far coverage holds up
            transformed.x *= 1.0 + smoothstep( 18.0, 30.0, dist ) * 0.35;
            transformed *= fade;
            float h = uv.y;
            vH = h;
            // wind: a travelling gust front plus a faster ripple and a per-blade flutter
            vec2 dir = vec2( 0.86, 0.5 );
            vec3 wpos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
            float phase = dot( wpos.xz, dir ) * 0.32 + rnd * 1.7;
            float gust = sin( uTime * 1.25 - phase ) * 0.5 + 0.5;
            gust *= gust;
            float ripple = sin( uTime * 2.9 - phase * 2.1 + wpos.x * 0.45 ) * 0.5 + 0.5;
            float flutter = sin( uTime * 6.5 + wpos.x * 4.3 + wpos.z * 3.1 );
            float s2 = dot( im[0], im[0] );
            float amp = ( 0.02 + gust * 0.13 * ( 0.7 + 0.6 * rnd ) + ripple * 0.045 ) * uWindStrength * uGrassWind * sqrt( s2 ) * 2.0;
            float w = h * h;
            // a little per-clump lean in a random direction so the field is not combed flat
            vec2 leanDir = vec2( cos( rnd * 6.2832 ), sin( rnd * 6.2832 ) ) * 0.05;
            vec3 off = vec3( dir.x * amp + flutter * 0.02 + leanDir.x, 0.0, dir.y * amp + flutter * 0.015 + leanDir.y ) * w;
            off.y = - length( off.xz ) * 0.3;
            transformed += ( off * im ) / max( s2, 1e-6 ) * fade;
          }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          varying float vH;
          uniform vec3 uSunDir; uniform vec3 uSunColor;`)
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
          // fake ground AO: roots sit in shadow between the blades
          diffuseColor.rgb *= mix( 0.32, 1.0, smoothstep( 0.0, 0.6, vH ) );`)
        .replace('#include <alphatest_fragment>', /* glsl */`
          // sharpen the mip-blurred alpha so distant grass keeps its coverage instead of thinning out
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;`)
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
        .replace('#include <lights_fragment_begin>', /* glsl */`#include <lights_fragment_begin>
          {
            // translucency: thin blades let light through, glowing when the sun is behind them
            vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
            float bl = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 5.0 );
            reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.07 + bl * 0.55 * vH ) * uSunColor;
          }`);
    };
    mat.customProgramCacheKey = () => 'grass-carpet';
    this.sky.setupMaterial(mat);
    return mat;
  }

  private slotOf(cx: number, cz: number) {
    return (((cx % N) + N) % N) * N + (((cz % N) + N) % N);
  }

  update(_dt: number, playerPos: THREE.Vector3) {
    grassUniforms.uGrassWind.value = this.params.windStrength;
    const pcx = Math.floor(playerPos.x / CELL), pcz = Math.floor(playerPos.z / CELL);
    if (pcx !== this.lastCellX || pcz !== this.lastCellZ) {
      const first = this.lastCellX === 0x7fffffff;
      this.lastCellX = pcx; this.lastCellZ = pcz;
      const half = N >> 1;
      for (let cx = pcx - half; cx < pcx + half; cx++) for (let cz = pcz - half; cz < pcz + half; cz++) {
        const s = this.slotOf(cx, cz);
        if (this.slotKeyX[s] === cx && this.slotKeyZ[s] === cz) continue;
        const key = cx * 100000 + cz;
        if (!this.queued.has(key)) { this.queued.add(key); this.queue.push(key); }
      }
      // sort so cells nearest the player fill first (matters after a teleport / first frame)
      if (this.queue.length > 60) {
        this.queue.sort((a, b) => {
          const ax = Math.floor((a + 50000) / 100000), az = a - ax * 100000, bx = Math.floor((b + 50000) / 100000), bz = b - bx * 100000;
          return (ax - pcx) ** 2 + (az - pcz) ** 2 - ((bx - pcx) ** 2 + (bz - pcz) ** 2);
        });
      }
      if (first) this.flush(Infinity);
    }
    if (this.queue.length) this.flush(this.queue.length > 300 ? Infinity : this.params.budget);
  }

  private flush(budget: number) {
    let n = 0;
    const half = N >> 1;
    let dirty = false;
    while (this.queue.length && n < budget) {
      const key = this.queue.shift()!;
      this.queued.delete(key);
      const cx = Math.floor((key + 50000) / 100000), cz = key - cx * 100000;
      // dropped out of the window while queued? (player moved on) → skip
      if (cx < this.lastCellX - half || cx >= this.lastCellX + half || cz < this.lastCellZ - half || cz >= this.lastCellZ + half) continue;
      this.seedCell(cx, cz);
      n++; dirty = true;
    }
    if (dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
  }

  private seedCell(cx: number, cz: number) {
    const slot = this.slotOf(cx, cz);
    this.slotKeyX[slot] = cx; this.slotKeyZ[slot] = cz;
    const rng = new Rng(((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ SEED) >>> 0) + 1);
    const x0 = cx * CELL, z0 = cz * CELL;
    const s00 = splatAt(x0, z0), s10 = splatAt(x0 + CELL, z0), s01 = splatAt(x0, z0 + CELL), s11 = splatAt(x0 + CELL, z0 + CELL);
    const nrm = normalAt(x0 + CELL / 2, z0 + CELL / 2, 1.0);
    const trees = this.forest.nearby(x0 + CELL / 2, z0 + CELL / 2, 3);
    const matArr = this.mesh.instanceMatrix.array as Float32Array;
    const colArr = this.mesh.instanceColor!.array as Float32Array;
    const base = slot * K;
    this.tmpN.set(nrm[0], nrm[1], nrm[2]);
    this.tmpQ2.setFromUnitVectors(UP, this.tmpN);
    for (let k = 0; k < K; k++) {
      const u = rng.next(), v = rng.next();
      const x = x0 + u * CELL, z = z0 + v * CELL;
      // bilinear splat
      const g = bilerp(s00[1], s10[1], s01[1], s11[1], u, v);
      const f = bilerp(s00[0], s10[0], s01[0], s11[0], u, v);
      const t = bilerp(s00[3], s10[3], s01[3], s11[3], u, v);
      const r = bilerp(s00[2], s10[2], s01[2], s11[2], u, v);
      const patch = this.patchNoise.fbm(x * 0.045, z * 0.045, 2);
      let p = g * (1.0 + 0.3 * patch) + f * 0.13;
      p *= smoothstep(0.3, 0.04, t) * smoothstep(0.5, 0.1, r);
      const roll = rng.next();
      const yaw = rng.range(0, Math.PI * 2);
      const hv = rng.next();
      const cv = rng.next();
      let keep = roll < p && inChunk(x, z, 1.5) && pondMask(x, z) < 0.02;
      if (keep) for (const tr of trees) { const dx = tr.x - x, dz = tr.z - z; if (dx * dx + dz * dz < (tr.r + 0.3) ** 2) { keep = false; break; } }
      const idx = base + k;
      if (!keep) { this.zeroM.toArray(matArr, idx * 16); continue; }
      const y = heightAt(x, z) - 0.03;
      if (y < waterLevel() + 0.15) { this.zeroM.toArray(matArr, idx * 16); continue; }
      const h = lerp(0.36, 0.68, hv) * lerp(0.72, 1.0, g) * (0.9 + 0.2 * patch);
      this.tmpQ.setFromAxisAngle(UP, yaw).premultiply(this.tmpQ2);
      this.tmpM.compose(this.tmpP.set(x, y, z), this.tmpQ, this.tmpS.set(h, h, h));
      this.tmpM.toArray(matArr, idx * 16);
      // colour: yellow-green meadow ↔ deep green, patchy via noise, olive-brown on the forest floor
      const tone = smoothstep(-0.5, 0.5, patch) * 0.65 + cv * 0.35;
      this.tmpC.setRGB(lerp(0.6, 1.0, tone), lerp(0.72, 0.86, tone), lerp(0.36, 0.5, tone));
      const floorMix = f * (1 - g);
      this.tmpC.r = lerp(this.tmpC.r, 0.78, floorMix * 0.6);
      this.tmpC.g = lerp(this.tmpC.g, 0.62, floorMix * 0.6);
      this.tmpC.b = lerp(this.tmpC.b, 0.34, floorMix * 0.6);
      colArr[idx * 3] = this.tmpC.r; colArr[idx * 3 + 1] = this.tmpC.g; colArr[idx * 3 + 2] = this.tmpC.b;
    }
    this.mesh.instanceMatrix.addUpdateRange(base * 16, K * 16);
    this.mesh.instanceColor!.addUpdateRange(base * 3, K * 3);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const bilerp = (a: number, b: number, c: number, d: number, u: number, v: number) => lerp(lerp(a, b, u), lerp(c, d, u), v);

// ---------------------------------------------------------------------------------- geometry

/** Three crossed, curved quads (4 rows each) with the pivot at the root. Unit height, ~0.72 wide. */
function buildClumpGeometry() {
  const rng = new Rng(SEED + 404);
  const rows = 4, quads = 3;
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [], qid: number[] = [];
  for (let q = 0; q < quads; q++) {
    const yaw = (q / quads) * Math.PI + rng.range(-0.18, 0.18);
    const tilt = rng.range(-0.12, 0.12);
    const ox = rng.range(-0.05, 0.05), oz = rng.range(-0.05, 0.05);
    const width = 0.72 * rng.range(0.9, 1.1);
    const bend = rng.range(0.12, 0.22);
    const tile = q % 4;
    const mirror = rng.next() < 0.5;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const base = verts.length / 3;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const y = t;
      const lean = bend * t * t;             // curve the quad along its normal
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * width * (1 - t * 0.08);
        const lz = lean + tilt * t;
        const x = ox + lx * cy - lz * sy, z = oz + lx * sy + lz * cy;
        verts.push(x, y, z);
        qid.push(q);
        // normal: mostly up, leaning outwards from the clump axis → soft rounded shading
        const rl = Math.hypot(x, z) || 1;
        const nx = (x / rl) * 0.4, nz = (z / rl) * 0.4;
        const nl = Math.hypot(nx, 1, nz);
        norms.push(nx / nl, 1 / nl, nz / nl);
        const uu = (mirror ? 1 - c : c);
        uvs.push((tile + uu) / 4, t);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      const a = base + r * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('quadId', new THREE.Float32BufferAttribute(qid, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------------- texture

/** 4 tiles × (4–5 blades): soft-tipped, curved, dark root, per-blade tint, lighter midrib. */
function makeBladeAtlas() {
  const W = 1024, H = 512, TILE = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const rng = new Rng(SEED + 505);
  for (let tile = 0; tile < 4; tile++) {
    const nBlades = 9 + (tile % 3);
    const x0 = tile * TILE;
    for (let b = 0; b < nBlades; b++) {
      const rootX = x0 + TILE * (0.14 + 0.72 * ((b + 0.5) / nBlades)) + rng.range(-16, 16);
      const height = H * (b % 3 === 1 ? rng.range(0.45, 0.7) : rng.range(0.68, 1.0));
      const bendX = rng.range(0.1, 0.3) * TILE * (b % 2 ? 1 : -1) * (rng.next() < 0.25 ? -1 : 1);
      const w0 = rng.range(15, 26);
      const hue = rng.range(-1, 1);
      drawBlade(g, rootX, H, bendX, height, w0, hue, rng);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function drawBlade(g: CanvasRenderingContext2D, rx: number, ry: number, bendX: number, height: number, w0: number, hue: number, rng: Rng) {
  // centreline: quadratic bezier from the root up and over
  const p0 = [rx, ry], p1 = [rx + bendX * 0.35, ry - height * 0.58], p2 = [rx + bendX, ry - height];
  const steps = 24;
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, it = 1 - t;
    const x = it * it * p0[0] + 2 * it * t * p1[0] + t * t * p2[0];
    const y = it * it * p0[1] + 2 * it * t * p1[1] + t * t * p2[1];
    const dx = 2 * it * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * it * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const w = (w0 * Math.pow(1 - t, 0.75) + 0.6) * 0.5;
    left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
  }
  const path = () => {
    g.beginPath();
    g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) g.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
  };
  // vertical gradient: dark olive root → mid green → lighter yellow-green tip
  const grad = g.createLinearGradient(0, ry, 0, ry - height);
  const rootC = `rgb(${60 + hue * 6},${70 + hue * 4},${26})`;
  const midC = `rgb(${112 + hue * 16},${138 + hue * 8},${46 + hue * 5})`;
  const tipC = `rgb(${164 + hue * 20},${172 + hue * 10},${74 + hue * 8})`;
  grad.addColorStop(0, rootC); grad.addColorStop(0.45, midC); grad.addColorStop(1, tipC);
  g.fillStyle = grad;
  g.globalAlpha = 1;
  path(); g.fill();
  // midrib highlight
  g.strokeStyle = `rgba(${185 + hue * 20},${196},${104},0.5)`;
  g.lineWidth = Math.max(1, w0 * 0.22);
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = (left[i][0] + right[i][0]) / 2 + (i % 2 ? 0.3 : -0.3), y = (left[i][1] + right[i][1]) / 2;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  // darker edge on one side for volume
  g.strokeStyle = `rgba(30,40,12,${0.35 + rng.next() * 0.2})`;
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i <= steps * 0.8; i++) { const [x, y] = right[i]; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
}
