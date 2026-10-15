/**
 * Seabed — the lagoon floor of an open-water shard (Driftwood Isle): where its reef stands and its fish swim (E306 /
 * E315 M1: the coral clumps, seaweed beds, reef starfish and the fish are models, src/shards/driftwood-isle/models/
 * reef.ts and reefFish.ts; this is the world side). Built by @wildshard/sdk/looks/reefBed from data/seabedLook.ts: the
 * reef is ONE flat-shaded vertex-coloured mesh (one draw call, ~15k tris at the default count) welded from every copy in
 * scatter order from one rng stream, each kind placed `drawnInto` it; the seaweed sways in the vertex shader; nothing
 * collides (you swim through it — underwater is decorative, no underworld).
 *
 *   const seabed = await new Seabed(sky).build();   // the baked layout: where the water is 1.5–8 m deep
 *   scene.add(seabed.mesh);
 *   game.onUpdate((dt) => seabed.update(dt));                           // the sway clock, the school
 *
 * `seabed.fish`: the school — the reef fish placed instanced (one more draw call), circling a lissajous path over the
 * reef; built when the baked layout has a `school`.
 */
import type * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ReefBed, type ReefBed as ReefBedSet } from '../runtime/looks/reefBed';
import { loadReefWorld } from '../boot/reefGeometry';
import { SEABED } from '../data/seabedLook';
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };
import { REEF, reefMaterial, type ReefParams } from '../models/reef';
import { reefFish } from '../models/reefFish';

export class Seabed {
  private readonly bed: ReefBedSet<ReefParams>;

  constructor(sky: Sky) {
    this.bed = new ReefBed<ReefParams>(sky, SEABED, { kinds: REEF, material: reefMaterial, fish: reefFish }, (p) => ({ s: p.s, rot: p.rot, v: p.v }));
  }

  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  get placed(): Placed[] { return this.bed.placed; }
  get mesh(): THREE.Mesh { return this.bed.mesh; }
  get fish(): THREE.InstancedMesh | undefined { return this.bed.fish; }
  get count(): number { return this.bed.count; }
  get tris(): number { return this.bed.tris; }

  /** the baked lagoon layout (generators/reefScatter.ts: 360 copies, the wreck kept clear) on the baked weld */
  async build(): Promise<this> {
    const batch = await loadReefWorld(REEF_LAYOUT.items.length);
    this.bed.build(REEF_LAYOUT, heightAt, batch);
    return this;
  }

  update(dt: number): void { this.bed.update(dt); }
}
