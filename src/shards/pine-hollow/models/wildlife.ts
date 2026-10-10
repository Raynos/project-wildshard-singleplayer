/**
 * The small wildlife of Pine Hollow (PINE-HOLLOW-REMASTER PH-M5) in ONE instanced draw: the raven, the great grey owl, the
 * pileated woodpecker and the snowshoe hare. Each is built offline (G285: ../generators/wildlife.ts → baked/wildlife.bin,
 * read by `preloadPineWildlife` before `installPineLife`) from ellipsoids, cones and feather sheets at its real size (forward = +z, up = +y), smooth-shaded, PBR (per-vertex roughness: a raven's glossy
 * black, an owl's matte down), vertex-coloured with feather / fur mottling — no textures. All four models live in one
 * geometry; an instance draws only its own kind (the others collapse to a point in the vertex shader), so the whole
 * menagerie is one draw call and one program, parked in the scene before the boot's precompile.
 *
 *   const mesh = new WildlifeMesh(sky, 24);
 *   scene.add(mesh.mesh);
 *   mesh.begin();          // each frame: then
 *   mesh.add(pose);        // per live instance (a WildPose: kind, place, the part angles) — packed at the front
 *   mesh.commit();         // draws exactly those (mesh.count)
 *
 * Per vertex: position, normal, colour, the part's pivot, and two packed vec4s — (part, kind, roughness, emissive) and (the
 * atlas uv, textured?, pose variant). The parts move in the vertex shader from two per-instance vec4s: birds (flap, fold, head yaw, head pitch) + (kind, leg
 * tuck, –, –); the hare (hind legs, fore legs, head pitch, ears back) + (kind, head yaw, –, –). Normals turn with their part.
 * No shadow is cast (a bird-sized caster would add the cascades' draws); the forest's shadows fall on them.
 */
import * as THREE from 'three';
import type { BirdMesh, BirdSet } from '../life/birdModels';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as vb from 'valibot';
import wildJson from '../data/wildlife.json' with { type: 'json' };
import { fetchBake } from '../world/bakeBytes';

export const KIND = { raven: 0, owl: 1, woodpecker: 2, hare: 4 } as const;
export type WildKind = (typeof KIND)[keyof typeof KIND];

/** vertex part ids (aPart): what the vertex shader turns */
export const P = { body: 0, wingL: 1, wingR: 2, head: 3, legs: 4, tail: 5, hBody: 10, hHead: 11, hEars: 12, hHind: 13, hFore: 14 } as const;
/** the hare's neck: its ears turn with the head about this point */
export const HARE_NECK: V3 = [0, 0.235, 0.15];

export type V3 = readonly [number, number, number];

/** one instance's pose for `WildlifeMesh.write` */
export interface WildPose {
  kind: WildKind;
  x: number; y: number; z: number;
  /** heading (forward = (sin yaw, cos yaw)), nose-up pitch, bank */
  yaw: number; pitch: number; roll: number;
  scale: number;
  /** birds: flap (+ = up), fold 0 spread → 1 folded, head yaw, head pitch (+ = down); hare: hind, fore, head pitch, ears back */
  a0: number; a1: number; a2: number; a3: number;
  /** birds: leg tuck (0 down → 1 tucked); hare: head yaw */
  b1: number;
  /** birds: the body's nose-up pitch the head turns against (its yaw axis stays world-vertical: an upright owl, a woodpecker on a trunk) */
  b2: number;
}
export const newPose = (kind: WildKind): WildPose => ({ kind, x: 0, y: -999, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, a0: 0, a1: 0, a2: 0, a3: 0, b1: 0, b2: 0 });

// ─────────────── the baked shapes ───────────────
const num = vb.pipe(vb.number(), vb.finite());
const WildRowsSchema = vb.strictObject({ bin: vb.string(), bytes: num, kinds: vb.array(vb.strictObject({ kind: vb.picklist([KIND.raven, KIND.owl, KIND.woodpecker, KIND.hare]), vertices: num, indices: num })) });
/** ../data/wildlife.json: the bake's hash and size, and each kind's vertex and index counts in the binary's order */
export type WildRows = vb.InferOutput<typeof WildRowsSchema>;
/** the order the bake writes the procedural kinds in (../generators/wildlife.ts) */
export const WILD_BAKE_KINDS: readonly WildKind[] = [KIND.raven, KIND.owl, KIND.woodpecker, KIND.hare];
/** the bake's rows, parsed strictly once */
export const WILD_ROWS: WildRows = vb.parse(WildRowsSchema, wildJson);
/** the bake's binary (`scripts/bake-pine-wildlife.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const WILDLIFE_BAKE_URL = '/assets/pine-hollow/baked/wildlife.bin';

/** one kind's baked blocks: position, normal, colour, pivot (3 a vertex), info, atlas (4 a vertex), its local triangles */
interface WildShape { readonly pos: Float32Array; readonly nor: Float32Array; readonly col: Float32Array; readonly pivot: Float32Array; readonly info: Float32Array; readonly tex: Float32Array; readonly idx: Uint32Array }

/** the procedural kinds from the bake's bytes (inflated, lanes put back) */
export function wildShapes(bytes: Uint8Array): ReadonlyMap<WildKind, WildShape> {
  if (bytes.length !== WILD_ROWS.bytes) throw new Error(`[wildlife] the bake holds ${String(bytes.length)} bytes, its rows ${String(WILD_ROWS.bytes)}`);
  const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes);
  const out = new Map<WildKind, WildShape>();
  let at = 0;
  const floats = (count: number): Float32Array => { const a = new Float32Array(buffer, at, count); at += count * 4; return a; };
  for (const { kind, vertices: n, indices } of WILD_ROWS.kinds) {
    const pos = floats(n * 3), nor = floats(n * 3), col = floats(n * 3), pivot = floats(n * 3), info = floats(n * 4), tex = floats(n * 4);
    out.set(kind, { pos, nor, col, pivot, info, tex, idx: new Uint32Array(buffer, at, indices) });
    at += indices * 4;
  }
  return out;
}

let shapes: ReadonlyMap<WildKind, WildShape> | null = null;
let loading: Promise<void> | null = null;
/** Fetch the bake behind the loading screen (the play hook awaits it before `installPineLife`), once. A bake that fails
 *  to load is a page fault (`console.error`), and the procedural animals stand absent. */
export function preloadPineWildlife(): Promise<void> {
  loading ??= (async (): Promise<void> => {
    try { shapes = wildShapes(await fetchBake(WILDLIFE_BAKE_URL)); } catch (error: unknown) { console.error('[pine-hollow] the baked wildlife did not load:', error); }
  })();
  return loading;
}
/** the bake's bytes handed in instead of fetched (a test reading the committed file) */
export function useWildShapes(bytes: Uint8Array): void { shapes = wildShapes(bytes); loading = Promise.resolve(); }
/** whether the bake has been read */
export const wildlifeBaked = (): boolean => shapes !== null;

/** the shared geometry's arrays, filled from baked kinds and the modelled birds in draw order */
class Packer {
  readonly pos: number[] = []; readonly nor: number[] = []; readonly col: number[] = []; readonly pivot: number[] = [];
  readonly info: number[] = []; readonly tex: number[] = []; readonly idx: number[] = [];
  /** a procedural kind from the bake (nothing while the bake is absent) */
  baked(kind: WildKind): void {
    const s = shapes?.get(kind);
    if (s === undefined) return;
    const base = this.pos.length / 3;
    this.pos.push(...s.pos); this.nor.push(...s.nor); this.col.push(...s.col); this.pivot.push(...s.pivot); this.info.push(...s.info); this.tex.push(...s.tex);
    for (const i of s.idx) this.idx.push(base + i);
  }
  /** one vertex: its place, normal, colour, the part's pivot, (part, kind, roughness, emissive), (atlas uv, textured, pose) */
  vert(p: V3, n: V3, c: THREE.Color, pivot: V3, info: readonly [number, number, number, number], tex: readonly [number, number, number, number]): void {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c.r, c.g, c.b); this.pivot.push(pivot[0], pivot[1], pivot[2]);
    this.info.push(...info); this.tex.push(...tex);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.pivot, 3));
    // the scalars packed into two vec4s (WebGL's 16 attribute slots: the instance matrix takes four of them)
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(this.info), 4));
    g.setAttribute('aTexV', new THREE.BufferAttribute(new Float32Array(this.tex), 4));
    g.setIndex(this.idx);
    return g;
  }
}

// ─────────────── a modelled bird (birdModels.ts) ───────────────
/**
 * One of the six generated bird meshes into the shared geometry: textured (its atlas tile), its vertices in the parts the
 * vertex shader turns (birdModels.ts tells them: flying, the wings flap about their shoulders; the head turns about the
 * neck; the rest is body).
 * The mesh arrives already in the pose frame the life code drives (birdModels.ts: the perched ones pre-tilted against
 * the pitch their perch gives them, the feet at the stand height).
 */
function modelled(b: Packer, m: BirdMesh): void {
  const pos = m.geo.getAttribute('position'), nor = m.geo.getAttribute('normal'), uv = m.geo.getAttribute('uv');
  const white = new THREE.Color(1, 1, 1);
  const base = b.pos.length / 3;
  const PART = [P.body, P.wingL, P.wingR, P.head] as const, PIVOT: readonly V3[] = [[0, 0, 0], m.shoulderL, m.shoulderR, m.neck];
  for (let i = 0; i < pos.count; i++) {
    const p: V3 = [pos.getX(i), pos.getY(i), pos.getZ(i)], n: V3 = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    const k = m.parts[i] ?? 0, part = PART[k] ?? P.body, pivot = PIVOT[k] ?? [0, 0, 0];
    b.vert(p, n, white, pivot, [part, m.kind, m.rough, m.eyes && part === P.head ? 1 : 0], [uv.getX(i), uv.getY(i), 1, m.fly ? 1 : 0]);
  }
  const idx = m.geo.getIndex();
  if (idx) for (let i = 0; i < idx.count; i++) b.idx.push(base + idx.getX(i));
  else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
}

// ─────────────── the mesh ───────────────
const VERT_HEAD = /* glsl */`#include <common>
attribute vec3 aPivot; attribute vec4 aInfo; attribute vec4 aTexV;   // (part, kind, roughness, emissive), (uv, textured, pose)
attribute vec4 aAnim; attribute vec4 aAnim2;
varying float vWlRough; varying float vWlEmis; varying vec2 vWlUv; varying float vWlTex;
vec3 wlPos;
vec3 wlRx(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 wlRy(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 wlRz(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
vec3 wlRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }`;

const VERT_ANIM = /* glsl */`
vec3 objectNormal = vec3( normal );
{
  vec3 p = position, n = objectNormal, pv = aPivot;
  float part = aInfo.x, aKind = aInfo.y, aVar = aTexV.w;
  vWlRough = aInfo.z; vWlEmis = aInfo.w; vWlUv = aTexV.xy; vWlTex = aTexV.z;
  if (part == 1.0 || part == 2.0) {
    // a wing: shortened as it folds, flapped about the body axis at the shoulder; folding also stands its chord on edge
    // (leading edge up) and sweeps it back, so a folded wing lies flat along the flank over the tail, not out like a plate
    float side = part == 1.0 ? -1.0 : 1.0, fold = aAnim.y, shut = smoothstep(0.4, 1.0, fold);
    vec3 q = p - pv;
    q.x *= 1.0 - 0.42 * fold; q.z *= 1.0 - 0.5 * shut;
    q = wlRz(q, aAnim.x * side); n = wlRz(n, aAnim.x * side);
    q = wlRx(q, -1.35 * shut); n = wlRx(n, -1.35 * shut);
    float sw = fold * 1.5 * side;
    q = wlRy(q, sw); n = wlRy(n, sw);
    q.x += side * 0.45 * abs(pv.x) * shut;
    p = q + pv;
  } else if (part == 3.0) {
    // the head: pitched (+ = down) about the neck, then turned about the world's vertical (the body may be upright)
    vec3 q = wlRx(p - pv, aAnim.w); n = wlRx(n, aAnim.w);
    vec3 up = vec3(0.0, cos(aAnim2.z), sin(aAnim2.z));
    q = wlRot(q, up, aAnim.z); n = wlRot(n, up, aAnim.z);
    p = q + pv;
  } else if (part == 4.0) {
    float a = aAnim2.y * 1.4;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 13.0 || part == 14.0) {
    float a = part == 13.0 ? aAnim.x : aAnim.y;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 11.0 || part == 12.0) {
    if (part == 12.0) { p = wlRx(p - pv, -aAnim.w) + pv; n = wlRx(n, -aAnim.w); }
    vec3 hn = vec3(${HARE_NECK.map((v) => v.toFixed(3)).join(', ')});
    vec3 q = wlRy(p - hn, aAnim2.y); n = wlRy(n, aAnim2.y);
    q = wlRx(q, aAnim.z); n = wlRx(n, aAnim.z);
    p = q + hn;
  }
  // another kind's vertex collapses to a point: this instance draws only its own model (and, for a modelled bird, only
  // its pose: perched or flying, aAnim2.w)
  if (abs(aKind - aAnim2.x) > 0.5 || (aVar > -0.5 && abs(aVar - aAnim2.w) > 0.5)) p = vec3(0.0);
  wlPos = p; objectNormal = n;
}`;

export class WildlifeMesh {
  readonly mesh: THREE.InstancedMesh;
  /** the owl's eye-shine (0 by day → 1 at night) */
  readonly glow = { value: 0 };
  private readonly anim: THREE.InstancedBufferAttribute;
  private readonly anim2: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion(); private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();
  private n = 0;
  private static readonly ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  /** the modelled birds' atlas (a white texel until `useBirds`) */
  private readonly atlas: { value: THREE.Texture };

  constructor(sky: Sky, readonly capacity: number) {
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim.setUsage(THREE.DynamicDrawUsage);
    this.anim2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim2.setUsage(THREE.DynamicDrawUsage);
    const geo = this.build(null);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
    this.atlas = { value: white };

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    const glow = this.glow, atlas = this.atlas;
    patchShader(mat, 'pine.wildlife', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uWlGlow'] = glow;
      shader.uniforms['uWlTex'] = atlas;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', VERT_HEAD)
        .replace('#include <beginnormal_vertex>', VERT_ANIM)
        .replace('#include <begin_vertex>', 'vec3 transformed = wlPos;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying float vWlRough; varying float vWlEmis; uniform float uWlGlow; varying vec2 vWlUv; varying float vWlTex; uniform sampler2D uWlTex;
// the owl's eyes in the atlas: its yellow irises (linear), where the eye-shine glows at night
float wlEye(vec3 t) { return smoothstep(0.3, 0.5, t.r) * smoothstep(0.18, 0.3, t.g) * (1.0 - smoothstep(0.2, 0.45, t.b / max(t.r, 1e-3))); }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 wlTexel = vec3(1.0);\nif (vWlTex > 0.5) { wlTexel = texture2D(uWlTex, vWlUv).rgb; diffuseColor.rgb *= wlTexel; }')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vWlRough;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.22) * vWlEmis * uWlGlow * 1.4 * (vWlTex > 0.5 ? wlEye(wlTexel) : 1.0);');
    }, { mode: 'replace', key: 'pine-wildlife' });
    sky.setupMaterial(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.name = 'pine-wildlife';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    // parked at zero scale until the first frame packs the live ones (the boot's precompile sees a drawn instance)
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, WildlifeMesh.ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** the shared geometry: the hare (and, without `birds`, the procedural birds) + the modelled birds' two poses each */
  private build(birds: BirdSet | null): THREE.InstancedBufferGeometry {
    const b = new Packer();
    if (birds) { for (const m of birds.meshes) modelled(b, m); } else { b.baked(KIND.raven); b.baked(KIND.owl); b.baked(KIND.woodpecker); }
    b.baked(KIND.hare);
    const src = b.geometry();
    const geo = new THREE.InstancedBufferGeometry();
    for (const [k, v] of Object.entries(src.attributes)) geo.setAttribute(k, v);
    geo.setIndex(src.getIndex());
    geo.setAttribute('aAnim', this.anim); geo.setAttribute('aAnim2', this.anim2);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return geo;
  }

  /** the modelled birds (birdModels.ts) in place of the procedural ones: same draw, same program — a new geometry and the
   *  atlas bound to the sampler that was there from the start (uploaded now, not on the first frame that draws one) */
  useBirds(birds: BirdSet, renderer: Renderer): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = this.build(birds);
    this.atlas.value = birds.atlas;
    renderer.initTexture(birds.atlas);
    old.dispose();
  }

  /** vertices in the shared geometry (all four models) */
  get vertexCount(): number { return this.mesh.geometry.getAttribute('position').count; }

  /** start a frame: no instance drawn until `add`ed */
  begin(): void { this.n = 0; }
  /** draw `w` this frame (the live instances are packed at the front: nothing parked costs a vertex) */
  add(w: WildPose): void {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.e.set(-w.pitch, w.yaw, w.roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(w.x, w.y, w.z), this.q, this.s.setScalar(w.scale));
    this.mesh.setMatrixAt(i, this.m);
    const a = this.anim.array, b = this.anim2.array, k = i * 4;
    a[k] = w.a0; a[k + 1] = w.a1; a[k + 2] = w.a2; a[k + 3] = w.a3;
    // a modelled bird's pose: flying (legs tucked, or wings open on a hop) → the spread model, else the perched one
    b[k] = w.kind; b[k + 1] = w.b1; b[k + 2] = w.b2; b[k + 3] = w.b1 > 0.5 || w.a1 < 0.5 ? 1 : 0;
  }
  commit(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true; this.anim2.needsUpdate = true; }
}

// ─────────────── the models (E306 / E315 M5) ───────────────

const FILE = 'src/shards/pine-hollow/models/wildlife.ts';

/**
 * How the life code (src/shards/pine-hollow/life/index.ts) holds each kind at rest, for its specimen: a raven on the ground between
 * pecks at a kill, the owl on its snag, the woodpecker on a trunk, a hare sat up alert — the part angles, the pitch, the
 * scale, and the body centre over the feet (index.ts RAVEN_STAND / OWL_STAND; the woodpecker's is its spot on the bark).
 */
const REST: Readonly<Record<WildKind, Partial<Omit<WildPose, 'kind'>>>> = {
  [KIND.raven]: { y: 0.2, pitch: 0.12, scale: 1.1, a0: -0.08, a1: 1, a3: -0.15 },
  [KIND.owl]: { y: 0.16, pitch: 1.1, b2: 1.1, scale: 1.05, a0: -0.05, a1: 1, a3: 1.1 },
  [KIND.woodpecker]: { y: 0.1, pitch: 1.3, b2: 1.3, b1: 0.3, scale: 1.05, a0: -0.05, a1: 1, a3: 0.35 },
  [KIND.hare]: { y: 0, pitch: 0.18, scale: 1.12, a2: -0.5, a3: -0.15 },
};

/** one kind's own model in the shared geometry's layout (WildlifeMesh's `build`, the other kinds left out): the hare, or a
 *  bird — its two generated poses when `birds` has landed, else the procedural one; `from` lends the per-instance pose */
function kindGeometry(kind: WildKind, birds: BirdSet | null, from: THREE.BufferGeometry): THREE.InstancedBufferGeometry {
  const b = new Packer();
  if (kind === KIND.hare) b.baked(kind);
  else if (birds) { for (const m of birds.meshes) if (m.kind === kind) modelled(b, m); }
  else b.baked(kind);
  const src = b.geometry();
  const geo = new THREE.InstancedBufferGeometry();
  for (const [k, v] of Object.entries(src.attributes)) geo.setAttribute(k, v);
  geo.setIndex(src.getIndex());
  geo.setAttribute('aAnim', from.getAttribute('aAnim')); geo.setAttribute('aAnim2', from.getAttribute('aAnim2'));
  return geo;
}

/**
 * One copy of `kind` as the forest draws it, for its Model Explorer card: a WildlifeMesh of one instance (the same material,
 * program and vertex-shader pose), its geometry cut down to this kind's own model, held at rest (`REST`) with its feet on
 * the origin. `birds`: the generated birds (birdModels.ts) once they have landed, swapped in as the life code does.
 */
export function wildlifeSpecimen(ctx: ModelContext, kind: WildKind, birds: BirdSet | null = null): THREE.InstancedMesh {
  const wild = new WildlifeMesh(ctx.sky, 1);
  let set: BirdSet | null = null;
  if (birds !== null && ctx.renderer !== null) { wild.useBirds(birds, ctx.renderer); set = birds; } // the atlas bound as the life code binds it
  wild.mesh.geometry = kindGeometry(kind, set, wild.mesh.geometry);
  wild.begin();
  wild.add({ ...newPose(kind), ...REST[kind] });
  wild.commit();
  return wild.mesh;
}

/** the snowshoe hare, in its summer coat (code: `hare` above) — five about you on open ground (life/index.ts N_HARE):
 *  they graze, hop, sit up when you are near and bolt in zig-zags; drawn in the forest's one wildlife draw */
export const snowshoeHare: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/snowshoe-hare', name: 'Snowshoe hare', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: {},
  build: (ctx) => wildlifeBaked() ? wildlifeSpecimen(ctx, KIND.hare)
    : loadingSpecimen('pine-hollow/snowshoe-hare', [0.2, 0.42, 0.5], async () => { await preloadPineWildlife(); return wildlifeSpecimen(ctx, KIND.hare); }),
});
