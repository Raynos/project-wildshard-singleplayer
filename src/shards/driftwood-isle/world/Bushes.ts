/**
 * Bushes — where Driftwood Isle's hibiscus shrubs stand (E306 / E315 M1: the bush itself is the model
 * src/shards/driftwood-isle/models/hibiscusBush.ts, the user's E116 leaf clump; this is the world side). A quarter of
 * them are in flower. `place()` merges them into one flat-shaded vertex-coloured mesh on the shared lowPolyMaterial
 * through src/engine/models/place.ts — one registry piece, `bushes`, with no colliders (you walk through them).
 *
 *   const bushes = new Bushes(sky).place(Bushes.scatterIsland(seed), registry);   // the game (main.ts)
 *   const bushes = new Bushes(sky).build(Bushes.scatterIsland(seed));             // a dev page: no registry
 *   scene.add(bushes.mesh);
 */
import * as THREE from 'three';
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, placeSliced, type Placed } from '@wildshard/engine/models/place';
import { normalAt, waterLevel, inChunk } from '@wildshard/engine/world/Heightfield';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { islandKnobs } from '../tiers';
import { hibiscusBush, type HibiscusBushParams } from '../models/hibiscusBush';

export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export class Bushes {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every bush, merged into one mesh (an empty mesh when nothing was placed) */
  mesh!: THREE.Mesh;
  count = 0;
  /** what was built (the board's in-world camera finds a patch from these) */
  readonly specs: BushSpec[] = [];

  constructor(private sky: Sky) {}

  static scatterIsland(seed: number, count = islandKnobs().bushCount, avoid: { x: number; z: number; r: number }[] = []): BushSpec[] {
    const rng = new Rng(seed ^ 0xb054), clump = new Noise2D(seed + 33);
    const wl = waterLevel();
    const out: BushSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.5) continue;
      const [, ny] = normalAt(x, z, 1.2);
      if (ny < 0.88) continue;
      const c = clump.fbm(x * 0.02, z * 0.02, 2);
      const beachTop = h < 3.0 ? 0.5 : 0;
      if (rng.next() > Math.max(beachTop, (c + 0.4) * 0.8)) continue;
      if (Math.abs(x) < ROAD_WIDTH / 2 + 4 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 4 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 2.2)) continue;
      out.push({ x, z, r: rng.range(0.7, 1.5), flowers: rng.next() < 0.28 });
    }
    return out;
  }

  /** each spec as a placement of the bush: on the ground, its sway's phase from where it stands */
  static placements(specs: readonly BushSpec[]): Placement<HibiscusBushParams>[] {
    return specs.map((b) => ({ x: b.x, y: heightAt(b.x, b.z), z: b.z, params: { r: b.r, flowers: b.flowers, phase: (b.x + b.z) * 0.37 } }));
  }

  /** the game's: placed and registered (piece `bushes`, the catalog's Hibiscus bush) */
  place(specs: BushSpec[], registry: WorldRegistry): this { return this.draw(specs, registry); }

  /** a dev page's: the same bushes, not registered */
  build(specs: BushSpec[]): this { return this.draw(specs, null); }

  /** `place`, its merged copies built a slice at a time (SF67: `due` is the load's task budget); the same bushes */
  async placeSliced(specs: BushSpec[], registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    this.specs.push(...specs);
    return this.take(await placeSliced(hibiscusBush, Bushes.placements(specs), { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'bushes' } }, due));
  }

  private draw(specs: BushSpec[], registry: WorldRegistry | null): this {
    this.specs.push(...specs);
    return this.take(place(hibiscusBush, Bushes.placements(specs), { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'bushes' } }));
  }

  private take(placed: Placed): this {
    // (an empty scatter — a stale terrain, a def with no land — places nothing: an empty mesh stands in, as it always did)
    this.mesh = isMesh(placed.object) ? placed.object : new THREE.Mesh();
    this.placed = placed;
    this.count = placed.copies;
    return this;
  }
}
