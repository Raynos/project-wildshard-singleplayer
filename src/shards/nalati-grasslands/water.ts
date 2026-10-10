/**
 * Nalati's water: the braided Kunes (a strip over its gravel corridor) and the meltwater stream in Snow Lotus Valley
 * (`BROOK`: a ribbon down its bed; the waterfall is cut, layout v2). One shared shader, painterly: the colour
 * comes from the water's depth over the terrain (turquoise over the gravel bars → deep blue in the channels), a pale
 * sky sheen at grazing angles, and white flow streaks that run downstream — westward (+x) on the river, down the
 * ribbon on the brook. Fogged like everything else. Two draw calls, one program.
 *
 *   const water = new NalatiWater(sky).build();  scene.add(water.group);  water.update(dt);
 *   water.setLight({ brightness, sky, sun });  water.setRain(0..1);   // day/night + weather (src/shards/nalati-grasslands/weather.ts)
 */
import * as THREE from 'three';
import { MELT_STREAM as BROOK } from './layout';
import { RIVER } from './world/terrain';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { setProgramKey } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { WATER_GLSL } from './data/waterGlsl';

/** the GLSL below is data (data/waterGlsl.ts); `@{name}` splices the fragments this module passes */
const WATER_GLSL_FAMILY = new ShaderFamily(WATER_GLSL, {});

const VERT = WATER_GLSL_FAMILY.glsl(WATER_GLSL.VERT);

const FRAG = WATER_GLSL_FAMILY.glsl(WATER_GLSL.FRAG);

const byGroup = new WeakMap<THREE.Object3D, NalatiWater>();
/** the NalatiWater that built this group (the weather reaches the water through the group it is handed) */
export function waterOf(group: THREE.Object3D): NalatiWater | null { return byGroup.get(group) ?? null; }

export class NalatiWater {
  group = new THREE.Group();
  private uniforms = {
    uTime: { value: 0 },
    // the glacial Kunes as the mockups paint it from above — milky turquoise over the bars, deep teal-blue in the channels
    uShallow: { value: new THREE.Color(0.3, 0.6, 0.62) },
    uDeep: { value: new THREE.Color(0.06, 0.28, 0.4) },
    uSky: { value: new THREE.Color(0.62, 0.78, 0.98) },
    uFoam: { value: new THREE.Color(0.95, 0.98, 1.0) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 0.9, 0.7) },
    uBright: { value: 1 },
    uRain: { value: 0 },
    /** far off, the water settles to its own colour (0) or to a pale sky-grey (1: no turquoise line at eye level) */
    uFarPale: { value: 1 },
  };

  constructor(private sky: Sky) {
    byGroup.set(this.group, this);
  }

  /** the glint colour the water was painted with (the day's sun) */
  get sunColor(): THREE.Color { return this.uniforms.uSunCol.value; }

  build(): this {
    this.uniforms.uSunDir.value.copy(this.sky.sunDir);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: false, depthWrite: true,
      side: THREE.DoubleSide, // the fall's sheet is seen from both sides (one material, one program for all three)
    });
    Object.assign(mat.uniforms, this.uniforms);
    attachFogUniforms(mat);
    setProgramKey(mat, 'nalati-water');
    this.group.add(this.river(mat), this.brook(mat)); // (the waterfall is cut: layout v2)
    this.group.traverse((o) => { o.renderOrder = 1; });
    return this;
  }

  update(dt: number): void { this.uniforms.uTime.value += dt; }

  /**
   * The light on the water, for the day/night clock and the weather (the shader is unlit: its colours are painted):
   * `brightness` scales everything (1 = the day it was painted for, ~0.1 at night), `sky` is the colour it reflects at
   * grazing angles (the live horizon), `sun` the glint colour × intensity. Omitted fields are left as they are.
   */
  setLight(o: { brightness?: number; sky?: THREE.Color; sun?: THREE.Color }): void {
    if (o.brightness !== undefined) this.uniforms.uBright.value = o.brightness;
    if (o.sky) this.uniforms.uSky.value.copy(o.sky);
    if (o.sun) this.uniforms.uSunCol.value.copy(o.sun);
  }

  /** rain on the water, 0 (dry) … 1 (a downpour): flickering drop rings over the whole surface */
  setRain(wetness: number): void { this.uniforms.uRain.value = Math.min(1, Math.max(0, wetness)); }

  /** the Kunes: a strip following the corridor's centreline, full width, with per-vertex depth over the bed */
  private river(mat: THREE.Material): THREE.Mesh {
    const nx = 256, nz = 32, x0 = -CHUNK_HALF - 2, x1 = CHUNK_HALF + 2;
    const pos: number[] = [], depth: number[] = [], flow: number[] = [], across: number[] = [], fall: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, zc = RIVER.z(x), half = RIVER.half(x) + 4;
      for (let j = 0; j <= nz; j++) {
        const u = (j / nz) * 2 - 1, z = zc + u * half;
        pos.push(x, RIVER.level, z);
        depth.push(RIVER.level - heightAt(x, z)); flow.push((x - x0) / (x1 - x0)); across.push(u); fall.push(0);
      }
    }
    // only the wet channels get a surface: a cell whose four corners all stand on dry gravel is left out
    const wet = (k: number): boolean => (depth[k] ?? 0) > 0.02;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j, b = a + nz + 1;
      if (!wet(a) && !wet(a + 1) && !wet(b) && !wet(b + 1)) continue;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return mesh(mat, pos, idx, { depth, flow, across, fall });
  }

  /** the plateau brook: a 3 m ribbon along its polyline, 0.25 m under the bed's lip */
  private brook(mat: THREE.Material): THREE.Mesh {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < BROOK.length - 1; i++) {
      const a = BROOK[i], b = BROOK[i + 1];
      if (!a || !b) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
      for (let k = 0; k < n; k++) pts.push(new THREE.Vector2(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n));
    }
    const last = BROOK[BROOK.length - 1];
    if (last) pts.push(new THREE.Vector2(last[0], last[1] - 2)); // to the lip of the fall
    // the melt comes out at the foot of the glacier's wall, not up it: the head of the polyline lies on the steep face
    // (the draped ribbon climbed it as a pale strip — E302, NALATI-FINISH B2), so it starts where the bed's grade over the
    // next ~9 m eases under 1 : 4, and fades in over its first few metres
    let head = 0;
    for (let i = 0; i + 3 < pts.length; i++) {
      const a = pts[i], b = pts[i + 3];
      if (!a || !b) continue;
      if ((heightAt(a.x, a.y) - heightAt(b.x, b.y)) / Math.max(1, a.distanceTo(b)) < 0.25) { head = i; break; }
    }
    pts.splice(0, head);
    const pos: number[] = [], depth: number[] = [], flow: number[] = [], across: number[] = [], fall: number[] = [], idx: number[] = [];
    const half = 1.3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      if (!p || !q || !o) continue;
      const tx = q.x - o.x, tz = q.y - o.y, tl = Math.hypot(tx, tz) || 1;
      const sx = -tz / tl, sz = tx / tl;
      // draped: each vertex just over the ground under it (the 2 m terrain grid only half-resolves the bed, so a flat
      // surface at the bed's level would float over the rendered banks and read as a line across the hill)
      const yBed = heightAt(p.x, p.y);
      for (const u of [-1, 0, 1]) {
        const x = p.x + sx * half * u, z = p.y + sz * half * u;
        const y = Math.min(yBed + 0.45, heightAt(x, z) + 0.18);
        const fadeIn = Math.min(1, i / 3);
        pos.push(x, y, z); depth.push(u === 0 ? 0.5 * fadeIn : 0.04 * fadeIn); flow.push(i / pts.length * 0.35); across.push(u); fall.push(1);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 2; j++) {
      const a = i * 3 + j, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return mesh(mat, pos, idx, { depth, flow, across, fall });
  }
}

function mesh(mat: THREE.Material, pos: number[], idx: number[], attrs: Record<string, number[]>): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const [k, v] of Object.entries(attrs)) geo.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}
