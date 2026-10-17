/**
 * The small wildlife of Pine Hollow (PINE-HOLLOW-REMASTER PH-M5) in ONE instanced draw: the raven, the great grey owl, the
 * pileated woodpecker and the snowshoe hare. Each is built offline (G285: ../generators/wildlife.ts → baked/wildlife.glb,
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
import { loadBirdModels, type BirdSet } from '../birds';
import type { ModelContext } from '@wildshard/engine/models/model';
import { uploadTexture } from '@wildshard/engine/core/assets';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { PosedInstances, type PosedInstances as PosedInstancesView } from '@wildshard/sdk/looks/posedInstances';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import metadata from '../../data/explorerMetadata.generated.json' with { type: 'json' };

export const KIND = { raven: 0, owl: 1, woodpecker: 2, hare: 4 } as const;
export type WildKind = (typeof KIND)[keyof typeof KIND];

/** one instance's pose for `WildlifeMesh.write` */
export interface WildPose {
  kind: number;
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

/** One required authored draw, shared by the forest and Explorer cards. */
let shapes: BirdSet | null = null;
let loading: Promise<void> | null = null;
export function preloadPineWildlife(): Promise<void> {
  return (loading ??= loadBirdModels().then(set => { shapes = set; return undefined; }));
}
export const wildlifeBaked = (): boolean => shapes !== null;
function authoredWildlife(): BirdSet {
  if (shapes === null) throw new Error('[wildlife] required posed draw is not loaded');
  return shapes;
}

// ─────────────── the mesh ───────────────
/** what a compiled look catalogue lends (`runtimeLookMaterials`) */
interface LentLooks {
  readonly materials: ReadonlyMap<string, THREE.Material>;
  readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
  readonly setTexture: (id: string, name: string, texture: THREE.Texture) => void;
}
/** the compiled wildlife graph (../data/wildlifeLook.ts), lent by the world hook (runtime/index.ts) */
let lent: { readonly looks: LentLooks; readonly material: THREE.Material } | null = null;
/** lend the compiled looks (over metadata.wildlifeLook) before any WildlifeMesh is built */
export function lendPineWildlifeLook(looks: LentLooks): void {
  const material = looks.materials.get(metadata.wildlifeLook);
  if (material === undefined) throw new Error('[pine-hollow] no compiled wildlife look');
  lent = { looks, material };
}
function wildlifeLook(): NonNullable<typeof lent> {
  if (lent === null) throw new Error('[pine-hollow] the wildlife graph was not lent before the wildlife built');
  return lent;
}

/** the forest's small wildlife: one posed-instances draw (@wildshard/sdk/looks/posedInstances) of the four kinds */
export class WildlifeMesh {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  /** the owl's eye-shine (0 by day → 1 at night) */
  readonly glow: { value: number };
  private readonly posed: PosedInstancesView;
  /** the posed look and its authored geometry, for the guide flock's own draw */
  readonly look = { name: metadata.wildlifeLook, material: wildlifeLook().material, get geometry(): THREE.BufferGeometry { return authoredWildlife().geometry; } };

  constructor(readonly sky: Sky, capacity: number) {
    this.capacity = capacity;
    const look = wildlifeLook();
    this.posed = new PosedInstances(capacity, metadata.wildlifeLook, look.material, () => authoredWildlife().geometry, ['aAnim', 'aAnim2']);
    this.mesh = this.posed.mesh;
    let glow = 0;
    this.glow = { get value() { return glow; }, set value(v: number) { if (v !== glow) { glow = v; look.looks.setParam(metadata.wildlifeLook, 'glow', v); } } };
  }

  /** Bind the original atlas before the first drawn instance; channels already belong to the authored draw. */
  useBirds(birds: BirdSet): void {
    wildlifeLook().looks.setTexture(metadata.wildlifeLook, 'atlas', birds.atlas);
    uploadTexture(birds.atlas);
  }

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

/** One kind of the authored draw, sharing its immutable arrays and original pose shader. */
export function wildlifeSpecimen(ctx: ModelContext, kind: WildKind): THREE.InstancedMesh {
  const set = authoredWildlife(), range = set.ranges.find(row => row.kind === kind);
  if (range === undefined) throw new Error('Missing authored wildlife kind');
  const wild = new WildlifeMesh(ctx.sky, 1);
  wild.useBirds(set);
  wild.mesh.geometry.setDrawRange(range.start, range.count);
  wild.mesh.geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...range.box.slice(0, 3)), new THREE.Vector3(...range.box.slice(3)));
  wild.begin(); wild.add({ ...newPose(kind), ...REST[kind] }); wild.commit();
  return wild.mesh;
}
