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
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { PosedInstances, PosedPacker, type PosedInstancesLook, type PosedInstancesView } from '@wildshard/sdk/looks/posedInstances';
import { spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import * as vb from 'valibot';
import { WILDLIFE_LOOK } from '../data/wildlifeLook';
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

/** the shared geometry's arrays (@wildshard/sdk/looks/posedInstances), filled from baked kinds and the modelled birds in draw order */
class Packer extends PosedPacker {
  /** a procedural kind from the bake (nothing while the bake is absent) */
  baked(kind: WildKind): void {
    const s = shapes?.get(kind);
    if (s !== undefined) this.block(s);
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
/** the look's rows (../data/wildlifeLook.ts) with the hare's neck spliced into its vertex edits */
const LOOK: PosedInstancesLook = { ...WILDLIFE_LOOK, edits: spliceEdits(WILDLIFE_LOOK.edits, { hareNeck: HARE_NECK.map((v) => v.toFixed(3)).join(', ') }) };

/** the forest's small wildlife: one posed-instances draw (@wildshard/sdk/looks/posedInstances) of the four kinds */
export class WildlifeMesh {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  /** the owl's eye-shine (0 by day → 1 at night) */
  readonly glow: { value: number };
  private readonly posed: PosedInstancesView;

  constructor(sky: Sky, capacity: number) {
    this.capacity = capacity;
    this.posed = new PosedInstances(sky, capacity, LOOK, () => WildlifeMesh.packed(null));
    this.mesh = this.posed.mesh;
    this.glow = this.posed.glow;
  }

  /** the shared geometry: the hare (and, without `birds`, the procedural birds) + the modelled birds' two poses each */
  private static packed(birds: BirdSet | null): THREE.BufferGeometry {
    const b = new Packer();
    if (birds) { for (const m of birds.meshes) modelled(b, m); } else { b.baked(KIND.raven); b.baked(KIND.owl); b.baked(KIND.woodpecker); }
    b.baked(KIND.hare);
    return b.geometry();
  }

  /** the modelled birds (birdModels.ts) in place of the procedural ones: same draw, same program — a new geometry and the
   *  atlas bound to the sampler that was there from the start (uploaded now, not on the first frame that draws one) */
  useBirds(birds: BirdSet, renderer: Renderer): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = this.posed.wrap(WildlifeMesh.packed(birds), true);
    this.posed.useAtlas(birds.atlas, renderer);
    old.dispose();
  }

  /** `src` on an instanced geometry carrying this mesh's per-instance pose (no bounding sphere: a specimen's cut-down model) */
  wrap(src: THREE.BufferGeometry): THREE.InstancedBufferGeometry { return this.posed.wrap(src, false); }

  /** vertices in the shared geometry (all four models) */
  get vertexCount(): number { return this.posed.vertexCount; }

  /** start a frame: no instance drawn until `add`ed */
  begin(): void { this.posed.begin(); }
  /** draw `w` this frame (the live instances are packed at the front: nothing parked costs a vertex); a modelled bird's
   *  pose: flying (legs tucked, or wings open on a hop) → the spread model, else the perched one */
  add(w: WildPose): void {
    this.posed.add(w.x, w.y, w.z, w.pitch, w.yaw, w.roll, w.scale, w.a0, w.a1, w.a2, w.a3, w.kind, w.b1, w.b2, w.b1 > 0.5 || w.a1 < 0.5 ? 1 : 0);
  }
  /** draw exactly the instances added since `begin` */
  commit(): void { this.posed.commit(); }
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
 *  bird — its two generated poses when `birds` has landed, else the procedural one; `wild` lends the per-instance pose */
function kindGeometry(kind: WildKind, birds: BirdSet | null, wild: WildlifeMesh): THREE.InstancedBufferGeometry {
  const b = new Packer();
  if (kind === KIND.hare) b.baked(kind);
  else if (birds) { for (const m of birds.meshes) if (m.kind === kind) modelled(b, m); }
  else b.baked(kind);
  return wild.wrap(b.geometry());
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
  wild.mesh.geometry = kindGeometry(kind, set, wild);
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
