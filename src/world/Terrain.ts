import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '../core/config';
import { heightAt, normalAt, splatAt, trailDistance } from './Heightfield';
import { loadPBR, loadPBRArray, pbrMaterial } from '../core/assets';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import { loadBakedTerrain } from './BakedTerrain';
import { macrotask } from '../boot/plan';

// ── low-poly palette (sRGB in, linear out via THREE.Color) ──
const LP = {
  seabed: new THREE.Color('#a39b76'),
  wetSand: new THREE.Color('#c4ad78'),
  sand: new THREE.Color('#dcc48a'),
  grass: new THREE.Color('#6cae47'),
  grassDark: new THREE.Color('#4d8c33'),
  rock: new THREE.Color('#666a70'),
  rockLight: new THREE.Color('#84888e'),
  path: new THREE.Color('#d6bd84'),
};
const _tmpC = new THREE.Color(), _pathC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;
const hash2 = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

export class Terrain {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  material!: THREE.MeshStandardMaterial;
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

  async build(): Promise<this> {
    if (getActiveChunk().style === 'lowpoly') return this.buildLowPoly();
    const [layers] = await Promise.all([loadPBRArray([...getActiveChunk().assets.groundLayers], 1024), loadBakedTerrain()]); // baked heights/splat → Heightfield lookups (BakedTerrain.ts)
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
      // `flat` interpolation: the whole triangle gets its last vertex's colour (three #defines varying → out / in)
      shader.vertexShader = shader.vertexShader.replace('varying vec4 vColor;', 'flat varying vec4 vColor;');
      shader.fragmentShader = shader.fragmentShader.replace('varying vec4 vColor;', 'flat varying vec4 vColor;');
    };
    mat.customProgramCacheKey = () => 'terrain-lowpoly';
    this.material = mat;
    const rows = this.buildLowPolyGeometry();
    let r = rows.next();
    while (r.done !== true) { await macrotask(); r = rows.next(); } // a band of rows per task: the 256² grid was one ~120 ms task at 4x CPU
    this.mesh = new THREE.Mesh(r.value, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(this.buildLowPolySlab());
    return this;
  }

  /** The low-poly grid; yields after every band of 64 rows (the caller ends the task there). */
  private *buildLowPolyGeometry(): Generator<void, THREE.BufferGeometry, undefined> {
    const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
    const pos = new Float32Array(res * res * 3), col = new Uint8Array(res * res * 3);
    const wl = getActiveChunk().ocean?.level ?? -1e4;
    const c = new THREE.Color();
    for (let iz = 0; iz < res; iz++) {
      if (iz > 0 && iz % 64 === 0) yield;
      for (let ix = 0; ix < res; ix++) {
        const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
        const y = heightAt(x, z);
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const [, ny] = normalAt(x, z, d * 0.5);
        lowPolyGroundColor(c, y - wl, 1 - ny, x, z);
        // the sand paths: trails above the beach are painted sand over the grass (a 3 m bed with a soft edge)
        if (y - wl > 1.5) { const td = trailDistance(x, z); if (td < 4.5) { _pathC.copy(LP.path).multiplyScalar(0.94 + hash2(x, z) * 0.12); c.lerp(_pathC, 1 - ss(td, 2.2, 4.5)); } }
        col[i * 3] = Math.round(c.r * 255); col[i * 3 + 1] = Math.round(c.g * 255); col[i * 3 + 2] = Math.round(c.b * 255);
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
    const u = {
      tDiff: { value: layers.map },
      tNorm: { value: layers.normalMap },
      tArm: { value: layers.armMap },
      uTints: { value: getActiveChunk().assets.groundTints.map((t) => new THREE.Vector3(...t)) },
    };
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
          `)
        .replace('#include <map_fragment>', `
          float camDist = length(vWPos - cameraPosition);
          vec2 tuv = vWPos.xz;
          vec4 w = vSplat;
          w = pow(w, vec4(2.2)); w /= (w.x + w.y + w.z + w.w);
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
          vec3 splatNormal = normalize(nrm);
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
    mat.customProgramCacheKey = () => 'terrain-splat';
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

/** One facet's colour from its height above the sea (m), slope (0 flat → 1 vertical) and position (jitter). */
export function lowPolyGroundColor(out: THREE.Color, h: number, slope: number, x: number, z: number): THREE.Color {
  if (h < 0) out.lerpColors(LP.seabed, LP.wetSand, ss(h, -3, 0));
  else out.lerpColors(LP.wetSand, LP.sand, ss(h, 0, 0.9));
  // grass takes over above the beach, darker in the folds
  const g = ss(h, 2.2, 4.5);
  if (g > 0) { _tmpC.lerpColors(LP.grass, LP.grassDark, hash2(Math.floor(x * 0.11), Math.floor(z * 0.11)) * 0.6); out.lerp(_tmpC, g); }
  // rock on the steep facets (a hair lighter on the flatter ledges)
  const r = ss(slope, 0.24, 0.4);
  if (r > 0) { _tmpC.lerpColors(LP.rock, LP.rockLight, 1 - ss(slope, 0.45, 0.8)); out.lerp(_tmpC, r); }
  // per-facet jitter so the flat shading reads as facets, not a gradient
  return out.multiplyScalar(0.93 + hash2(x, z) * 0.14);
}
