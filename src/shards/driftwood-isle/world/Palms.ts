/**
 * Palms — where Driftwood Isle's coconut palms stand (E306 / E315 M1: the palm itself is the model
 * src/shards/driftwood-isle/models/palm.ts; this is the world side). the authored island rows own its sites; `placeSliced()` admits
 * one palm on each spec, its foot 0.2 m into the sand, merged into one mesh through src/engine/models/place.ts — one registry
 * piece, `palms`, with every trunk's three capsules. `update()` advances the shared wind the fronds sway in.
 *
 *   const palms = await new Palms(sky).placeSliced(foliage.palms, registry, due);
 *   scene.add(palms.mesh); its registry piece.push(...palms.colliders);
 *   game.onUpdate((dt) => palms.update(dt));
 */
import * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { windUniforms, updateWind } from '@wildshard/engine/world/wind';
import { loadPalmWorld } from '../boot/palmGeometry';
import { palm, palmMaterials, type PalmParams } from '../models/palm';

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export class Palms {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every palm, merged into one mesh (an empty group when nothing was placed) */
  mesh!: THREE.Mesh;
  /** the legacy upright box of every trunk: the ocean's foam rings and the melee sweep */
  colliders: Collider[] = [];

  constructor(private sky: Sky) {}

  /** Admit the owned world batch, then register its original native placements and capsules. */
  async placeSliced(rows: {readonly specs: readonly PalmSpec[]; readonly placements: readonly Placement<PalmParams>[]}, registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    const { specs, placements: pls } = rows;
    const batch = await loadPalmWorld(specs.length); await due();
    const { lit, depth } = palmMaterials(modelContext(this.sky)), mesh = new THREE.Mesh(batch.geometry, lit);
    mesh.name = palm.id; mesh.castShadow = true; mesh.receiveShadow = true; mesh.customDepthMaterial = depth;
    mesh.userData['islandDressingClipped'] = true;
    return this.take(specs, pls, place(palm, pls, { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'palms', solidFloor: true }, drawnInto: { object: mesh, boxes: batch.boxes } }));
  }

  private take(specs: readonly PalmSpec[], pls: readonly Placement<PalmParams>[], placed: Placed): this {
    // (an empty scatter — a stale terrain, a def with no land — places nothing: an empty mesh stands in, as it always did)
    this.mesh = isMesh(placed.object) ? placed.object : new THREE.Mesh();
    this.placed = placed;
    // the legacy upright box of every trunk, from 1 m under its foot to its crown
    pls.forEach((pl, i) => { const p = specs[i]; if (p) this.colliders.push({ x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0, yTop: pl.y + p.h, yBottom: pl.y - 1 }); });
    return this;
  }

  /** the island's wind gust, 0 calm … 1 gusting (wind.ts) — what the fronds, bushes, grass, sails and banner sway with; the
   * sound agent's palm rustle reads it */
  get gust(): number { return windUniforms.uGust.value; }

  /** advances the shared wind (wind.ts) — once a frame, for everything that sways */
  update(dt: number): void { updateWind(dt); }
}
