/**
 * Seabed — the lagoon floor of an open-water shard (Driftwood Isle): where its reef stands and its fish swim (E306 /
 * E315 M1: the coral clumps, seaweed beds, reef starfish and the fish are models, src/shards/driftwood-isle/models/
 * reef.ts and reefFish.ts; this is the world side). Built by the existing ReefBed from data/seabedLook.ts: the
 * reef is ONE flat-shaded vertex-coloured mesh (one draw call, ~15k tris at the default count) welded from every copy in
 * scatter order from one rng stream, each kind placed `drawnInto` it; the seaweed sways in the vertex shader; nothing
 * collides (you swim through it — underwater is decorative, no underworld).
 *
 *   const seabed = await buildSeabed(sky);   // the baked layout: where the water is 1.5–8 m deep
 *   scene.add(seabed.mesh);
 *   game.onUpdate((dt) => seabed.update(dt));                           // the sway clock, the school
 *
 * `seabed.fish`: the school — the reef fish placed instanced (one more draw call), circling a lissajous path over the
 * reef; built when the baked layout has a `school`.
 */
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ReefBed } from '../runtime/looks/reefBed';
import { loadReefWorld } from '../runtime/boot/reefGeometry';
import { SEABED } from '../data/seabedLook';
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };
import { REEF, reefMaterial, type ReefParams } from '../runtime/models/reef';
import { reefFish } from '../runtime/models/reefFish';

/** The built reef owner itself supplies placements, draws, counts and its school clock. */
export type Seabed = ReefBed<ReefParams>;

/** Build the original lagoon owner without a second forwarding object. */
export async function buildSeabed(sky: Sky): Promise<Seabed> {
  const bed = new ReefBed<ReefParams>(sky, SEABED, { kinds: REEF, material: reefMaterial, fish: reefFish }, (p) => ({ s: p.s, rot: p.rot, v: p.v }));
  const batch = await loadReefWorld(REEF_LAYOUT.items.length);
  return bed.build(REEF_LAYOUT, heightAt, batch);
}
