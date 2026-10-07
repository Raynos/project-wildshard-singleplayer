import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '../core/config';
import { captureHeightfield, type HeightfieldBinding } from './Heightfield';
import { loadPBR, loadPBRArray, pbrMaterial } from '../core/assets';
import { attachFogUniforms } from './Atmosphere';
import { activeLevel } from '../level/selection';
import { loadBakedTerrain } from './BakedTerrain';
import { macrotask } from '../boot/plan';
import { groundSet } from './lookFlags';
import type { PainterField, TerrainPainter } from '../render/look';
import type { Scope } from '../app/scope';
import type { LevelAssets, TerrainField } from '../level/data';
import type { LevelSpec } from '../level/spec';
import { PATCH_ORDER, patchShader } from '../render/shaderPatches';

/**
 * The boreal ground (PINE-HOLLOW PH-L8, `ChunkAssets.boreal`; a shard without it builds the plain shader above). Over the same
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
          // the trails' edges broken by the litter (a ragged, trodden verge instead of a clean 11 m gravel band). E142 (the
          // 30-fps-at-2× lane): each noise below is evaluated only where its layer is present — the same result (a weight of 0
          // zeroes the term), −0.03…−0.06 ms on the M5 at 1206×2622
          if (w.w > 0.0) {
            float erode = vnoise(tuv * 0.35) * 0.6 + vnoise(ROT_F * tuv * 1.3 + 4.0) * 0.4;
            float wt = w.w * smoothstep(0.1, 0.6, w.w + (erode - 0.5) * 0.7);
            w.x += w.w - wt; w.w = wt;
          }
          float kFar = smoothstep(18.0, 70.0, camDist);
          vec2 gx = dFdx(tuv), gy = dFdy(tuv);
          float tb = kFar < 0.999 ? smoothstep(0.3, 0.7, vnoise(tuv * 0.11)) : 0.0; // sampleB reads it only below kFar 0.999
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
          float openW = w.x * (1.0 - cano);
          float open = openW > 0.0 ? openW * mix(0.35, 0.8, smoothstep(0.25, 0.75, vnoise(ROT_F * tuv * 0.05 + 11.0) * 0.7 + vnoise(tuv * 0.23) * 0.3)) : 0.0;
          if (open > 0.004) {
            vec3 gr = sampleS(tDiff, 1, ROT_M * tuv + 5.3, kFar, ROT_M * gx, ROT_M * gy).rgb * vec3(0.62, 0.68, 0.44);
            alb.rgb = mix(alb.rgb, gr, open);
          }
          // heath: bilberry / heather mats on the open floor and the grass (darker olive, ~1.5 m patches), none on trails / rock
          float heathW = (w.x + w.y) * (1.0 - 0.6 * cano);
          float heath = heathW > 0.0 ? smoothstep(0.44, 0.72, vnoise(ROT_B * tuv * 0.62 + 2.0) * 0.7 + vnoise(tuv * 1.9) * 0.3) * heathW : 0.0;
          alb.rgb = mix(alb.rgb, alb.rgb * vec3(0.52, 0.62, 0.36), heath * 0.85);
          // feather moss: patches over the litter, thickest in the shade
          float moss = w.x > 0.0 ? w.x * smoothstep(0.45, 0.68, vnoise(tuv * 0.07) * 0.65 + vnoise(ROT_M * tuv * 0.29 + 3.1) * 0.35) * (0.3 + 0.7 * cano) : 0.0;
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

/** what a level look's terrain painter samples: the live heightfield (its bindings swap when the bake lands) */
function painterField(binding: HeightfieldBinding): PainterField {
  return {
    ready: () => loadBakedTerrain(binding),
    heightAt: (x, z) => binding.field.heightAt(x, z),
    normalAt: (x, z, eps) => binding.field.normalAt(x, z, eps),
    trails: () => binding.field.trails,
    trailDistance: (x, z) => binding.field.trailDistance(x, z),
  };
}

export class Terrain {
  group = new THREE.Group();
  private builtMesh: THREE.Mesh | undefined;
  get mesh(): THREE.Mesh {
    if (this.builtMesh === undefined) throw new Error('Terrain: this world has no terrain mesh');
    return this.builtMesh;
  }
  set mesh(mesh: THREE.Mesh) { this.builtMesh = mesh; }
  material!: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  /** Bake a 0..1 canopy-density map (from Forest) into a per-vertex attribute → ambient darkening under trees. */
  applyCanopy(tex: THREE.DataTexture): void {
    if (this.builtMesh === undefined) return;
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
    if (this.builtMesh === undefined) return 0;
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

  /** `painter`: the level look's own ground; an explicit binding supplies regional assets/terrain across awaits. */
  async build(ground: LevelSpec['ground'], painter?: TerrainPainter, scope?: Scope, binding?: HeightfieldBinding): Promise<this> {
    const captured = binding ?? captureHeightfield();
    if (ground.structures === true && ground.terrain === undefined) return this;
    if (ground.structures === true) return this.buildNone();
    if (painter !== undefined) {
      if (scope === undefined || scope.disposed) throw new Error('TerrainPainter.build requires a live owning level scope');
      await painter.build(this, painterField(captured), scope);
      return this;
    }
    const { assets } = binding === undefined ? activeLevel() : binding.level;
    const [layers] = await Promise.all([loadPBRArray([...groundSet({ assets }).layers], 1024), loadBakedTerrain(captured)]); // baked heights/splat → captured frame
    await macrotask(); // the layer copies above and the mesh below were one ~110 ms task at 4x CPU
    this.mesh = new THREE.Mesh(this.buildGeometry(captured.field), this.buildMaterial(layers, assets));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(await this.buildSlab(assets, captured.field));
    return this;
  }

  /**
   * A structure-first shard (ShardManifest.ground.structures, Nine Dragon Stack): its floors are built, so no ground is drawn — an
   * empty mesh keeps the canopy / punch calls working, nothing is downloaded or drawn.
   */
  private buildNone(): this {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.material = new THREE.MeshLambertMaterial();
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.group.add(this.mesh);
    return this;
  }

  private buildGeometry(field: TerrainField) {
    const res = TERRAIN_RES;
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, res - 1, res - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const splat = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, field.heightAt(x, z));
      const s = field.splatAt(x, z);
      splat.set(s, i * 4);
    }
    geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildMaterial(layers: { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }, assets: LevelAssets | undefined) { // texture arrays: DataArrayTexture, or CompressedArrayTexture from KTX2 (E157)
    // a dummy 1×1 normal map keeps three's USE_NORMALMAP path (tbn) alive; the real layers are the arrays
    const dummy = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); dummy.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ normalMap: dummy, metalness: 0, roughness: 1, normalScale: new THREE.Vector2(1, 1) });
    const ground = groundSet({ assets });
    const u = {
      tDiff: { value: layers.map },
      tNorm: { value: layers.normalMap },
      tArm: { value: layers.armMap },
      uTints: { value: ground.tints.map((t) => new THREE.Vector3(...t)) },
      uNormalK: { value: new THREE.Vector4(...(ground.boreal?.normalK ?? [1, 1, 1, 1])) },
      uTrailDust: { value: new THREE.Vector4(...(ground.boreal?.trailDust ?? [1, 1, 1, 0])) },
    };
    const boreal = ground.boreal !== null;
    patchShader(mat, 'engine.terrain-splat', PATCH_ORDER.material, (shader) => {
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
    }, { mode: 'replace', key: (boreal ? 'terrain-splat-boreal' : 'terrain-splat') });
    this.material = mat;
    return mat;
  }

  /** The chunk is a floating shard: rock walls from the surface down to -CHUNK_DEPTH. */
  private async buildSlab(assets: LevelAssets | undefined, field: TerrainField) {
    if (!assets) throw new Error('Terrain: a slab needs ShardManifest.assets.slabRock');
    const rock = await loadPBR(assets.slabRock);
    const mat = pbrMaterial(rock, { color: new THREE.Color(0.55, 0.52, 0.5), side: THREE.FrontSide });
    const depth = CHUNK_DEPTH.toFixed(1);
    patchShader(mat, 'engine.terrain-slab', PATCH_ORDER.material, (shader) => {
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
    }, { mode: 'replace', key: 'slab' });

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
        const top = field.heightAt(x, z) + 0.05;
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
