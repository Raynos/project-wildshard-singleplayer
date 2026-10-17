/**
 * Cove — Wreck Cove's dressing (Driftwood Isle, remaster M2): the SEA CAVE, tidepools, the cascade.
 *
 * The sea cave sits in the low notch at the crag foot north-west of the wreck: a vault of faceted boulders (grass and
 * moss on the outer tops, wet dark rock inside, stalactites) over a level rock-slab floor you walk on, vines hanging over
 * the mouth, a torch beside it. Inside: an antechamber with a tide pool, a narrow passage (the adventure's sluice gate
 * fits it: 2.5 m wide), then a raised alcove lit by glowing cyan crystals. Crystal and torch light are baked into the
 * vertex colours (no runtime light); the flames / crystals are one unlit draw. Tidepools among rock rims on the cove flats
 * (a ripple shader, the reef crabs' homes) and the cascade (the look-agent's Waterfall curtain, W5) over the crag into its plunge pool.
 *
 * Draws: rocks + cave (one LowPolyKit mesh on lowPolyLookMaterial), glow, pools, cascade.
 *
 * E306 / E315 M1 (second pass): the cove is WORLD — the sea cave is welded into the crag (its floor cuts the physics
 * terrain, `terrainCuts`), the pools and the cascade are water. Its loose outdoor rocks (the tidepool rims, the plunge
 * pool's ring, the cascade's banks) are the reef-rock model (src/shards/driftwood-isle/runtime/models/shoreBoulder.ts), placed
 * `drawnInto` the smooth-rock mesh they are welded in. `place` registers the cove's own piece (`cove`: drawn, its
 * colliders and floors; no card); the Wreck cove set (src/shards/driftwood-isle/world/places.ts) lists these rocks.
 *
 *   const cove = new Cove(sky).place(registry);                     // the game: piece `cove` (world) + the reef rocks' card
 *   const cove = new Cove(sky).build();                                          // a dev page / the navmesh bake: not registered
 *   scene.add(cove.group); its registry piece.push(...cove.colliders);
 *   player.platforms.push((x, z) => cove.floorHeightAt(x, z));      // the cave floor (antechamber, ramp, alcove)
 *   game.onUpdate((dt) => cove.update(dt));
 *   enemies: new Enemies(animals, { crabSites: cove.crabSites, … })   // the tidepool groups the Reef Crabs live at
 *
 * Cave frame: `spec.cave` {x, z} is the middle of the MOUTH, the interior runs along local +z, world = origin +
 * R_y(yaw) · local (the adventure's POI frame convention). `anchors` (world coords, y = floor, yaw = world facing,
 * 0 = +Z): caveFloor (the antechamber), plateA / plateB (on the sand in front of the mouth), barrelStart (the beach by
 * the wreck's bow), gate (the passage — faces the mouth), alcove (the crystal alcove behind the gate).
 * `caveBounds` {x, z, r, yMin, yMax} (the cave reverb) — also on `Cove.forIsland()` for the ambience.
 */
import * as THREE from 'three';
import type { SceneHandles } from '@wildshard/game/shardfile/worldScenes';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { driftwoodRows } from '../runtime/boot/rows';
import { reefRock } from '../runtime/models/shoreBoulder';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { floorAtRects, type BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { POOL_LOOK } from '../data/poolLook';
import { lentToon } from '@wildshard/sdk/looks/lentLooks';
import { followToon } from '../runtime/look/toon';

type CoveBake = ReturnType<typeof driftwoodRows<'custom/fixedLayouts'>>['cove'];
export type CoveSpec = CoveBake['spec'];
export type CaveBounds = CoveSpec['caveBounds'];
export type CoveAnchor = CoveBake['native']['anchors'][string];
const bake = (): CoveBake => driftwoodRows('custom/fixedLayouts').cove;
/** Fresh native facts; scene allocation belongs to the declared world host. */
export function islandCoveSpec(): CoveSpec { return structuredClone(bake().spec); }
export function coveFloors(): CoveBake['floors'] { return bake().floors; }
export function coveColliderDescs(): ColliderDesc[] { return readColliderRows(bake().native.descs, { kinds: ['box', 'treads'], surfaces: ['rock'], requireSurface: true }); }

export class Cove {
  group = new THREE.Group();
  colliders: Collider[] = [];
  crabSites: { x: number; z: number }[] = [];
  anchors: Record<string, CoveAnchor> = {};
  caveBounds: CaveBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };
  /** the pools' toon look follows the day clock once a frame (their ripple runs on the graph's own frame clock) */
  private follow: (() => void) | null = null;
  /** Registration facts borrow the existing baked reef draw; no retained matrix/box copies. */
  private catalogue: CoveBake['catalogue'] = {placements:[],boxes:[]};
  private cuts: CoveBake['native']['cuts'] = [];
  private rockMesh: THREE.Mesh | null = null;
  /** the reef rocks' placement (the Wreck cove set's member) */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky, private readonly scenes: SceneHandles) { this.group = scenes.group('cove.root'); }

  static forIsland(): CoveSpec { return islandCoveSpec(); }

  /**
   * The game's: build it, register the cove (piece `cove`: the sea cave, the pools and the cascade are world, drawn and
   * colliding as always — no card) and its reef rocks' placements (drawnInto their mesh; `placed`, the Wreck cove set's).
   */
  place(registry: WorldRegistry): this {
    this.build();
    registry.add({ id: 'cove', name: 'Wreck cove', category: 'nature', file: 'src/shards/driftwood-isle/world/Cove.ts', object: this.group, colliders: this.colliderDescs(), surface: 'rock',
      floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true });
    if (this.rockMesh !== null && this.catalogue.placements.length > 0) {
      this.placed.push(place(reefRock,this.catalogue.placements,{ctx:modelContext(this.sky),draw:'merged',registry,
        drawnInto:{object:this.rockMesh,boxes:Float32Array.from(this.catalogue.boxes)},piece:{id:'wreck-cove-reef-rocks'}}));
    }
    return this;
  }

  /** the baked layout (`Cove.forIsland()`): its geometry, colliders, anchors and crab sites */
  build(): this {
    const spec = islandCoveSpec(), built = bake();
    this.crabSites = spec.crabSites;
    this.caveBounds = spec.caveBounds;
    this.catalogue = built.catalogue;
    this.colliders=structuredClone(built.native.colliders);
    this.anchors=structuredClone(built.native.anchors);
    this.cuts=built.native.cuts;
    this.rockMesh = this.scenes.mesh('cove.rocks');
    this.follow = followToon(lentToon(POOL_LOOK)); // its lent graph's toon look follows the day clock once a frame
    this.group.add(this.scenes.group('cascade.root'));

    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/engine/physics/pieces.ts turns it into Rapier colliders.
   *
   * The nine wall boxes; the floor as three slabs (the antechamber and the passage at 1.2 m, the alcove at 2.2 m); the
   * ramp between them as the four steps the mesh draws (0.25 m rise), alcove-wide so the upper ones meet the alcove's
   * wider floor; and a back-fill block behind the back wall over the far side of `terrainCuts()` — the heightfield
   * under the cave must be cut for any of this floor to be the floor.
   *
   * The drawn ramp is 45° (1 m up over lz 5.8–6.8): four treads 0.25 deep are narrower than the 0.38 m capsule, which
   * then rides their edges as a 45° slope and stops. So the treads run 0.375 m each (34°), lz 5.65–7.15 — from just
   * behind the sluice door (its leaf ends at lz ≈ 5.61) to 0.35 m into the alcove, whose floor the top tread is flush
   * with; the collision is within one rise (0.25 m) of the drawn steps all along.
   */
  colliderDescs(): ColliderDesc[] {
    return coveColliderDescs();
  }

  /**
   * PHYSICS P4: where the terrain heightfield must be pushed down for the cave to be walkable — every heightfield
   * vertex inside a rectangle (centre x, z; half-extents hw across, hd along; turned `yaw` about +Y like a
   * ColliderDesc) takes min(its height, `below`). `below` is under the cave floor.
   */
  terrainCuts(): { x: number; z: number; hw: number; hd: number; yaw: number; below: number }[] {
    return structuredClone(this.cuts);
  }

  /** the cave's walkable floor under (x, z), else undefined (its baked rects: antechamber, ramp, alcove) */
  floorHeightAt(x: number, z: number): number | undefined { return floorAtRects(coveFloors(), x, z, 'first'); }

  update(_dt: number): void {
    this.follow?.();
  }
}
