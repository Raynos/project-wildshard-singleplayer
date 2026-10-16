/**
 * Palms — where Driftwood Isle's coconut palms stand (E306 / E315 M1: the palm itself is the model
 * src/shards/driftwood-isle/runtime/models/palm.ts; this is the world side). the authored island rows own its sites; `placeIslandPalms()` admits
 * one palm on each spec, its foot 0.2 m into the sand, merged into one mesh through src/engine/models/place.ts — one registry
 * piece, `palms`, with every trunk's three capsules. `update()` advances the shared wind the fronds sway in.
 *
 *   const palms = await placeIslandPalms(sky, foliage.palms, registry, due);
 *   scene.add(palms.mesh); its registry piece.push(...palms.colliders);
 *   game.onUpdate((dt) => palms.update(dt));
 */
import * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { updateWind } from '@wildshard/engine/world/wind';
import { loadPalmWorld } from '../runtime/boot/palmGeometry';
import { palm, palmMaterial, type PalmParams } from '../runtime/models/palm';

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

/** Admit and register the owned world batch, retaining its original wind clock and trunk boxes. */
export async function placeIslandPalms(sky: Sky, rows: { readonly specs: readonly PalmSpec[]; readonly placements: readonly Placement<PalmParams>[] }, registry: WorldRegistry, due: () => Promise<void> | null): Promise<{ placed: Placed; mesh: THREE.Mesh; colliders: Collider[]; update: typeof updateWind }> {
  const { specs, placements: pls } = rows;
  const batch = await loadPalmWorld(specs.length); await due();
  const mesh = new THREE.Mesh(batch.geometry, palmMaterial(modelContext(sky)));
  mesh.name = palm.id; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData['islandDressingClipped'] = true;
  const placed = place(palm, pls, { ctx: modelContext(sky), draw: 'merged', registry, piece: { id: 'palms', solidFloor: true }, drawnInto: { object: mesh, boxes: batch.boxes } });
  const colliders: Collider[] = [];
  // The legacy upright box of every trunk, from 1 m under its foot to its crown.
  pls.forEach((pl, i) => { const p = specs[i]; if (p) colliders.push({ x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0, yTop: pl.y + p.h, yBottom: pl.y - 1 }); });
  return { placed, mesh: isMesh(placed.object) ? placed.object : new THREE.Mesh(), colliders, update: updateWind };
}
