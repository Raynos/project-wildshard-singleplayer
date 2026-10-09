/**
 * Palms — where Driftwood Isle's coconut palms stand (E306 / E315 M1: the palm itself is the model
 * src/shards/driftwood-isle/models/palm.ts; this is the world side). `scatterIsland()` is the island rule; `place()` puts
 * one palm on each spec, its foot 0.2 m into the sand, merged into one mesh through src/engine/models/place.ts — one registry
 * piece, `palms`, with every trunk's three capsules. `update()` advances the shared wind the fronds sway in.
 *
 *   const palms = new Palms(sky).place(Palms.scatterIsland(seed), registry);   // the game (main.ts)
 *   const palms = new Palms(sky).build(Palms.scatterIsland(seed));             // a dev page: no registry
 *   scene.add(palms.mesh); its registry piece.push(...palms.colliders);
 *   game.onUpdate((dt) => palms.update(dt));
 */
import * as THREE from 'three';
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { normalAt, waterLevel, inChunk } from '@wildshard/engine/world/Heightfield';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { windUniforms, updateWind } from '@wildshard/engine/world/wind';
import { islandKnobs } from '../tiers';
import { palm, type PalmParams } from '../models/palm';

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export class Palms {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every palm, merged into one mesh (an empty group when nothing was placed) */
  mesh!: THREE.Mesh;
  /** the legacy upright box of every trunk: the ocean's foam rings and the melee sweep */
  colliders: Collider[] = [];
  count = 0;
  /** PHYSICS P4: each trunk as capsules along its bent axis (see colliderDescs) */
  private trunks: ColliderDesc[] = [];

  constructor(private sky: Sky) {}

  /** Island rule: behind the beach and on the plateau top, denser in groves, never on steep rock, clear of the hut and piers. */
  static scatterIsland(seed: number, count = Math.round(islandKnobs().palmCount * 1.7), avoid: { x: number; z: number; r: number }[] = []): PalmSpec[] {
    const rng = new Rng(seed ^ 0x9a1e), grove = new Noise2D(seed + 21);
    const wl = waterLevel();
    const out: PalmSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 80) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.4) continue;                                                       // land only, above the beach berm
      const [, ny] = normalAt(x, z, 1.5);
      if (ny < 0.9) continue;                                                      // not on the crag walls
      const g = grove.fbm(x * 0.012, z * 0.012, 3);
      const beachEdge = h < 3.4 ? 0.95 : 0;                                        // the back beach is lined with palms (E43: twice as many)
      if (rng.next() > Math.max(beachEdge, (g + 0.35) * 0.9)) continue;           // groves inland
      if (Math.abs(x) < ROAD_WIDTH / 2 + 6 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 6 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3.8)) continue;
      out.push({ x, z, h: rng.range(5, 9.5), lean: rng.range(0.05, 0.35), leanDir: rng.range(0, Math.PI * 2), rot: rng.range(0, Math.PI * 2), fronds: rng.int(9, 13) });
    }
    return out;
  }

  /** each spec as a placement of the palm: its foot 0.2 m into the sand, its shape from the spec */
  static placements(specs: readonly PalmSpec[]): Placement<PalmParams>[] {
    return specs.map((p) => ({ x: p.x, y: heightAt(p.x, p.z) - 0.2, z: p.z, params: { h: p.h, lean: p.lean, leanDir: p.leanDir, rot: p.rot, fronds: p.fronds } }));
  }

  /** the game's: placed and registered (piece `palms`, the catalog's Coconut palm) */
  place(specs: PalmSpec[], registry: WorldRegistry): this { return this.draw(specs, registry); }

  /** a dev page's: the same palms, not registered */
  build(specs: PalmSpec[]): this { return this.draw(specs, null); }

  /** `place`, its merged copies built a slice at a time (SF67: `due` is the load's task budget); the same palms */
  async placeSliced(specs: PalmSpec[], registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    const pls = Palms.placements(specs);
    return this.take(specs, pls, await placeSliced(palm, pls, { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'palms', solidFloor: true } }, due));
  }

  private draw(specs: PalmSpec[], registry: WorldRegistry | null): this {
    const pls = Palms.placements(specs);
    return this.take(specs, pls, place(palm, pls, { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'palms', solidFloor: true } }));
  }

  private take(specs: PalmSpec[], pls: readonly Placement<PalmParams>[], placed: Placed): this {
    // (an empty scatter — a stale terrain, a def with no land — places nothing: an empty mesh stands in, as it always did)
    this.mesh = isMesh(placed.object) ? placed.object : new THREE.Mesh();
    this.placed = placed;
    this.trunks = [...placed.colliders];
    this.count = placed.copies;
    // the legacy upright box of every trunk, from 1 m under its foot to its crown
    pls.forEach((pl, i) => { const p = specs[i]; if (p) this.colliders.push({ x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0, yTop: pl.y + p.h, yBottom: pl.y - 1 }); });
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — every trunk as three capsules following its lean
   * and bend (in place of the legacy upright 0.6 m box, which `colliders` still carries for foam). src/engine/physics/pieces.ts
   * turns it into Rapier colliders. Palms have no floors.
   */
  colliderDescs(): ColliderDesc[] { return this.trunks.slice(); }

  /** the island's wind gust, 0 calm … 1 gusting (wind.ts) — what the fronds, bushes, grass, sails and banner sway with; the
   * sound agent's palm rustle reads it */
  get gust(): number { return windUniforms.uGust.value; }

  /** advances the shared wind (wind.ts) — once a frame, for everything that sways */
  update(dt: number): void { updateWind(dt); }
}
