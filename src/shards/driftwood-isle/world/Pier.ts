/**
 * Pier — where Driftwood Isle's wooden piers stand (E306 / E315 M1: the pier itself is the model
 * src/shards/driftwood-isle/runtime/models/pier.ts; this is the world side): the south entry pier with its landing on the
 * crescent beach, and the three jetties at the other entry roads — four placements of one model, each its own merged
 * mesh (one draw), each its own registry piece (`pier`, `jetty-0..2`).
 *
 *   const pier = new Pier(sky, 0).place(registry, 'pier');   // world pier 0 (the south pier), as the author job placed it
 *   scene.add(pier.group); its registry piece.push(...pier.colliders);
 *   player.platforms.push((x, z) => pier.floorHeightAt(x, z)); // the deck is walkable
 *
 * The pier runs from (x, z) along its heading (`rot`, 0 = +z, north) for `length` metres. The author job measures the landing (it
 * marches over the shallows to the first dry sand) and places the pilings, bollards and their boxes (generators/pierSites.ts).
 * `floorHeightAt` returns the deck's top for any (x, z) over the deck, else undefined — same contract as `Cabins`.
 * `bollards` are the two tall rope-wrapped posts at the sea end (the sailboat moors to them); `posts` every piling.
 * The sailboat's mooring lines to its bollard and piling are baked offline (generators/mooringLines.ts).
 */
import type * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import {pier,PIER_WORLD} from '../runtime/models/pier';
import {pierDeckAt,pierHalfWidthAt} from './pierLayout';
import type {PierParams} from '../assets/contracts/pier';


export class Pier {
  /** what it draws: the deck's one mesh (+ the pennant's, on the south pier) */
  group!: THREE.Object3D;
  /** its `place` (the Pier landing set's member, M12) */
  placed: Placed | null = null;
  /** the legacy boxes of the posts and bollards: the ocean's foam rings and the melee sweep */
  colliders: Collider[];
  /** the two tall mooring posts at the sea end, world xz */
  bollards: { x: number; z: number }[];
  /** every piling along the deck, world xz (mooring lines, gulls…) */
  posts: { x: number; z: number }[];
  readonly deckY: number;
  private cos: number; private sin: number;
  /** the world pier's baked row (its landing measured on the sand) */
  private readonly row: typeof PIER_WORLD[number];
  private descs: ColliderDesc[] = [];

  /** `index` the world pier (0 the south pier, then the jetties) */
  constructor(private sky: Sky, index: number) {
    const row = PIER_WORLD[index];
    if (row === undefined) throw new Error(`No baked world pier ${String(index)}`);
    this.row = row; this.deckY = row.deckY;
    this.cos = Math.cos(row.rot); this.sin = Math.sin(row.rot);
    this.posts = row.posts.map(([x = 0, z = 0]) => ({ x, z })); this.bollards = row.bollards.map(([x = 0, z = 0]) => ({ x, z }));
    this.colliders = structuredClone(row.boxes);
  }

  /** the game's: placed and registered as piece `id` (the catalog's Pier: the four are one model) */
  place(registry: WorldRegistry, id: string): this {
    const { x, z, deckY, rot: yaw, params } = this.row;
    const pl: Placement<PierParams> = { x, y: deckY, z, ...(yaw === 0 ? {} : { yaw }), params };
    const placed = place(pier, [pl], { ctx: modelContext(this.sky), draw: 'single', registry,
      piece: { id, floor: (fx, fz) => this.floorHeightAt(fx, fz), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    this.descs = [...placed.colliders];
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its posts and bollards and every floor
   * `floorHeightAt` describes, as real geometry (the model's own-space colliders, placed: pierColliders in the model).
   * src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** world y of the deck under (x, z), or undefined off the pier */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.row.x, dz = z - this.row.z;
    const along = dx * this.sin + dz * this.cos, across = dx * this.cos - dz * this.sin;
    if (along < -0.2 || along > this.row.params.length + 0.2 || Math.abs(across) > pierHalfWidthAt(this.row.params, along) + 0.25) return undefined;
    return this.deckY + pierDeckAt(this.row.params, along);
  }
}
