import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '../core/config';
import { heightAt, splatAt } from './Heightfield';
import { loadPBR, pbrMaterial, type PBRSet } from '../core/assets';
import { attachFogUniforms } from './Atmosphere';

export class Terrain {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  material!: THREE.MeshStandardMaterial;

  async build() {
    const [floor, grass, rock, dirt] = await Promise.all([
      loadPBR('forest_ground_04'), loadPBR('leafy_grass'), loadPBR('rock_ground'), loadPBR('stony_dirt_path'),
    ]);
    this.mesh = new THREE.Mesh(this.buildGeometry(), this.buildMaterial([floor, grass, rock, dirt]));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    this.group.add(await this.buildSlab());
    return this;
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

  private buildMaterial(sets: PBRSet[]) {
    const mat = new THREE.MeshStandardMaterial({
      map: sets[0].map, normalMap: sets[0].normalMap, roughnessMap: sets[0].armMap, aoMap: sets[0].armMap, metalnessMap: sets[0].armMap,
      metalness: 0, roughness: 1, normalScale: new THREE.Vector2(1, 1),
    });
    const u = {
      tDiff: { value: sets.map((s) => s.map) },
      tNorm: { value: sets.map((s) => s.normalMap) },
      tArm: { value: sets.map((s) => s.armMap) },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      attachFogUniforms(shader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 splat;
          varying vec4 vSplat;
          varying vec3 vWPos;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vSplat = splat;
          vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tDiff[4];
          uniform sampler2D tNorm[4];
          uniform sampler2D tArm[4];
          varying vec4 vSplat;
          varying vec3 vWPos;
          vec4 tex4(sampler2D t[4], int i, vec2 uv) {
            if (i == 0) return texture2D(t[0], uv);
            if (i == 1) return texture2D(t[1], uv);
            if (i == 2) return texture2D(t[2], uv);
            return texture2D(t[3], uv);
          }
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          vec4 sampleLayer(sampler2D t[4], int i, vec2 uv, float camDist) {
            vec2 uvA = uv * 0.28;               // ~3.6 m tiles up close
            vec2 uvB = uv * 0.034 + 0.37;       // ~30 m tiles far away
            float k = smoothstep(18.0, 70.0, camDist);
            vec4 a = tex4(t, i, uvA);
            vec4 b = tex4(t, i, uvB);
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
            alb += sampleLayer(tDiff, i, tuv, camDist) * wi;
            nrm += (sampleLayer(tNorm, i, tuv, camDist).xyz * 2.0 - 1.0) * wi;
            arm += sampleLayer(tArm, i, tuv, camDist).xyz * wi;
          }
          float macro = hash21(floor(tuv * 0.05)) * 0.12 + 0.94;
          float macro2 = mix(0.88, 1.08, smoothstep(-1.0, 1.0, sin(tuv.x * 0.021 + tuv.y * 0.017) + sin(tuv.x * 0.009 - tuv.y * 0.013)));
          alb.rgb *= macro * macro2;
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
          float ambientOcclusion = ( splatArm.r - 1.0 ) * aoMapIntensity + 1.0;
          reflectedLight.indirectDiffuse *= ambientOcclusion;`);
    };
    mat.customProgramCacheKey = () => 'terrain-splat';
    this.material = mat;
    return mat;
  }

  /** The chunk is a floating shard: rock walls from the surface down to -CHUNK_DEPTH. */
  private async buildSlab() {
    const rock = await loadPBR('rock_ground');
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
