/**
 * The rope bridge (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts; it was built in
 * src/shards/driftwood-isle/world/RopeBridge.ts) — a walkable rope-and-plank bridge (Driftwood Isle: over the gully on the headland climb).
 * Anchor posts at both ends, a deck of planks hung on a sagging catenary, rope handrails with vertical stays.
 *
 * The deck moves (PHYSICS.md, the rope bridge): it is cut into ~0.9 m segments that src/engine/physics/ropeChain.ts hangs as a
 * jointed chain between the posts. It sags and bounces under the player's weight and bows sideways: the posts, planks,
 * load ropes, handrails and stays are one baked mesh skinned to the segments (generators/ropeBridge.ts `deck`), whose
 * bones are the segments' holders. Without a physics world (the dev scenes, the Explorer) it is drawn at rest, and
 * `floorHeightAt` is the still catenary.
 *
 * Its own space: the origin is end a on the ground, the span running to b (its params: the two ends' world xz, the sag,
 * the width and the ground under them — the posts' feet and the ends' treads read it, so it is built where it stands).
 * The drawn group (the skinned deck, a holder bone per deck segment and the posts' still bone) is handed over in own space and
 * placed `single` at the origin; the chain's segments stay in the world (`chainSpec`), their poses are carried into the
 * group's space as they are drawn. `ropeBridgeLayout(params)` is a placement's builder, shared with its build.
 */
import * as THREE from 'three';
import BRIDGE_SPANS from '../../data/bridgeRows.json' with { type: 'json' };
import { admitBridgeFacts, bridgeKey } from '../../boot/bridgeFacts';
import { fixedGeometryReady, loadFixedGeometry, fixedDraw } from '../boot/blobAssets';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { defineModel } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { RopeDeck, type RopeDeckPoses as DeckPoses } from '@wildshard/engine/physics/ropeChain';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

export interface RopeBridgeSpec { a: [number, number]; b: [number, number]; /** metres the middle hangs below the straight line */ sag?: number; width?: number }

/** one deck segment at rest: centre, rotation (local +z along the span, +y up), half length */
export interface DeckSegment { x: number; y: number; z: number; rot: { x: number; y: number; z: number; w: number }; hz: number }

/** a deck segment's length before it is fitted to the span (m), its half thickness, its weight (kg) */
const SEG_HY = 0.05, SEG_KG = 14;
/** the most deck segments a baked span carries (the island span 25, the specimen 13); a longer bake is refused */
const MAX_SEGS = 64;
/** the most own-space collider descriptors (posts, rails and end treads: 14 today); more are refused */
const MAX_DESCS = 64;



class RopeBridgeBuilder {
  /** the drawn deck (engine/world/ropeDeck): its group, chain spec, posing and floor */
  private deck: RopeDeck | null = null;
  /** the site's origin (own space = world − origin): end a on the ground */
  readonly o: { x: number; y: number; z: number };
  /** own-space colliders (the legacy boxes and the static floors), handed to the model */
  descs: ColliderDesc[] = [];

  private readonly facts: ReturnType<typeof admitBridgeFacts>;
  constructor(private sky: Sky, private spec: RopeBridgeSpec, ground: (x: number, z: number) => number) { this.facts = admitBridgeFacts(spec, ground); this.o = {...this.facts.origin};
    // own-space colliders for the model (the world's are these placed back at the origin); the rest plan alone, no drawing
    this.descs = readColliderRows(this.facts.ownDescs, { kinds: ['box', 'treads'], surfaces: [] });
    if (this.facts.segments.length > MAX_SEGS || this.descs.length > MAX_DESCS) throw new Error('Rope bridge bake exceeds its segment or collider bound');
  }

  build(): this {
    const facts = this.facts;
    // the posts, planks and ropes: one draw in a copy of the kit's still material, skinned to the bones as they stand at rest
    const geometry = fixedDraw(facts.key === bridgeKey(BRIDGE_SPANS.specimen) ? 'bridgeSpecimenDeck' : 'bridgeDeck').copy();
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(geometry.getAttribute('skinIndex').array, 4)); // the graph skins integer joints
    this.deck = new RopeDeck('rope-bridge', { origin: this.o, segments: structuredClone(facts.segments), start: this.spec.a, direction: facts.direction, len: facts.len, width: facts.width },
      { geometry, material: lowPolyLookMaterial(this.sky, 'still').clone() }, { halfY: SEG_HY, mass: SEG_KG, maxSegments: MAX_SEGS, owner: { id: 'bridge', name: 'Rope bridge' }, margin: 0.15 });
    return this;
  }
  private get built(): RopeDeck { if (this.deck === null) throw new Error('Rope bridge is not built'); return this.deck; }
  /** the skinned deck and its bones: one holder per deck segment, then the posts' still anchor */
  get mesh(): THREE.Group { return this.built.group; }
  chainSpec(): ReturnType<RopeDeck['chainSpec']> { return this.built.chainSpec(); }
  setPoses(deck: DeckPoses | null, alpha: number): void { this.deck?.setPoses(deck, alpha); }
  floorHeightAt(x: number, z: number): number | undefined { return this.deck?.floorHeightAt(x, z); }
}

export type RopeBridgeLayout = Pick<RopeBridgeBuilder, 'o' | 'descs' | 'chainSpec' | 'setPoses' | 'floorHeightAt' | 'mesh'>;

export interface RopeBridgeParams {
  readonly span: RopeBridgeSpec;
  /** the ground under a world (x, z) at the site: its y */
  readonly ground: (x: number, z: number) => number;
}

/** a specimen's span: 12 m over flat ground from the origin along +x, sagging 0.9 m */
const ORIGIN = BRIDGE_SPANS.specimen;
const FLAT = (): number => 0;
/** each placement's builder, by its span (a `place` builds it for its group; its colliders and the world's chain read the same one) */
const built = new WeakMap<RopeBridgeSpec, RopeBridgeBuilder>();

function builderOf(sky: Sky, p: RopeBridgeParams, fresh: boolean): RopeBridgeBuilder {
  let b = built.get(p.span);
  // SF63: the span outlives a world, its group does not. A grid region that leaves disposes its scene tree (sceneOwnership
  // clears the group and frees its geometry), and the next world built on the same span was handed that empty group: no
  // bridge in the cell. A builder whose group was emptied is stale; the new world builds its own
  if (b?.mesh.children.length === 0) b = undefined;
  if (!b || fresh) { b = new RopeBridgeBuilder(sky, p.span, p.ground).build(); if (p.span !== ORIGIN) built.set(p.span, b); }
  return b;
}

/** the bridge on a span: its builder (the drawn group, the chain, the floor, the colliders) — built on the first ask */
export function ropeBridgeLayout(sky: Sky, p: RopeBridgeParams): RopeBridgeLayout { return builderOf(sky, p, false); }

export const ropeBridge = defineModel<RopeBridgeParams>({
  id: 'driftwood-isle/rope-bridge', name: 'Rope bridge', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/ropeBridge.ts', surface: 'planks',
  defaults: { span: ORIGIN, ground: FLAT },
  // the world's copy: the builder its layout made (it drives that group's deck); a specimen: a fresh one
  // (the Explorer may open it before the island's world hook loaded the baked posts: it waits for them, never draws without)
  build: (ctx, p) => p.span !== ORIGIN ? builderOf(ctx.sky, p, false).mesh : fixedGeometryReady() ? builderOf(ctx.sky, p, true).mesh
    : loadingSpecimen('driftwood-isle/rope-bridge', [12, 2.5, 2], async () => { await loadFixedGeometry(); return builderOf(ctx.sky, p, true).mesh; }),
  // the colliders read the rest plan only
  colliders: (p, ctx) => (built.get(p.span) ?? new RopeBridgeBuilder(ctx.sky, p.span, p.ground)).descs,
});
