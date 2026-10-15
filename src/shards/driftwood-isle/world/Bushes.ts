/**
 * Bushes — where Driftwood Isle's hibiscus shrubs stand (E306 / E315 M1: the bush itself is the model
 * src/shards/driftwood-isle/models/hibiscusBush.ts, the user's E116 leaf clump; this is the world side). A quarter of
 * them are in flower. `placeSliced()` registers them into one flat-shaded vertex-coloured mesh on the shared lowPolyLookMaterial
 * through src/engine/models/place.ts — one registry piece, `bushes`, with no colliders (you walk through them).
 *
 *   const bushes = await new Bushes(sky).placeSliced(foliage.bushes, registry, due);   // the game (main.ts)
 *   scene.add(bushes.mesh);
 */
import * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { islandKnobs } from '../tiers';
import { hibiscusBush, type HibiscusBushParams } from '../models/hibiscusBush';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';
import { loadHibiscusWorld } from '../boot/hibiscusGeometry';

export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export class Bushes {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every bush, merged into one mesh (an empty mesh when nothing was placed) */
  mesh!: THREE.Mesh;
  /** what was built (the board's in-world camera finds a patch from these) */
  readonly specs: BushSpec[] = [];

  constructor(private sky: Sky) {}

  /** Admit the compiled placement rows and geometry a slice at a time (SF67: `due` is the load's task budget); the same bushes */
  async placeSliced(rows: {readonly specs: readonly BushSpec[]; readonly placements: readonly Placement<HibiscusBushParams>[]}, registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    const { specs, placements } = rows;
    this.specs.push(...specs);
    const batch = await loadHibiscusWorld(specs.length); await due();
    const mesh = new THREE.Mesh(batch.geometry, lowPolyLookMaterial(this.sky));
    mesh.name = hibiscusBush.id;
    mesh.castShadow = islandKnobs().bushShadows; mesh.receiveShadow = true; mesh.customDepthMaterial = swayDepthMaterial();
    mesh.userData['islandDressingClipped'] = true;
    return this.take(place(hibiscusBush, placements, { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'bushes' }, drawnInto: { object: mesh, boxes: batch.boxes } }));
  }

  private take(placed: Placed): this {
    // (an empty scatter — a stale terrain, a def with no land — places nothing: an empty mesh stands in, as it always did)
    this.mesh = isMesh(placed.object) ? placed.object : new THREE.Mesh();
    this.placed = placed;
    return this;
  }
}
