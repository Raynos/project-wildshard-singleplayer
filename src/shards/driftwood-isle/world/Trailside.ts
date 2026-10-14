/**
 * Trailside — the wooden dressing along Driftwood Isle's sand paths: rope fences (posts with a
 * sagging rope), plank steps set into the steeper climbs, and signposts with arrow boards at the
 * forks. Flat-shaded vertex colours, one mesh; fence posts and signposts collide, steps are
 * decoration on the walkable slope.
 *
 * E306 / E315 M1: the fence post, the signpost and the plank step are models
 * (src/shards/driftwood-isle/models/trailside.ts). The trail builds them in its layout's order from one stream, between
 * what is its own — the ropes sagging between the posts, the steps' side rails, the trestle stairs. The offline
 * generator welds these into one baked mesh; this builder admits it and places each model `drawnInto` it
 * (its copies, its card, its colliders: pieces `trail-*`). The trail's
 * own piece (`trailside`, main.ts) keeps the steps' and the stairs' treads (`worldColliderDescs`); `colliderDescs` is
 * the whole trail's, as before (the navmesh bake reads it). A dev page's or the bake's trail registers its models in a
 * registry nothing reads.
 *
 *   const trailside = new Trailside(sky).build(Trailside.forIsland());
 *   scene.add(trailside.mesh); its registry piece.push(...trailside.colliders);
 *
 * `Trailside.forIsland()` is Driftwood's layout: fences along the plateau ramp and the plateau's
 * seaward rim, steps up the plateau ramp and the headland ramp, signposts at the pier landing and
 * the hut fork.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { fencePost, plankStep, signpost, trailMaterial } from '../models/trailside';

import { copyTrailsideGeometry } from '../boot/trailsideGeometry';
import { staticColliders, type StaticColliderFact } from '../runtime/boot/staticColliders';
import { islandTrailsideSpec, type TrailsideSpec } from './trailsideLayout';

/** The placed native trail weld with its existing terrain-following collision law. */
export class Trailside {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private worldFacts: readonly StaticColliderFact[] = [];
  /** the models placed into the weld: the posts' and signposts' colliders, in the layout's order */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky) {}

  /** Driftwood Isle's layout (see the PATHS / PLATEAU / HEADLAND constants in the def) */
  static forIsland(): TrailsideSpec { return islandTrailsideSpec(); }

  /** the game's: the trail's own piece (`trailside`: its weld drawn, its steps' and stairs' treads) after its models' */
  place(registry: WorldRegistry): this {
    registry.add({ id: 'trailside', name: 'Trailside', category: 'props', file: 'src/shards/driftwood-isle/world/Trailside.ts', object: this.mesh, colliders: this.worldColliderDescs(), surface: 'wood', solidFloor: true });
    return this;
  }

  /** the models placed (pieces `trail-fence-posts`, `trail-signposts`, `trail-steps`) and the weld built */
  build(spec: TrailsideSpec): this {
    const { geometry: geo, metadata, worldColliders } = copyTrailsideGeometry(spec);
    const ctx = modelContext(this.sky), { posts, signs, planks } = metadata;
    this.worldFacts = worldColliders;
    this.colliders.push(...metadata.colliders);
    this.mesh = new THREE.Mesh(geo, trailMaterial(ctx));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const into = (boxes: number[]): { object: THREE.Mesh; boxes: Float32Array } => ({ object: this.mesh, boxes: Float32Array.from(boxes) });
    // the posts' colliders, then the signposts' (the order the trail's boxes always had)
    if (posts.pls.length > 0) this.placed.push(place(fencePost, posts.pls, { ctx, draw: 'merged', drawnInto: into(posts.boxes), piece: { id: 'trail-fence-posts' } }));
    if (signs.pls.length > 0) this.placed.push(place(signpost, signs.pls, { ctx, draw: 'merged', drawnInto: into(signs.boxes), piece: { id: 'trail-signposts' } }));
    if (planks.pls.length > 0) this.placed.push(place(plankStep, planks.pls, { ctx, draw: 'merged', drawnInto: into(planks.boxes), piece: { id: 'trail-steps' } }));
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — the fence posts and signposts (the legacy boxes)
   * and, walkable for the first time, the plank steps. src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.placed.flatMap((p) => p.colliders);
    out.push(...this.worldColliderDescs());
    return out;
  }

  /** the trail's own collision (its piece `trailside`): the plank steps' treads and the trestle stairs'; the posts and
   *  signposts collide as their models (pieces `trail-fence-posts`, `trail-signposts`) */
  worldColliderDescs(): ColliderDesc[] {
    return staticColliders(this.worldFacts);
  }
}
