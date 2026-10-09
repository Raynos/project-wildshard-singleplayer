// Red paper lanterns, merged from the neon lab (the dev labs (deleted in E357 F7)): body, lacquer caps and tassel in one
// geometry, told apart by `aPart`. The paper glows hot orange where you look through it at the candle and deep cinnabar
// at the rim, with 16 antialiased bamboo ribs (procedural: the lathe's segment count only shapes the silhouette), dark
// trim bands and a slow sway. The pivot is the hook (the lantern's top), like ctx.lantern().
// Round 14 (the budget freeze, dome C2's find: ~1100 lanterns × 348 tris ≈ 390 k, all drawn always): two instanced draws
// — near (≤ LOD_NEAR m) an 8 × 6 lathe with caps and tassel (192 tris), far a 6 × 4 body alone (48 tris) — and each
// frame the visible lanterns (a sphere per lantern against the view frustum) are bucketed into them (`updateLanterns`,
// called by the render strategy before the draw). Before the first update every lantern is in the near draw (the dev page).
// (E306 M4) the lantern is a model (models/paperLantern.ts: these three lathes are its level and LODs); `Lanterns` hangs
// them (their placements, seeds and glow emitters) and culls them, handed the model's levels by `place`.
import {
  BufferGeometry, type Camera, Color, Float32BufferAttribute, Frustum, InstancedBufferAttribute, type InstancedMesh, LatheGeometry, Matrix4,
  Quaternion, ShaderMaterial, Sphere, Uint32BufferAttribute, Vector2, Vector3,
} from 'three';
import type { Emitter } from './emitters';
import type { Placement } from '@wildshard/engine/models/model';
import type { HandedBatch, InstancedCuller } from '@wildshard/engine/models/place';
import { EMIT_FOG, FOG_GLSL, NOISE_GLSL, type Shared } from './style';

const R = 0.27, H = 0.24;

/** the lantern's lathe: `rings` bands down the body, `segs` around; caps + tassel only on the near one */
export function lanternGeometry(rings: number, segs: number, dressing: boolean): BufferGeometry {
  const pts: Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = -1 + (2 * i) / rings;
    pts.push(new Vector2(Math.max(0.1, R * Math.sqrt(Math.max(0, 1 - t * t * 0.86))), t * H));
  }
  const parts: { g: BufferGeometry; part: number }[] = [{ g: new LatheGeometry(pts, segs), part: 0 }];
  if (dressing) {
    const cap = (y0: number, y1: number, r: number): BufferGeometry => new LatheGeometry([new Vector2(0, y0), new Vector2(r, y0), new Vector2(r, y1), new Vector2(0, y1)], 6);
    parts.push({ g: cap(H - 0.01, H + 0.05, 0.105), part: 1 });
    parts.push({ g: cap(-H - 0.05, -H + 0.01, 0.105), part: 1 });
    parts.push({ g: new LatheGeometry([new Vector2(0.012, -H - 0.05), new Vector2(0.03, -H - 0.2), new Vector2(0.04, -H - 0.36), new Vector2(0, -H - 0.36)], 4), part: 2 });
  }
  const pos: number[] = [], nrm: number[] = [], part: number[] = [], idx: number[] = [];
  let base = 0;
  for (const { g, part: p } of parts) {
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nrm.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      part.push(p);
    }
    const gi = g.getIndex();
    if (gi !== null) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + base);
    else for (let i = 0; i < gp.count; i++) idx.push(i + base);
    base += gp.count;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  out.setAttribute('aPart', new Float32BufferAttribute(part, 1));
  out.setIndex(new Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * A lantern string strung from `a` to `b` (E281, the fabric pass): the cord as a sagging polyline and the hooks the
 * lanterns hang from, one every `spacing` metres (a region's density: the square asks for more, the stair for fewer),
 * the cord dropping `sag` metres at mid-span. Pure geometry: the caller hangs `ctx.lantern` at each hook and draws the
 * cord (so the lanterns are these paper ones, with their LOD, glow and light pools).
 */
export function lanternString(a: Vector3, b: Vector3, spacing: number, sag: number, segs = 10): { cord: Vector3[]; hooks: Vector3[] } {
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  const cord: Vector3[] = [];
  for (let i = 0; i <= segs; i++) cord.push(at(i / segs));
  const hooks: Vector3[] = [];
  const n = Math.max(1, Math.floor(a.distanceTo(b) / Math.max(0.5, spacing)));
  for (let i = 1; i < n; i++) hooks.push(at(i / n));
  return { cord, hooks };
}

/** the near / far switch (m) */
export const LOD_NEAR = 35;
/**
 * (E283, Jake's pick: the distance LODs) past LOD_DOT m a third draw: the body as a
 * 2 × 6 lathe (24 tris, half the far one's). Its outline is within ~5 cm of the far one's, ~⅔ px there on the phone frame
 */
export const LOD_DOT = 80;
/** a lantern's bounding radius at scale 1 (body + tassel, around its centre) */
const BOUND = 0.5;

/** every built lantern set (a rebuilt shard's replace the old: `clearLanterns`) */
const live: Lanterns[] = [];
/** bucket every lantern set for this camera (the render strategy's frame hook, before the draw) */
export function updateLanterns(camera: Camera): void { for (const l of live) l.update(camera); }
/** forget the built sets (the render strategy's dispose) */
export function clearLanterns(): void { live.length = 0; }
/** The audio slice uses the same built placements as the visible lanterns. */
export function lanternAudioPositions(): Vector3[] { return live.flatMap((set) => set.emitters.map((emitter) => emitter.at.clone())); }

const VS_LANTERN = /* glsl */ `
attribute float aPart;
attribute float aSeed;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
varying float vViewZ;
void main() {
  vLocal = position; vPart = aPart; vSeed = aSeed;
  float a = sin(uTime * 0.9 + aSeed * 6.28) * 0.05;
  vec3 p = position - vec3(0.0, 0.3, 0.0);
  p = vec3(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a)) + vec3(0.0, 0.3, 0.0);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS_LANTERN = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
uniform float uTime;
uniform float uSutra;
uniform vec3 uHot;
uniform vec3 uRim;
uniform vec3 uCapCol;
uniform vec3 uTassel;
uniform vec3 uGold;
uniform float uGain;
uniform float uNear;
varying float vViewZ;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
void main() {
  vec3 V = normalize(uCam - vWorld);
  float ndv = abs(dot(normalize(vN), V));
  vec4 fg = silkFog(vWorld, 1.0);
  vec3 col;
  if (vPart < 0.5) {
    float ang = atan(vLocal.z, vLocal.x);
    float rib = abs(fract(ang / 6.2832 * 16.0) - 0.5) / 16.0 * 6.2832 * length(vLocal.xz);
    float fw = max(fwidth(rib), 1e-5);
    float ribs = 1.0 - smoothstep(0.0045, 0.0045 + fw * 1.5, rib);
    ribs *= 1.0 - smoothstep(0.004, 0.012, fw);
    float band = smoothstep(0.17, 0.2, abs(vLocal.y));
    float candle = pow(clamp(ndv, 0.0, 1.0), 2.2) * (0.6 + 0.4 * (1.0 - abs(vLocal.y) / 0.25));
    float fl = 0.93 + 0.07 * sin(uTime * 11.0 + vSeed * 40.0) * sin(uTime * 7.3 + vSeed * 13.0);
    vec3 E = mix(uRim, uHot, candle) * uGain * fl;
    E += vec3(1.0, 0.62, 0.3) * pow(clamp(ndv, 0.0, 1.0), 7.0) * (1.0 - abs(vLocal.y) / 0.25) * uGain * 0.55 * fl;
    E *= 1.0 - 0.7 * ribs;
    E = mix(E, uRim * uGain * 0.25, band * 0.8);
    E = mix(E, E * (1.0 - ribs * 0.5) + uGold * ribs * uGain * 0.4, uSutra);
    col = E * pow(max(fg.a, 1e-4), ${EMIT_FOG});
  } else if (vPart < 1.5) {
    vec3 c = mix(uCapCol, uGold * 0.8, uSutra) * (0.35 + 0.65 * pow(clamp(1.0 - ndv, 0.0, 1.0), 2.0));
    col = c * fg.a + fg.rgb;
  } else {
    col = uTassel * (0.6 + 0.4 * ndv) * fg.a + fg.rgb;
  }
  gl_FragColor = vec4(col, uNear / max(vViewZ, uNear));
}
`;

export class Lanterns implements InstancedCuller {
  readonly emitters: Emitter[] = [];
  private readonly mats: Matrix4[] = [];
  private readonly seeds: number[] = [];
  readonly material: ShaderMaterial;

  constructor(shared: Shared) {
    this.material = new ShaderMaterial({
      uniforms: {
        ...shared.u,
        uHot: { value: new Color(0xff6a3c) }, uRim: { value: new Color(0x9a0e0a) }, uCapCol: { value: new Color(0x3a2a18) },
        uTassel: { value: new Color(0xb3241a) }, uGain: { value: 1.5 },
      },
      vertexShader: VS_LANTERN, fragmentShader: FS_LANTERN,
    });
  }

  /** one lantern hanging from its hook at `top` */
  hang(top: Vector3, scale = 1): void {
    const c = top.clone();
    c.y -= 0.3 * scale;
    this.mats.push(new Matrix4().compose(c, new Quaternion(), new Vector3(scale, scale, scale)));
    this.seeds.push((this.mats.length * 0.618) % 1);
    this.emitters.push({ at: c, color: new Color(0xff4a4a), w: 0.5 * scale, h: 0.5 * scale, power: 0.18, spill: 0.3 * scale });
  }

  /** where they hang: the paper-lantern model's placements (world/build.ts places them), in hanging order */
  placements(): Placement<object>[] {
    return this.mats.map((m) => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m }));
  }

  private near: InstancedMesh | null = null;
  private far: InstancedMesh | null = null;
  private dot: InstancedMesh | null = null;
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly sphere = new Sphere();

  /**
   * the model's levels from `place` (PlaceOptions.culler): the near lathe with every lantern, the far (LOD_NEAR) and the
   * dot (LOD_DOT) ones. Each draw gets the lanterns' seeds and every matrix (its sphere round all of them, as before),
   * the far and dot start empty; the buckets are the visible sets, so no draw is culled as a whole
   */
  take(b: HandedBatch): void {
    const near = b.levels[0]?.mesh ?? null, far = b.levels.find((l) => l.from === LOD_NEAR)?.mesh ?? null, dot = b.levels.find((l) => l.from === LOD_DOT)?.mesh ?? null;
    if (near === null || far === null || dot === null) return;
    const n = this.mats.length;
    const mk = (m: InstancedMesh, name: string): InstancedMesh => {
      m.geometry.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(this.seeds), 1));
      m.count = n;
      m.visible = true;
      this.mats.forEach((mm, i) => { m.setMatrixAt(i, mm); });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.name = name;
      return m;
    };
    this.near = mk(near, 'lanterns-near');
    this.far = mk(far, 'lanterns-far');
    this.far.count = 0;
    this.dot = mk(dot, 'lanterns-dot');
    this.dot.count = 0;
    this.dot.visible = false;
    this.near.frustumCulled = false;
    this.far.frustumCulled = false;
    this.dot.frustumCulled = false;
    live.push(this);
  }

  /** bucket the lanterns in view into the near, far (and dot) draws (skipped while the camera has not moved) */
  update(camera: Camera): void {
    const near = this.near, far = this.far, dot = this.dot;
    if (near === null || far === null || dot === null) return;
    camera.updateMatrixWorld();
    if (this.last.equals(camera.matrixWorld)) return;
    this.last.copy(camera.matrixWorld);
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const cw = camera.matrixWorld.elements, cx = cw[12], cy = cw[13], cz = cw[14];
    const nm = near.instanceMatrix.array, fm = far.instanceMatrix.array, dm = dot.instanceMatrix.array;
    const ns = near.geometry.getAttribute('aSeed'), fs = far.geometry.getAttribute('aSeed'), ds = dot.geometry.getAttribute('aSeed');
    const nsa = ns.array, fsa = fs.array, dsa = ds.array;
    let a = 0, b = 0, c = 0;
    const r2 = LOD_NEAR * LOD_NEAR, d2Dot = LOD_DOT * LOD_DOT;
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i];
      if (m === undefined) continue;
      const e = m.elements;
      const x = e[12], y = e[13], z = e[14], s = Math.hypot(e[0], e[1], e[2]);
      this.sphere.center.set(x, y - 0.1 * s, z);
      this.sphere.radius = BOUND * s;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
      if (d2 < r2) { m.toArray(nm, a * 16); nsa[a] = this.seeds[i] ?? 0; a++; } else if (d2 < d2Dot) { m.toArray(fm, b * 16); fsa[b] = this.seeds[i] ?? 0; b++; } else { m.toArray(dm, c * 16); dsa[c] = this.seeds[i] ?? 0; c++; }
    }
    near.count = a;
    far.count = b;
    dot.count = c;
    dot.visible = c > 0;
    near.instanceMatrix.needsUpdate = true;
    far.instanceMatrix.needsUpdate = true;
    dot.instanceMatrix.needsUpdate = true;
    ns.needsUpdate = true;
    fs.needsUpdate = true;
    ds.needsUpdate = true;
  }
}
