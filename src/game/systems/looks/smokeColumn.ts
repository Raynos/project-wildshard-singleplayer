import * as THREE from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';

/**
 * A thin, broken smoke column off a fire as rows (SHARD-PLATFORM M3, look-family rows): ONE Points cloud whose puffs
 * rise (slowing as they cool), lean downwind more the higher they climb, wander on their own slow turbulence, grow as
 * they climb and fade in over the fire and out toward the top (per-puff size and alpha spliced into the stock points
 * shader), each on its own life speed so the column breaks up. From far off it is a breadcrumb; up close it thins out so
 * it never fogs the view; past `far` it stops animating. Nothing here knows a shard: its numbers are a row in its `data/`.
 *
 *   const smoke = new SmokeColumn(row, fireLocal);   // in the parent's frame
 *   group.add(smoke.points);
 *   game.onUpdate((dt) => smoke.update(dt, distanceToViewer));
 */

/** A smoke column's numbers as data. */
export interface SmokeColumnRow {
  /** puffs, metres the column climbs, seconds a puff lives, the per-puff life speed (base, jittered gain), the seed spread
   *  and the seed's step each time a puff restarts, and the start seed of the column's LCG */
  readonly count: number;
  readonly rise: number;
  readonly life: number;
  readonly rate: readonly [number, number];
  readonly seedSpread: number;
  readonly reseed: number;
  readonly seed: number;
  /** the rise's eased and linear shares, the base over the fire (m), the lean (m at the top) and the wind (x, z) */
  readonly ease: number;
  readonly linear: number;
  readonly base: number;
  readonly lean: number;
  readonly wind: readonly [number, number];
  /** the wander: [frequency on age, frequency on seed, base reach, reach gained by the top] for x, then z */
  readonly wanderX: readonly [number, number, number, number];
  readonly wanderZ: readonly [number, number, number, number];
  /** the puff's size (base, gained by the top), the fade in (age share), the fade out (age share) and its power, and the
   *  thinning (base, sine gain, seed frequency) */
  readonly size: readonly [number, number];
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly fadePow: number;
  readonly thin: readonly [number, number, number];
  /** the colour (linear), the opacity before the first update, the opacity close (base) and gained from `opacityFrom` to `opacityTo` m, and the distance past
   *  which the puffs stop */
  readonly color: readonly [number, number, number];
  readonly startOpacity: number;
  readonly opacity: readonly [number, number];
  readonly opacityFrom: number;
  readonly opacityTo: number;
  readonly far: number;
  /** the bounding sphere's centre off the fire and its radius, the render order, the material's name and its patch */
  readonly bounds: { readonly offset: readonly [number, number, number]; readonly radius: number };
  readonly renderOrder: number;
  readonly name: string;
  readonly patch: { readonly id: string; readonly key: string };
}

const puffs = new Map<string, THREE.CanvasTexture>();
/** The soft round puff every column shares: a white radial gradient on a 64² canvas. */
function puffTexture(): THREE.CanvasTexture {
  const known = puffs.get('puff');
  if (known !== undefined) return known;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g === null) throw new Error('SmokeColumn: no 2d context');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  puffs.set('puff', tex);
  return tex;
}

/** A smoke column (one Points draw) rising from a fire in its parent's frame. */
export class SmokeColumn {
  /** the cloud: add it to the fire's parent */
  readonly points: THREE.Points;
  private readonly row: SmokeColumnRow;
  private readonly at: THREE.Vector3;
  private readonly mat: THREE.PointsMaterial;
  private readonly pos: Float32Array;
  private readonly age: Float32Array;
  private readonly rate: Float32Array;
  private readonly seed: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;

  constructor(row: SmokeColumnRow, at: THREE.Vector3) {
    this.row = row; this.at = at;
    const n = row.count;
    this.pos = new Float32Array(n * 3); this.age = new Float32Array(n); this.rate = new Float32Array(n);
    this.seed = new Float32Array(n); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1); this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aSize', this.sizeAttr); g.setAttribute('aAlpha', this.alphaAttr);
    const o = row.bounds.offset;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(at.x + o[0], at.y + o[1], at.z + o[2]), row.bounds.radius);
    let hs = row.seed;
    const rnd = () => { hs = (Math.imul(hs, 1103515245) + 12345) & 0x7fffffff; return hs / 0x7fffffff; };
    for (let i = 0; i < n; i++) { this.age[i] = rnd(); this.rate[i] = row.rate[0] + rnd() * row.rate[1]; this.seed[i] = rnd() * row.seedSpread; this.place(i); }
    const mat = this.mat = new THREE.PointsMaterial({ color: new THREE.Color(row.color[0], row.color[1], row.color[2]), size: 1, sizeAttenuation: true, transparent: true, opacity: row.startOpacity, depthWrite: false, map: puffTexture(), fog: true });
    mat.name = row.name;
    // per-puff size + alpha: the stock points shader with two attributes spliced in
    patchShader(mat, row.patch.id, PATCH_ORDER.material, (sh) => {
      attachFogUniforms(sh);
      sh.vertexShader = sh.vertexShader
        .replace('uniform float size;', 'uniform float size;\nattribute float aSize;\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;\n\tvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform float opacity;', 'uniform float opacity;\nvarying float vAlpha;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );');
    }, { mode: 'replace', key: row.patch.key });
    this.points = new THREE.Points(g, mat);
    this.points.renderOrder = row.renderOrder;
  }

  private place(i: number): void {
    const r = this.row, age = this.age[i] ?? 0, sd = this.seed[i] ?? 0, f = this.at, j = i * 3, wx = r.wanderX, wz = r.wanderZ;
    // rise slows as it cools; the lean grows with height; each puff wanders on its own slow turbulence
    const rise = r.rise * (1 - (1 - age) * (1 - age)) * r.ease + age * r.rise * r.linear, lean = age * age * r.lean;
    const tx = Math.sin(age * wx[0] + sd * wx[1]) * (wx[2] + age * wx[3]), tz = Math.cos(age * wz[0] + sd * wz[1]) * (wz[2] + age * wz[3]);
    this.pos[j] = f.x + r.wind[0] * lean + tx;
    this.pos[j + 1] = f.y + r.base + rise;
    this.pos[j + 2] = f.z + r.wind[1] * lean + tz;
    // thin at the fire, spreading as it climbs; in over the first metre, out long before the top; some puffs thinner (broken)
    this.size[i] = r.size[0] + age * r.size[1];
    const thin = r.thin[0] + r.thin[1] * (0.5 + 0.5 * Math.sin(sd * r.thin[2]));
    this.alpha[i] = Math.min(1, age / r.fadeIn) * Math.min(1, (1 - age) / r.fadeOut) ** r.fadePow * thin;
  }

  /** Thin the column with the viewer's distance `d` (m) and, nearer than `far`, move every puff on by `dt` s. */
  update(dt: number, d: number): void {
    const r = this.row;
    this.mat.opacity = r.opacity[0] + r.opacity[1] * THREE.MathUtils.smoothstep(d, r.opacityFrom, r.opacityTo);
    if (d > r.far) return;
    for (let i = 0; i < r.count; i++) {
      let a = (this.age[i] ?? 0) + (dt / r.life) * (this.rate[i] ?? 1);
      if (a > 1) { a -= 1; this.seed[i] = (this.seed[i] ?? 0) + r.reseed; }
      this.age[i] = a; this.place(i);
    }
    this.posAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true;
  }
}
