/**
 * Seabed — the lagoon floor of an open-water shard (Driftwood Isle): where its reef stands and its fish swim (E306 /
 * E315 M1: the coral clumps, seaweed beds, reef starfish and the fish are models, src/shards/driftwood-isle/models/
 * reef.ts and reefFish.ts; this is the world side). Built by @wildshard/sdk/looks/reefBed from data/seabedLook.ts: the
 * reef is ONE flat-shaded vertex-coloured mesh (one draw call, ~15k tris at the default count) welded from every copy in
 * scatter order from one rng stream, each kind placed `drawnInto` it; the seaweed sways in the vertex shader; nothing
 * collides (you swim through it — underwater is decorative, no underworld).
 *
 *   const seabed = new Seabed(sky).build(Seabed.scatterLagoon(seed));   // where the water is 1.5–8 m deep
 *   scene.add(seabed.mesh);
 *   game.onUpdate((dt) => seabed.update(dt));                           // the sway clock, the school
 *
 * `seabed.fish`: the school — the reef fish placed instanced (one more draw call), circling a lissajous path over the
 * reef; built when the layout has a `school` (scatterLagoon adds one).
 */
import type * as THREE from 'three';
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import type { Placed } from '@wildshard/engine/models/place';
import { normalAt, inChunk } from '@wildshard/engine/world/Heightfield';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ReefBed, scatterReefBed, type ReefBedLayout, type ReefBedSet, type ReefBedSpec, type ReefGround } from '@wildshard/sdk/looks/reefBed';
import { OCEAN } from '../manifest';
import { SEABED } from '../data/seabedLook';
import { REEF, reefMaterial, type ReefParams } from '../models/reef';
import { REEF_FISH_COLOURS, reefFish } from '../models/reefFish';

/** One scattered copy (a coral, weed or star). */
export type SeabedSpec = ReefBedSpec;
/** A scatter and its school. */
export type SeabedLayout = ReefBedLayout;

/** the lagoon's ground: the sea's level, the terrain, and off the four entry sandbars (the jetties) */
const LAGOON: ReefGround = {
  level: OCEAN.level,
  heightAt,
  normalY: (x, z, reach) => normalAt(x, z, reach)[1],
  clear: (x, z) => {
    if (!inChunk(x, z, SEABED.margin)) return false;
    if (Math.abs(x) < ROAD_WIDTH / 2 + 5 && Math.abs(z) > CHUNK_HALF - 75) return false; // the S / N jetties' sandbars
    if (Math.abs(z) < ROAD_WIDTH / 2 + 5 && Math.abs(x) > CHUNK_HALF - 120) return false; // the W / E ones (the E jetty runs on into the cove)
    return true;
  },
};

export class Seabed {
  private readonly bed: ReefBedSet<ReefParams>;

  constructor(sky: Sky) {
    this.bed = new ReefBed<ReefParams>(sky, SEABED, { kinds: REEF, material: reefMaterial, fish: reefFish, fishColours: REEF_FISH_COLOURS }, (p) => ({ s: p.s, rot: p.rot, v: p.v }));
  }

  /** Lagoon rule (data/seabedLook.ts): corals in noise-clustered reefs, seaweed in beds, a starfish here and there.
   *  `avoid` clears the wreck / anything else on the sand. */
  static scatterLagoon(seed: number, count = 360, avoid: { x: number; z: number; r: number }[] = []): SeabedLayout {
    return scatterReefBed(SEABED, LAGOON, seed, count, avoid);
  }

  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  get placed(): Placed[] { return this.bed.placed; }
  get mesh(): THREE.Mesh { return this.bed.mesh; }
  get fish(): THREE.InstancedMesh | undefined { return this.bed.fish; }
  get count(): number { return this.bed.count; }
  get tris(): number { return this.bed.tris; }

  build(layout: SeabedLayout | SeabedSpec[]): this {
    this.bed.build(layout, heightAt);
    return this;
  }

  update(dt: number): void { this.bed.update(dt); }
}
