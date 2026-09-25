import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '../core/config';
import { heightAt, normalAt, splatAt, trailDistance, TRAILS } from './Heightfield';
import { loadPBR, loadPBRArray, pbrMaterial } from '../core/assets';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import { loadBakedTerrain } from './BakedTerrain';
import { macrotask } from '../boot/plan';
import { groundSet } from './lookFlags';
import { painterlyMaterial } from './painterly';
import { applyTerrainSurface } from '../nalati/terrainSurface';
import { LOOK_V2 } from '../nalati/look/flag';
import { zoneWeights } from '../nalati/look/zones';
import { loadNalatiTextures } from './nalatiTextures';
import { Noise2D } from '../core/noise';
import type { RGB } from '../chunks/ChunkDef';

// ── low-poly palette (sRGB in, linear out via THREE.Color) ──
const LP = {
  seabed: new THREE.Color('#15a0b4'),   // the lagoon floor as seen through the water (Beer–Lambert's green-cyan baked in: the sea over it is clear)
  wetSand: new THREE.Color('#caa66c'),   // the swash tint: a shade darker than the dry sand, not mud
  sand: new THREE.Color('#ffd98c'),   // warm golden (E43 round 6: matched to the mockups by palette-delta.py)
  grass: new THREE.Color('#6cae47'),
  grassDark: new THREE.Color('#4d8c33'),
  grassHigh: new THREE.Color('#9acb52'),
  rock: new THREE.Color('#666a70'),
  rockLight: new THREE.Color('#84888e'),
  path: new THREE.Color('#d6bd84'),
};
const _tmpC = new THREE.Color(), _pathC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;
const hash2 = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * The boreal ground (PINE-HOLLOW PH-L8, `ChunkAssets.boreal`; `?ground=v1` builds the plain shader above). Over the same
 * four splat layers ([needle litter, grass, rock, trail]):
 *  - tiling breakup: each layer's near albedo is two samplings (the 3.6 m one and a rotated 4.8 m one) mixed by a 9 m
 *    value noise, the far sample rotated off the near grid (fetched only where blended: the phone's fragment budget), the old 20 m hash blocks replaced by smooth value noise;
 *  - canopy-driven litter: under the crowns (`canopy`, Forest's map) the needle litter goes darker and rust-warm; in
 *    the open it stays pale and dry;
 *  - moss: feather-moss carpets in patches over the litter, most where the canopy is dense (the grass layer, sampled
 *    rotated at 2.7 m, desaturated and tinted moss green; flatter normal, fully rough);
 *  - per-layer normal strength (`normalK`, e.g. the crags' rock stronger);
 *  - heath: darker olive bilberry / heather mats in ~1.5 m patches over the open floor and the grass;
 *  - ragged trail verges (the litter eats into the trail's edge by a noise);
 *  - the trails' dust (`trailDust`): the path set's grey-violet pebbles pulled toward a dry, warm soil.
 * Same textures (no new samplers), one program ('terrain-splat-boreal').
 */
const BOREAL_COMMON = /* glsl */`
          uniform vec4 uNormalK;
          uniform vec4 uTrailDust;
          float vnoise(vec2 p) {
            vec2 i = floor(p), f = fract(p), q = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), q.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), q.x), q.y);
          }
          const mat2 ROT_B = mat2(0.8196, 0.5729, -0.5729, 0.8196);   // 0.61 rad
          const mat2 ROT_F = mat2(0.9323, -0.3616, 0.3616, 0.9323);   // −0.37 rad
          const mat2 ROT_M = mat2(0.2675, 0.9636, -0.9636, 0.2675);   // 1.3 rad
          // a layer's albedo: near = the 3.6 m sampling mixed with a rotated 4.8 m one by \`tb\`, far rotated too; each
          // branch fetches only what it blends (most pixels are wholly near or far, wholly one sampling or the other).
          // Explicit gradients (gx, gy = the world uv's screen derivatives, taken outside every branch): a fetch inside
          // non-uniform control flow has no implicit mip level
          vec4 fetchG(sampler2DArray t, int i, mat2 m, float s, vec2 o, vec2 uv, vec2 gx, vec2 gy) {
            return textureGrad(t, vec3(m * uv * s + o, float(i)), m * gx * s, m * gy * s);
          }
          vec4 sampleB(sampler2DArray t, int i, vec2 uv, float k, float tb, vec2 gx, vec2 gy) {
            vec4 b = k > 0.001 ? fetchG(t, i, ROT_F, 0.034, vec2(0.37), uv, gx, gy) : vec4(0.0);
            if (k > 0.999) return b;
            vec4 a0 = tb < 0.999 ? fetchG(t, i, mat2(1.0), 0.28, vec2(0.0), uv, gx, gy) : vec4(0.0);
            vec4 a1 = tb > 0.001 ? fetchG(t, i, ROT_B, 0.21, vec2(0.53), uv, gx, gy) : vec4(0.0);
            return mix(mix(a0, a1, tb), b, k);
          }
          // the normal / ARM: the 3.6 m sampling near, the rotated far one away (the albedo hides the repeat)
          vec4 sampleS(sampler2DArray t, int i, vec2 uv, float k, vec2 gx, vec2 gy) {
            vec4 b = k > 0.001 ? fetchG(t, i, ROT_F, 0.034, vec2(0.37), uv, gx, gy) : vec4(0.0);
            if (k > 0.999) return b;
            return mix(fetchG(t, i, mat2(1.0), 0.28, vec2(0.0), uv, gx, gy), b, k);
          }
          vec3 sampleN(int i, vec2 uv, float k, vec2 gx, vec2 gy) {
            vec3 b = vec3(0.0, 0.0, 1.0);
            if (k > 0.001) { b = fetchG(tNorm, i, ROT_F, 0.034, vec2(0.37), uv, gx, gy).xyz * 2.0 - 1.0; b.xy = transpose(ROT_F) * b.xy; }
            if (k > 0.999) return b;
            return mix(fetchG(tNorm, i, mat2(1.0), 0.28, vec2(0.0), uv, gx, gy).xyz * 2.0 - 1.0, b, k);
          }
`;

const BOREAL_MAP = /* glsl */`
          float camDist = length(vWPos - cameraPosition);
          vec2 tuv = vWPos.xz;
          vec4 w = vSplat;
          w = pow(max(w, vec4(0.0)), vec4(2.2)); w /= max(w.x + w.y + w.z + w.w, 1e-5); // guarded (E67)
          // the trails' edges broken by the litter (a ragged, trodden verge instead of a clean 11 m gravel band)
          {
            float erode = vnoise(tuv * 0.35) * 0.6 + vnoise(ROT_F * tuv * 1.3 + 4.0) * 0.4;
            float wt = w.w * smoothstep(0.1, 0.6, w.w + (erode - 0.5) * 0.7);
            w.x += w.w - wt; w.w = wt;
          }
          float kFar = smoothstep(18.0, 70.0, camDist);
          vec2 gx = dFdx(tuv), gy = dFdy(tuv);
          float tb = smoothstep(0.3, 0.7, vnoise(tuv * 0.11));
          vec4 alb = vec4(0.0);
          vec3 nrm = vec3(0.0);
          vec3 arm = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            float wi = w[i];
            if (wi < 0.004) continue;
            vec4 l = sampleB(tDiff, i, tuv, kFar, tb, gx, gy); l.rgb *= uTints[i];
            if (i == 3) l.rgb = mix(l.rgb, vec3(dot(l.rgb, vec3(0.299, 0.587, 0.114))) * uTrailDust.rgb, uTrailDust.a); // dusty soil
            alb += l * wi;
            vec3 n = sampleN(i, tuv, kFar, gx, gy);
            n.xy *= uNormalK[i];
            nrm += n * wi;
            arm += sampleS(tArm, i, tuv, kFar, gx, gy).xyz * wi;
          }
          // the litter under the crowns: darker, rust-warm needles (the open floor stays pale and dry)
          float cano = smoothstep(0.05, 0.8, vCanopy);
          alb.rgb *= mix(vec3(1.0), vec3(1.05, 0.93, 0.8), w.x * cano);
          // the open floor between the crowns: dry grass and cowberry grown through the litter, in drifts
          float openN = smoothstep(0.25, 0.75, vnoise(ROT_F * tuv * 0.05 + 11.0) * 0.7 + vnoise(tuv * 0.23) * 0.3);
          float open = w.x * (1.0 - cano) * mix(0.35, 0.8, openN);
          if (open > 0.004) {
            vec3 gr = sampleS(tDiff, 1, ROT_M * tuv + 5.3, kFar, ROT_M * gx, ROT_M * gy).rgb * vec3(0.62, 0.68, 0.44);
            alb.rgb = mix(alb.rgb, gr, open);
          }
          // heath: bilberry / heather mats on the open floor and the grass (darker olive, ~1.5 m patches), none on trails / rock
          float heath = smoothstep(0.44, 0.72, vnoise(ROT_B * tuv * 0.62 + 2.0) * 0.7 + vnoise(tuv * 1.9) * 0.3) * (w.x + w.y) * (1.0 - 0.6 * cano);
          alb.rgb = mix(alb.rgb, alb.rgb * vec3(0.52, 0.62, 0.36), heath * 0.85);
          // feather moss: patches over the litter, thickest in the shade
          float mossN = vnoise(tuv * 0.07) * 0.65 + vnoise(ROT_M * tuv * 0.29 + 3.1) * 0.35;
          float moss = w.x * smoothstep(0.45, 0.68, mossN) * (0.3 + 0.7 * cano);
          if (moss > 0.004) {
            vec3 g = fetchG(tDiff, 1, ROT_M, 0.37, vec2(0.21), tuv, gx, gy).rgb;
            float gl = dot(g, vec3(0.299, 0.587, 0.114));
            vec3 mossC = mix(vec3(gl), g, 0.55) * vec3(0.72, 0.9, 0.42);
            alb.rgb = mix(alb.rgb, mossC, moss * 0.85);
            nrm = mix(nrm, vec3(0.0, 0.0, 1.0) * max(length(nrm), 1e-3), moss * 0.5);
            arm.g = mix(arm.g, 1.0, moss);
          }
          float macro = mix(0.86, 1.1, vnoise(tuv * 0.045)) * mix(0.94, 1.05, vnoise(ROT_B * tuv * 0.17 + 7.0));
          float macro2 = mix(0.9, 1.06, smoothstep(-1.0, 1.0, sin(tuv.x * 0.021 + tuv.y * 0.017) + sin(tuv.x * 0.009 - tuv.y * 0.013)));
          alb.rgb *= macro * macro2;
          alb.rgb *= mix(1.0, 0.84, vCanopy);
          diffuseColor *= alb;
          vec3 splatNormal = dot(nrm, nrm) > 1e-8 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
          vec3 splatArm = arm;`;

export class Terrain {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  material!: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  /** Bake a 0..1 canopy-density map (from Forest) into a per-vertex attribute → ambient darkening under trees. */
  applyCanopy(tex: THREE.DataTexture): void {
    const { width: N, data } = tex.image as { width: number; data: Float32Array };
    const pos = this.mesh.geometry.getAttribute('position');
    const canopy = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + CHUNK_HALF) / CHUNK_SIZE, v = (pos.getZ(i) + CHUNK_HALF) / CHUNK_SIZE;
      const x = Math.min(N - 1, Math.max(0, Math.round(u * N))), z = Math.min(N - 1, Math.max(0, Math.round(v * N)));
      canopy[i] = data[z * N + x] ?? 0;
    }
    this.mesh.geometry.setAttribute('canopy', new THREE.BufferAttribute(canopy, 1));
  }

  /**
   * Drop the drawn triangles `hole` says reach into a walk-in space (PH-B2: the bear cave's passage, where the slope runs
   * through it; the cave's own hood covers the gap). The heights stay: `heightAt` and the physics are the caller's.
   * Returns the triangles dropped.
   */
  punch(hole: (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean): number {
    const geo = this.mesh.geometry, idx = geo.getIndex();
    if (!idx) return 0;
    const pos = geo.getAttribute('position');
    const keep: number[] = [];
    let dropped = 0;
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      if (hole(pos.getX(a), pos.getY(a), pos.getZ(a), pos.getX(b), pos.getY(b), pos.getZ(b), pos.getX(c), pos.getY(c), pos.getZ(c))) { dropped++; continue; }
      keep.push(a, b, c);
    }
    if (dropped > 0) geo.setIndex(keep);
    return dropped;
  }

  async build(): Promise<this> {
    if (getActiveChunk().style === 'lowpoly') return this.buildLowPoly();
    if (getActiveChunk().style === 'painterly') return this.buildPainterly();
    const [layers] = await Promise.all([loadPBRArray([...groundSet(getActiveChunk()).layers], 1024), loadBakedTerrain()]); // baked heights/splat → Heightfield lookups (BakedTerrain.ts)
    await macrotask(); // the layer copies above and the mesh below were one ~110 ms task at 4x CPU
    this.mesh = new THREE.Mesh(this.buildGeometry(), this.buildMaterial(layers));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(await this.buildSlab());
    return this;
  }

  /**
   * `style: 'lowpoly'` (Driftwood Isle): no textures at all. The same heightfield as an indexed
   * grid with `flatShading` (the normal comes from screen-space derivatives) and a `flat`-qualified
   * colour varying: each triangle takes the colour of its provoking (last) vertex, so the facets are
   * solid blocks of colour with no per-vertex duplication — 65 k vertices for 130 k triangles where a
   * non-indexed mesh needed 390 k (the phone is vertex-bound). Colour is sand / grass / rock by the
   * vertex's height above the sea and its slope, with per-vertex jitter so the facets read. The slab
   * walls are the same idea in dark rock. Two draw calls, no maps.
   */
  private async buildLowPoly() {
    await loadBakedTerrain();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      // `flat` interpolation: the whole triangle gets its last vertex's colour. The declaration lives inside the
      // color_pars includes, which are still unexpanded here — so expand them first (replacing the bare string never
      // matched, and the ground was smooth-shaded until E43 round 6)
      const flat = (chunk: string) => chunk.replace('varying vec4 vColor;', 'flat varying vec4 vColor;');
      shader.vertexShader = shader.vertexShader.replace('#include <color_pars_vertex>', flat(THREE.ShaderChunk.color_pars_vertex));
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_pars_fragment>', flat(THREE.ShaderChunk.color_pars_fragment));
    };
    mat.customProgramCacheKey = () => 'terrain-lowpoly';
    this.material = mat;
    const rows = this.buildLowPolyGeometry();
    let r = rows.next();
    while (r.done !== true) { await macrotask(); r = rows.next(); } // a band of rows per task: the 256² grid was one ~120 ms task at 4x CPU
    this.mesh = new THREE.Mesh(r.value, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true; // L6: the cliffs and the plateau shade the beach (+1 draw, ~130 k tris into the shadow map; phone: one 80 m cascade)
    this.group.add(this.mesh);
    this.group.add(this.buildLowPolySlab());
    return this;
  }

  /**
   * `style: 'painterly'` (Nalati): no textures. A smooth indexed grid (normals from the height grid), each vertex
   * painted by the def's `groundColor(x, z, h, slope)` — the valley / plateau greens, gravel, rock, snow — on the
   * shared painterly material with soft cel bands (terrain takes a gentler ramp than props, so the slopes still
   * read as gradients). The slab walls are painted rock on the same material. Two draw calls, one program.
   */
  private async buildPainterly() {
    const [, tex] = await Promise.all([loadBakedTerrain(), loadNalatiTextures(['meadow', 'path', 'gravel', 'rock', 'snow'])]);
    const mat = painterlyMaterial(null, { bands: 0.5, rim: 0, shade: 0.85 }); // bootstrap passes it through sky.setupMaterial
    applyTerrainSurface(mat, tex); // the painted ground: meadow, dirt track, gravel, granite, snow (src/nalati/terrainSurface.ts)
    this.material = mat;
    const rows = this.buildPainterlyGeometry();
    let r = rows.next();
    while (r.done !== true) { await macrotask(); r = rows.next(); }
    this.mesh = new THREE.Mesh(r.value, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    const slab = new THREE.Mesh(this.buildPainterlySlab(), mat); // the same material: painted granite walls, a grassy lip
    slab.receiveShadow = true;
    this.group.add(slab);
    return this;
  }

  private *buildPainterlyGeometry(): Generator<void, THREE.BufferGeometry, undefined> {
    const def = getActiveChunk();
    const paint = def.groundColor;
    const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
    const hs = new Float32Array(res * res);
    for (let iz = 0; iz < res; iz++) {
      if (iz > 0 && iz % 64 === 0) yield;
      for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
    }
    yield;
    const H = (ix: number, iz: number) => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
    const pos = new Float32Array(res * res * 3), nrm = new Float32Array(res * res * 3), col = new Float32Array(res * res * 3);
    const surf = new Float32Array(res * res * 4), rdir = new Float32Array(res * res * 2);
    const zone = LOOK_V2 ? new Float32Array(res * res * 3) : null, zw: [number, number, number] = [0, 0, 0]; // look v2: layout v2's zones (src/nalati/look/zones.ts)
    const road: [number, number, number] = [0, 0, 0];
    const out: RGB = [0, 0, 0];
    const segs = trailSegments();
    for (let iz = 0; iz < res; iz++) {
      if (iz > 0 && iz % 48 === 0) yield;
      for (let ix = 0; ix < res; ix++) {
        const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
        const y = H(ix, iz);
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const nx = H(ix - 1, iz) - H(ix + 1, iz), nz = H(ix, iz - 1) - H(ix, iz + 1), ny = 2 * d;
        const l = Math.hypot(nx, ny, nz);
        nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l;
        const slope = 1 - ny / l;
        if (paint) paint(x, z, y, slope, def.terrain, out);
        else lowPolyGroundColor(_tmpC, y, slope, x, z).toArray(out);
        col[i * 3] = out[0]; col[i * 3 + 1] = out[1]; col[i * 3 + 2] = out[2];
        // the surface-detail masks (src/nalati/terrainSurface.ts): road across · gravel · snow · rock
        const [gravel = 0, rock = 0, snow = 0] = def.surfaceAt?.(x, z, y, slope) ?? [];
        signedTrailDistance(segs, x, z, 9, road); rdir[i * 2] = road[1]; rdir[i * 2 + 1] = road[2];
        surf[i * 4] = road[0]; surf[i * 4 + 1] = gravel; surf[i * 4 + 2] = snow; surf[i * 4 + 3] = rock;
        if (zone) { zoneWeights(x, z, y, slope, zw); zone[i * 3] = zw[0]; zone[i * 3 + 1] = zw[1]; zone[i * 3 + 2] = zw[2]; }
      }
    }
    const idx = new Uint32Array(n * n * 6);
    let k = 0;
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const a = iz * res + ix, b = a + 1, c = a + res, e = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = e;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
    geo.setAttribute('rdir', new THREE.BufferAttribute(rdir, 2));
    if (zone) geo.setAttribute('zone', new THREE.BufferAttribute(zone, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * The painterly slab: the floating shard's rim as the mockups paint it — a grassy lip that overhangs a little, then
   * weathered granite (the terrain material's painted rock, triplanar) bulging and breaking in noisy ledges down to the
   * slab's floor, darker with depth. The rows step outward / inward by a seeded noise, so from above the edge reads as
   * a ragged rocky cliff, not a ruled line. Same material as the ground (one program), masks in `surf` (rock = 1 below
   * the lip). Indexed, smooth normals.
   */
  private buildPainterlySlab() {
    const def = getActiveChunk();
    const segs = 256;
    const H = CHUNK_HALF, D = -CHUNK_DEPTH;
    const n = new Noise2D(def.seed + 404);
    // rows down the wall: [metres below the lip (negative = depth fraction of the slab), outward bulge scale, rock 0/1]
    const ROWS: [number, number, number][] = [[0, 0, 0], [0.6, 1.2, 0], [1.6, 1.6, 1], [4, 0.6, 1], [8, 2.2, 1], [14, 1.0, 1], [22, 2.8, 1], [34, 1.4, 1], [-0.55, 3.5, 1], [-1, 0.5, 1]];
    const verts: number[] = [], cols: number[] = [], surf: number[] = [], rdir: number[] = [], idx: number[] = [];
    const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
      { a: [-H, -H], b: [H, -H], n: [0, -1] }, { a: [H, -H], b: [H, H], n: [1, 0] }, { a: [H, H], b: [-H, H], n: [0, 1] }, { a: [-H, H], b: [-H, -H], n: [-1, 0] },
    ];
    const grass: RGB = [0, 0, 0];
    const rockTop = new THREE.Color(0.46, 0.41, 0.35), rockMid = new THREE.Color(0.3, 0.27, 0.25), deep = new THREE.Color(0.1, 0.1, 0.12);
    const c = new THREE.Color();
    for (const s of sides) {
      const base = verts.length / 3;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
        const y0 = heightAt(x, z) + 0.05;
        const u = (s.n[0] !== 0 ? z : x) * 0.02 + s.n[0] * 3.1 + s.n[1] * 7.3;
        const [, ny] = normalAt(x, z, 1.5);
        def.groundColor?.(x, z, y0, 1 - ny, def.terrain, grass);
        for (const [r, [dy, bulge, rock]] of ROWS.entries()) {
          const y = dy >= 0 ? y0 - dy : D * -dy;
          // the ledges: each row juts or recedes by its own noise (the lip overhangs a little, the wall breaks in steps)
          const k = r === 0 ? 0 : (0.35 + 0.65 * (n.get(u * (1 + r * 0.7), r * 3.3) * 0.5 + 0.5)) * bulge + (r === 1 ? 0.6 : 0);
          const out = r === ROWS.length - 1 ? 2 : k * (r > 7 ? 1.4 : 1);
          verts.push(x + s.n[0] * out, y, z + s.n[1] * out);
          const depth = Math.min(1, Math.max(0, (y0 - y) / CHUNK_DEPTH));
          if (rock === 0) c.setRGB(grass[0], grass[1], grass[2]);
          else c.copy(rockTop).lerp(rockMid, Math.min(1, depth * 3)).lerp(deep, Math.max(0, depth * 1.3 - 0.3)).multiplyScalar(0.9 + 0.2 * (n.get(u * 4 + r, 9.1) * 0.5 + 0.5));
          cols.push(c.r, c.g, c.b);
          surf.push(9, 0, 0, rock);
          rdir.push(1, 0);
        }
      }
      const per = ROWS.length;
      for (let i = 0; i < segs; i++) for (let r = 0; r < per - 1; r++) {
        const a = base + i * per + r, b = base + (i + 1) * per + r;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const b0 = verts.length / 3;
    verts.push(-H, D, -H, H, D, -H, H, D, H, -H, D, H);
    for (let i = 0; i < 4; i++) { cols.push(deep.r, deep.g, deep.b); surf.push(9, 0, 0, 1); rdir.push(1, 0); }
    idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('surf', new THREE.Float32BufferAttribute(surf, 4));
    geo.setAttribute('rdir', new THREE.Float32BufferAttribute(rdir, 2));
    if (LOOK_V2) geo.setAttribute('zone', new THREE.Float32BufferAttribute(new Float32Array((verts.length / 3) * 3), 3)); // the walls carry no zone
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  /** The low-poly grid; yields after every band of 64 rows (the caller ends the task there). */
  private *buildLowPolyGeometry(): Generator<void, THREE.BufferGeometry, undefined> {
    const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
    const pos = new Float32Array(res * res * 3), col = new Uint8Array(res * res * 3);
    const wl = getActiveChunk().ocean?.level ?? -1e4;
    const c = new THREE.Color();
    const hs = new Float32Array(res * res);
    for (let iz = 0; iz < res; iz++) {
      if (iz > 0 && iz % 64 === 0) yield;
      for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
    }
    const H = (ix: number, iz: number): number => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
    for (let iz = 0; iz < res; iz++) {
      if (iz > 0 && iz % 64 === 0) yield;
      for (let ix = 0; ix < res; ix++) {
        const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
        const y = H(ix, iz);
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const [, ny] = normalAt(x, z, d * 0.5);
        // a cliff's top edge (L6): steep here but nothing much higher within 2.5 m → the grass lips over it
        let lip = 0;
        if (ny < 0.8) { const hi = Math.max(heightAt(x + 2.5, z), heightAt(x - 2.5, z), heightAt(x, z + 2.5), heightAt(x, z - 2.5)); lip = 1 - ss(hi - y, 0.4, 1.4); }
        let h = y - wl, slope = 1 - ny;
        if (h < 0) {
          // a facet takes its provoking (last) vertex's colour — this one's facets span it and these neighbours (the index
          // pattern below). One that climbs out of the sea is a wall, not seabed: coloured at its middle height and its own
          // slope, or the creek's walls went seabed-teal (royal blue in shade) up to a cell above the water (E125)
          const top = Math.max(H(ix - 1, iz - 1), H(ix, iz - 1), H(ix - 1, iz), H(ix - 1, iz + 1), H(ix, iz + 1)) - wl;
          if (top > 0) { slope = Math.max(slope, 1 - d / Math.hypot(d, top - h)); h = (h + top) * 0.5; }
        }
        lowPolyGroundColor(c, h, slope, x, z, lip);
        // the sand paths: trails above the beach are painted sand over the grass (a 3 m bed with a soft edge)
        if (y - wl > 1.5) { const td = trailDistance(x, z); if (td < 4.5) { _pathC.copy(LP.path).multiplyScalar(0.94 + hash2(x, z) * 0.12); c.lerp(_pathC, 1 - ss(td, 2.2, 4.5)); } }
        // clamped: a Uint8Array wraps 256+ to ~0, so a bright sand facet jittered over 1.0 turned mint (r 1.07 → 17)
        col[i * 3] = Math.min(255, Math.round(c.r * 255)); col[i * 3 + 1] = Math.min(255, Math.round(c.g * 255)); col[i * 3 + 2] = Math.min(255, Math.round(c.b * 255));
      }
    }
    const idx = new Uint32Array(n * n * 6);
    let k = 0;
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const a = iz * res + ix, b = a + 1, cc = a + res, dd = cc + 1;
      // alternate the diagonal per cell so the facets don't all lean the same way; the last index is the provoking vertex
      idx[k++] = a; idx[k++] = cc;
      if ((ix + iz) & 1) { idx[k++] = dd; idx[k++] = a; idx[k++] = dd; idx[k++] = b; }
      else { idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = dd; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  private buildLowPolySlab() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    const segs = 96;
    const verts: number[] = [], cols: number[] = [];
    const H = CHUNK_HALF, D = -CHUNK_DEPTH;
    const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
      { a: [-H, -H], b: [H, -H], n: [0, -1] }, { a: [H, -H], b: [H, H], n: [1, 0] }, { a: [H, H], b: [-H, H], n: [0, 1] }, { a: [-H, H], b: [-H, -H], n: [-1, 0] },
    ];
    const rock = new THREE.Color('#5a5d63'), deep = new THREE.Color('#1c1f26');
    const c = new THREE.Color();
    const push = (x: number, y: number, z: number, jit: number) => {
      verts.push(x, y, z);
      c.lerpColors(rock, deep, THREE.MathUtils.clamp(-y / CHUNK_DEPTH, 0, 1)).multiplyScalar(0.85 + jit * 0.3);
      cols.push(c.r, c.g, c.b);
    };
    for (const s of sides) {
      const ring: [number, number, number][][] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
        const j = (Math.sin(i * 12.9898 + s.n[0] * 3) * 43758.5453) % 1; // deterministic jitter
        const bulge = 4 + Math.abs(j) * 5;
        ring.push([[x, heightAt(x, z) + 0.05, z], [x + s.n[0] * bulge, D * 0.55, z + s.n[1] * bulge], [x + s.n[0] * 2, D, z + s.n[1] * 2]]);
      }
      for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
        const ri = ring[i], rn = ring[i + 1];
        if (!ri || !rn) continue;
        const a0 = ri[k], a1 = ri[k + 1], b0 = rn[k], b1 = rn[k + 1];
        if (!a0 || !a1 || !b0 || !b1) continue;
        const j = Math.abs((Math.sin(i * 7.31 + k * 3.7) * 1234.5) % 1);
        push(...a0, j); push(...b0, j); push(...a1, j);
        push(...b0, j); push(...b1, j); push(...a1, j);
      }
    }
    // bottom
    push(-H, D, -H, 0); push(H, D, H, 0); push(H, D, -H, 0); push(-H, D, -H, 0); push(-H, D, H, 0); push(H, D, H, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildGeometry() {
    const res = TERRAIN_RES;
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, res - 1, res - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const splat = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const s = splatAt(x, z);
      splat.set(s, i * 4);
    }
    geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildMaterial(layers: { map: THREE.DataArrayTexture; normalMap: THREE.DataArrayTexture; armMap: THREE.DataArrayTexture }) {
    // a dummy 1×1 normal map keeps three's USE_NORMALMAP path (tbn) alive; the real layers are the arrays
    const dummy = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); dummy.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ normalMap: dummy, metalness: 0, roughness: 1, normalScale: new THREE.Vector2(1, 1) });
    const ground = groundSet(getActiveChunk());
    const u = {
      tDiff: { value: layers.map },
      tNorm: { value: layers.normalMap },
      tArm: { value: layers.armMap },
      uTints: { value: ground.tints.map((t) => new THREE.Vector3(...t)) },
      uNormalK: { value: new THREE.Vector4(...(ground.boreal?.normalK ?? [1, 1, 1, 1])) },
      uTrailDust: { value: new THREE.Vector4(...(ground.boreal?.trailDust ?? [1, 1, 1, 0])) },
    };
    const boreal = ground.boreal !== null;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      attachFogUniforms(shader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 splat;
          attribute float canopy;
          varying vec4 vSplat;
          varying float vCanopy;
          varying vec3 vWPos;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vSplat = splat;
          vCanopy = canopy;
          vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          precision highp sampler2DArray;
          uniform sampler2DArray tDiff;
          uniform sampler2DArray tNorm;
          uniform sampler2DArray tArm;
          uniform vec3 uTints[4];
          varying vec4 vSplat;
          varying float vCanopy;
          varying vec3 vWPos;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          vec4 sampleLayer(sampler2DArray t, int i, vec2 uv, float camDist) {
            vec2 uvA = uv * 0.28;               // ~3.6 m tiles up close
            vec2 uvB = uv * 0.034 + 0.37;       // ~30 m tiles far away
            float k = smoothstep(18.0, 70.0, camDist);
            vec4 a = texture(t, vec3(uvA, float(i)));
            vec4 b = texture(t, vec3(uvB, float(i)));
            return mix(a, b, k);
          }
          ${boreal ? BOREAL_COMMON : ''}`)
        .replace('#include <map_fragment>', boreal ? BOREAL_MAP : `
          float camDist = length(vWPos - cameraPosition);
          vec2 tuv = vWPos.xz;
          vec4 w = vSplat;
          w = pow(max(w, vec4(0.0)), vec4(2.2)); w /= max(w.x + w.y + w.z + w.w, 1e-5); // guarded: a 0 / 0 here was a NaN pixel, and bloom spreads one NaN into a black square (E67)
          vec4 alb = vec4(0.0);
          vec3 nrm = vec3(0.0);
          vec3 arm = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            float wi = w[i];
            if (wi < 0.004) continue;
            vec4 l = sampleLayer(tDiff, i, tuv, camDist); l.rgb *= uTints[i];
            alb += l * wi;
            nrm += (sampleLayer(tNorm, i, tuv, camDist).xyz * 2.0 - 1.0) * wi;
            arm += sampleLayer(tArm, i, tuv, camDist).xyz * wi;
          }
          float macro = hash21(floor(tuv * 0.05)) * 0.12 + 0.94;
          float macro2 = mix(0.88, 1.08, smoothstep(-1.0, 1.0, sin(tuv.x * 0.021 + tuv.y * 0.017) + sin(tuv.x * 0.009 - tuv.y * 0.013)));
          alb.rgb *= macro * macro2;
          alb.rgb *= mix(1.0, 0.55, vCanopy);
          diffuseColor *= alb;
          vec3 splatNormal = dot(nrm, nrm) > 1e-8 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
          vec3 splatArm = arm;`)
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 wx = normalize( ( viewMatrix * vec4( 1.0, 0.0, 0.0, 0.0 ) ).xyz );
            vec3 wz = normalize( ( viewMatrix * vec4( 0.0, 0.0, 1.0, 0.0 ) ).xyz );
            vec3 T = normalize( wx - normal * dot( normal, wx ) );
            vec3 B = normalize( wz - normal * dot( normal, wz ) - T * dot( T, wz ) );
            vec3 mapN = splatNormal; mapN.xy *= normalScale;
            normal = normalize( mat3( T, B, normal ) * mapN );
          }`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * splatArm.g;`)
        .replace('#include <metalnessmap_fragment>', `float metalnessFactor = metalness;`)
        .replace('#include <aomap_fragment>', `
          float ambientOcclusion = ( splatArm.r - 1.0 ) * 0.9 + 1.0;
          reflectedLight.indirectDiffuse *= ambientOcclusion;`);
    };
    mat.customProgramCacheKey = () => (boreal ? 'terrain-splat-boreal' : 'terrain-splat');
    this.material = mat;
    return mat;
  }

  /** The chunk is a floating shard: rock walls from the surface down to -CHUNK_DEPTH. */
  private async buildSlab() {
    const rock = await loadPBR(getActiveChunk().assets.slabRock);
    const mat = pbrMaterial(rock, { color: new THREE.Color(0.55, 0.52, 0.5), side: THREE.FrontSide });
    const depth = CHUNK_DEPTH.toFixed(1);
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vSlabY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSlabY = (modelMatrix * vec4(transformed,1.0)).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSlabY;')
        .replace('#include <map_fragment>', `
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float depthT = clamp((-vSlabY) / ${depth}, 0.0, 1.0);
          sampledDiffuseColor.rgb *= mix(1.0, 0.4, depthT);
          diffuseColor *= sampledDiffuseColor;`);
    };
    mat.customProgramCacheKey = () => 'slab';

    const segs = 96;
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
    const H = CHUNK_HALF, D = -CHUNK_DEPTH;
    const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
      { a: [-H, -H], b: [H, -H], n: [0, -1] },
      { a: [H, -H], b: [H, H], n: [1, 0] },
      { a: [H, H], b: [-H, H], n: [0, 1] },
      { a: [-H, H], b: [-H, -H], n: [-1, 0] },
    ];
    for (const s of sides) {
      const base = verts.length / 3;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
        const top = heightAt(x, z) + 0.05;
        verts.push(x, top, z, x + s.n[0] * 6, D * 0.55, z + s.n[1] * 6, x + s.n[0] * 2, D, z + s.n[1] * 2);
        norms.push(s.n[0], 0, s.n[1], s.n[0], 0, s.n[1], s.n[0], 0, s.n[1]);
        const along = (s.n[0] !== 0 ? z : x) * 0.08;
        uvs.push(along, top * 0.08, along, D * 0.55 * 0.08, along, D * 0.08);
      }
      for (let i = 0; i < segs; i++) {
        const c0 = base + i * 3, c1 = base + (i + 1) * 3;
        idx.push(c0, c1, c0 + 1, c1, c1 + 1, c0 + 1, c0 + 1, c1 + 1, c0 + 2, c1 + 1, c1 + 2, c0 + 2);
      }
    }
    const b0 = verts.length / 3;
    verts.push(-H, D, -H, H, D, -H, H, D, H, -H, D, H);
    norms.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
    uvs.push(0, 0, 10, 0, 10, 10, 0, 10);
    idx.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
}

type Seg = [number, number, number, number];
function trailSegments(): Seg[] {
  const out: Seg[] = [];
  for (const poly of TRAILS) for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1]; if (a && b) out.push([a[0], a[1], b[0], b[1]]); }
  return out;
}
/**
 * out = [metres to the nearest trail centreline signed by which side of it (x, z) lies (`cap` when farther), the
 * nearest segment's unit direction x, z] — the road's painted texture is laid along that direction
 */
function signedTrailDistance(segs: Seg[], x: number, z: number, cap: number, out: [number, number, number]): void {
  let best = cap, sign = 1, dx = 1, dz = 0;
  for (const [ax, az, bx, bz] of segs) {
    const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az;
    const l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, (wx * vx + wz * vz) / l2)) : 0;
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < best) { best = d; sign = vx * wz - vz * wx >= 0 ? 1 : -1; const l = Math.sqrt(l2) || 1; dx = vx / l; dz = vz / l; }
  }
  out[0] = best * sign; out[1] = dx; out[2] = dz;
}

/** One facet's colour from its height above the sea (m), slope (0 flat → 1 vertical) and position (jitter). */
/**
 * One facet's colour from its height above the sea (m), slope (0 flat → 1 vertical) and position (jitter). `lip` (0..1)
 * marks a steep facet at the top edge of a cliff: it keeps the grass (the mockups' grass-topped cliff lips, L6).
 */
export function lowPolyGroundColor(out: THREE.Color, h: number, slope: number, x: number, z: number, lip = 0): THREE.Color {
  if (h < 0) out.lerpColors(LP.seabed, LP.wetSand, ss(h, -1.6, 0));
  else out.lerpColors(LP.wetSand, LP.sand, ss(h, 0.25, 0.55));                 // a distinct dark wet band along the swash line
  // grass takes over above the beach, darker in the folds, sun-bleached lighter as the ground climbs
  const g = ss(h, 2.9, 3.5);                                                  // a hard sand → grass line
  if (g > 0) {
    _tmpC.lerpColors(LP.grass, LP.grassDark, hash2(Math.floor(x * 0.11), Math.floor(z * 0.11)) * 0.6);
    _tmpC.lerp(LP.grassHigh, ss(h, 6, 24) * 0.7);
    out.lerp(_tmpC, g);
  }
  // rock on the steep facets (a hair lighter on the flatter ledges, faint strata bands) — except a grass lip on the rim
  const r = ss(slope, 0.3, 0.36) * (1 - lip * ss(h, 2.5, 4.5));              // a hard grass → rock line: crisp faceted crags
  if (r > 0) {
    _tmpC.lerpColors(LP.rock, LP.rockLight, 1 - ss(slope, 0.45, 0.8)).multiplyScalar(0.92 + 0.1 * Math.sin(h * 1.4 + hash2(Math.floor(x * 0.05), 0) * 2));
    out.lerp(_tmpC, r);
  }
  // per-facet jitter so the flat shading reads as facets, not a gradient
  return out.multiplyScalar(0.93 + hash2(x, z) * 0.14);
}
