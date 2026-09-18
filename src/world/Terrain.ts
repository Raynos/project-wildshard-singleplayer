import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '../core/config';
import { heightAt, splatAt } from './Heightfield';
import { loadPBR, loadPBRArray, pbrMaterial } from '../core/assets';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import { loadBakedTerrain } from './BakedTerrain';

export class Terrain {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  material!: THREE.MeshStandardMaterial;
  /** Bake a 0..1 canopy-density map (from Forest) into a per-vertex attribute → ambient darkening under trees. */
  applyCanopy(tex: THREE.DataTexture) {
    const { width: N, data } = tex.image as { width: number; data: Float32Array };
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const canopy = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + CHUNK_HALF) / CHUNK_SIZE, v = (pos.getZ(i) + CHUNK_HALF) / CHUNK_SIZE;
      const x = Math.min(N - 1, Math.max(0, Math.round(u * N))), z = Math.min(N - 1, Math.max(0, Math.round(v * N)));
      canopy[i] = data[z * N + x];
    }
    this.mesh.geometry.setAttribute('canopy', new THREE.BufferAttribute(canopy, 1));
  }

  async build() {
    if (getActiveChunk().style === 'lowpoly') return this.buildLowPoly();
    const [layers] = await Promise.all([loadPBRArray([...getActiveChunk().assets.groundLayers], 1024), loadBakedTerrain()]); // baked heights/splat → Heightfield lookups (BakedTerrain.ts)
    this.mesh = new THREE.Mesh(this.buildGeometry(), this.buildMaterial(layers));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(await this.buildSlab());
    return this;
  }

  /**
   * `style: 'lowpoly'` (Driftwood Isle): no textures at all. The same heightfield as non-indexed,
   * flat-shaded, vertex-coloured triangles — one colour per facet from its centroid's height and
   * slope (sea floor / wet sand / dry sand / grass / rock) with a little per-facet jitter so the
   * facets read. The slab walls are the same idea in dark rock. Two draw calls, no maps.
   */
  private async buildLowPoly() {
    await loadBakedTerrain();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    this.material = mat;
    this.mesh = new THREE.Mesh(this.buildLowPolyGeometry(), mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(this.buildLowPolySlab());
    return this;
  }

  private buildLowPolyGeometry() {
    const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
    const H = new Float32Array(res * res);
    for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) H[iz * res + ix] = heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
    const tris = n * n * 2;
    const pos = new Float32Array(tris * 9), col = new Uint8Array(tris * 9);
    const wl = getActiveChunk().ocean?.level ?? -1e4;
    const c = new THREE.Color();
    let p = 0;
    const put = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
      const ya = H[az * res + ax], yb = H[bz * res + bx], yc = H[cz * res + cx];
      const xa = -CHUNK_HALF + ax * d, za = -CHUNK_HALF + az * d, xb = -CHUNK_HALF + bx * d, zb = -CHUNK_HALF + bz * d, xc = -CHUNK_HALF + cx * d, zc = -CHUNK_HALF + cz * d;
      // facet slope from its own plane (this is what the flat normal will be)
      const ux = xb - xa, uy = yb - ya, uz = zb - za, vx = xc - xa, vy = yc - ya, vz = zc - za;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const slope = 1 - Math.abs(ny) / Math.hypot(nx, ny, nz);
      const h = (ya + yb + yc) / 3 - wl; // metres above the sea
      lowPolyGroundColor(c, h, slope, (xa + xb + xc) / 3, (za + zb + zc) / 3);
      const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
      pos[p] = xa; pos[p + 1] = ya; pos[p + 2] = za; pos[p + 3] = xb; pos[p + 4] = yb; pos[p + 5] = zb; pos[p + 6] = xc; pos[p + 7] = yc; pos[p + 8] = zc;
      col[p] = col[p + 3] = col[p + 6] = r; col[p + 1] = col[p + 4] = col[p + 7] = g; col[p + 2] = col[p + 5] = col[p + 8] = b;
      p += 9;
    };
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      // alternate the diagonal per cell so the facets don't all lean the same way
      if ((ix + iz) & 1) { put(ix, iz, ix, iz + 1, ix + 1, iz + 1); put(ix, iz, ix + 1, iz + 1, ix + 1, iz); }
      else { put(ix, iz, ix, iz + 1, ix + 1, iz); put(ix + 1, iz, ix, iz + 1, ix + 1, iz + 1); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
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
        const [a0, a1] = [ring[i][k], ring[i][k + 1]], [b0, b1] = [ring[i + 1][k], ring[i + 1][k + 1]];
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
    const pos = geo.attributes.position as THREE.BufferAttribute;
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

// ── low-poly palette (sRGB in, linear out via THREE.Color) ──
const LP = {
  seabed: new THREE.Color('#b9b08a'),
  wetSand: new THREE.Color('#d9c48e'),
  sand: new THREE.Color('#f3e0a6'),
  grass: new THREE.Color('#7fc44c'),
  grassDark: new THREE.Color('#5da33a'),
  rock: new THREE.Color('#6f7378'),
  rockLight: new THREE.Color('#8d9197'),
};
const _tmpC = new THREE.Color();
const hash2 = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** One facet's colour from its height above the sea (m), slope (0 flat → 1 vertical) and position (jitter). */
export function lowPolyGroundColor(out: THREE.Color, h: number, slope: number, x: number, z: number): THREE.Color {
  const ss = THREE.MathUtils.smoothstep;
  if (h < 0) out.lerpColors(LP.seabed, LP.wetSand, ss(h, -3, 0));
  else out.lerpColors(LP.wetSand, LP.sand, ss(h, 0, 0.9));
  // grass takes over above the beach, darker in the folds
  const g = ss(h, 2.2, 4.5);
  if (g > 0) { _tmpC.lerpColors(LP.grass, LP.grassDark, hash2(Math.floor(x * 0.11), Math.floor(z * 0.11)) * 0.6); out.lerp(_tmpC, g); }
  // rock on the steep facets (a hair lighter on the flatter ledges)
  const r = ss(slope, 0.42, 0.62);
  if (r > 0) { _tmpC.lerpColors(LP.rock, LP.rockLight, ss(slope, 0.9, 0.6)); out.lerp(_tmpC, r); }
  // per-facet jitter so the flat shading reads as facets, not a gradient
  return out.multiplyScalar(0.93 + hash2(x, z) * 0.14);
}
