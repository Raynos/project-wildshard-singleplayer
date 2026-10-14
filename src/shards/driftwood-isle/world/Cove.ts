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
 * pool's ring, the cascade's banks) are the reef-rock model (src/shards/driftwood-isle/models/reefRock.ts), placed
 * `drawnInto` the smooth-rock mesh they are welded in. `place` registers the cove's own piece (`cove`: drawn, its
 * colliders and floors; no card); the Wreck cove set (src/shards/driftwood-isle/world/places.ts) lists these rocks.
 *
 *   const cove = new Cove(sky).place(registry, Cove.forIsland());   // the game: piece `cove` (world) + the reef rocks' card
 *   const cove = new Cove(sky).build(Cove.forIsland());                          // a dev page / the navmesh bake: not registered
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
import { copyCoveGeometry, coveColliderDescs } from '../boot/coveGeometry';
import { coveFloorAt, coveHalfWidth, islandCoveSpec, type CoveSpec, type CaveBounds, type CoveAnchor } from './coveLayout';
import { waterfallFor, type WaterfallLike } from './Waterfall';
import { rockMaterial } from './rockKit';
import { reefRock } from '../models/reefRock';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { POOL_LOOK } from '../data/poolLook';

let poolLook: { material: THREE.Material; follow: () => void } | null = null;
/** hand the pools their compiled graph (look.materials, data/poolLook.ts: the ripple rings) and its toon look's
 *  once-a-frame follow, before the world builds */
export function setPoolLook(materials: ReadonlyMap<string, THREE.Material>, follow: () => void): void {
  const material = materials.get(POOL_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the cove pool graph');
  poolLook = { material, follow };
}

export class Cove {
  group = new THREE.Group();
  colliders: Collider[] = [];
  crabSites: { x: number; z: number }[] = [];
  anchors: Record<string, CoveAnchor> = {};
  caveBounds: CaveBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };
  /** the pools' toon look follows the day clock once a frame (their ripple runs on the graph's own frame clock) */
  private follow: (() => void) | null = null;
  private fall: WaterfallLike | null = null;
  private cave: CoveSpec['cave'] = { x: 0, z: 0, yaw: 0, w: 0, h: 0, depth: 0 };
  /** Registration facts borrow the existing baked reef draw; no retained matrix/box copies. */
  private catalogue: ReturnType<typeof copyCoveGeometry>['catalogue'] = {placements:[],boxes:[]};
  private cuts: ReturnType<typeof copyCoveGeometry>['native']['cuts'] = [];
  private rockMesh: THREE.Mesh | null = null;
  /** the reef rocks' placement (the Wreck cove set's member) */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky) {}

  static forIsland(): CoveSpec { return islandCoveSpec(); }

  /**
   * The game's: build it, register the cove (piece `cove`: the sea cave, the pools and the cascade are world, drawn and
   * colliding as always — no card) and its reef rocks' placements (drawnInto their mesh; `placed`, the Wreck cove set's).
   */
  place(registry: WorldRegistry, spec: CoveSpec): this {
    this.build(spec);
    registry.add({ id: 'cove', name: 'Wreck cove', category: 'nature', file: 'src/shards/driftwood-isle/world/Cove.ts', object: this.group, colliders: this.colliderDescs(), surface: 'rock',
      floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true });
    if (this.rockMesh !== null && this.catalogue.placements.length > 0) {
      this.placed.push(place(reefRock,this.catalogue.placements,{ctx:modelContext(this.sky),draw:'merged',registry,
        drawnInto:{object:this.rockMesh,boxes:Float32Array.from(this.catalogue.boxes)},piece:{id:'wreck-cove-reef-rocks'}}));
    }
    return this;
  }

  private L(x: number, z: number): [number, number] {
    const c = this.cave, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = x - c.x, dz = z - c.z;
    return [dx * cs - dz * sn, dx * sn + dz * cs];
  }
  build(spec: CoveSpec): this {
    const built = copyCoveGeometry(spec);
    this.crabSites = spec.crabSites;
    this.cave = spec.cave;
    this.caveBounds = spec.caveBounds;
    this.catalogue = built.catalogue;
    this.colliders=structuredClone(built.native.colliders);
    this.anchors=structuredClone(built.native.anchors);
    this.cuts=built.native.cuts;
    const rocks = new THREE.Mesh(built.geometry.structure, lowPolyLookMaterial(this.sky));
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.group.add(rocks);
    const sm = new THREE.Mesh(built.geometry.rocks, rockMaterial(this.sky));
    sm.name = 'cove-rocks'; sm.castShadow = true; sm.receiveShadow = true;
    this.group.add(sm); this.rockMesh = sm;
    const glowMesh = new THREE.Mesh(built.geometry.glow, new THREE.MeshBasicMaterial({ vertexColors: true }));
    glowMesh.name = 'cove-glow'; this.group.add(glowMesh);
    // the pools: concentric ripple rings drift outward, the sun catches their crests (data/poolLook.ts)
    if (poolLook === null) throw new Error('Driftwood: the cove pool graph was not compiled before the world build');
    this.follow = poolLook.follow;
    const poolMesh = new THREE.Mesh(built.geometry.pools, poolLook.material);
    poolMesh.receiveShadow = true; poolMesh.renderOrder = 1;
    this.group.add(poolMesh);

    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot, dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz);
      const px = fx + (dx / len) * 1.2, pz = fz + (dz / len) * 1.2;
      // E150: the toon cascade in three terraces; its foam rings stay inside the 2.4 m pool
      this.fall = waterfallFor({ lip: new THREE.Vector3(tx, heightAt(tx, tz) + 0.3, tz), foot: new THREE.Vector3(px, heightAt(fx, fz) + 0.06, pz), width: 2.2, ground: heightAt, poolRadius: 2.3, steps: 3 }).build();
      this.group.add(this.fall.group);
    }

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

  /** the cave's walkable floor under (x, z), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const [lx, lz] = this.L(x, z);
    if (lz < -0.3 || lz > this.cave.depth) return undefined;
    if (Math.abs(lx) > coveHalfWidth(lz) + 0.1) return undefined;
    return coveFloorAt(lz);
  }

  update(_dt: number): void {
    this.follow?.();
  }
}
