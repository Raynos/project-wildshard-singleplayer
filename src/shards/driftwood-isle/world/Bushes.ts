/**
 * Bushes — where Driftwood Isle's hibiscus shrubs stand (E306 / E315 M1: the bush itself is the model
 * src/shards/driftwood-isle/models/hibiscusBush.ts, the user's E116 leaf clump; this is the world side). A quarter of
 * them are in flower. `placeIslandBushes()` registers them into one flat-shaded vertex-coloured mesh on the shared lowPolyLookMaterial
 * through src/engine/models/place.ts — one registry piece, `bushes`, with no colliders (you walk through them).
 *
 *   const bushes = await placeIslandBushes(sky, foliage.bushes, registry, due);   // the game (main.ts)
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
import { loadHibiscusWorld } from '../runtime/boot/hibiscusGeometry';

export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

/** Admit and register the owned world batch through the shared placement host. */
export async function placeIslandBushes(sky: Sky, rows: { readonly specs: readonly BushSpec[]; readonly placements: readonly Placement<HibiscusBushParams>[] }, registry: WorldRegistry, due: () => Promise<void> | null): Promise<{ placed: Placed; mesh: THREE.Mesh; specs: BushSpec[] }> {
  const { specs, placements } = rows, ownedSpecs = [...specs];
  const batch = await loadHibiscusWorld(specs.length); await due();
  const mesh = new THREE.Mesh(batch.geometry, lowPolyLookMaterial(sky));
  mesh.name = hibiscusBush.id;
  mesh.castShadow = islandKnobs().bushShadows; mesh.receiveShadow = true;
  mesh.userData['islandDressingClipped'] = true;
  const placed = place(hibiscusBush, placements, { ctx: modelContext(sky), draw: 'merged', registry, piece: { id: 'bushes' }, drawnInto: { object: mesh, boxes: batch.boxes } });
  // Empty scatters keep the existing empty mesh handle.
  return { placed, mesh: isMesh(placed.object) ? placed.object : new THREE.Mesh(), specs: ownedSpecs };
}
