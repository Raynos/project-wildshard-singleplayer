import { driftwoodRows } from '../runtime/boot/rows';
import { loadIslandCover } from './islandCover';
import { TIER } from '@wildshard/engine/core/tier';
import { readDriftwoodBlob, loadFixedGeometry } from '../runtime/boot/blobAssets';
/**
 * Driftwood Isle's world build (E357 S4.1, 08 §4 `level.world`, §6.1 step 2): the ~15 builders `main.ts`'s `edge` step
 * ran behind `isOcean ?`, in the same order with the same arguments and a `slice()` between them (the 30 ms task
 * budget), then the rope bridge's jointed deck, the island's walkway ramps and the Blender spawn cove over the procedural
 * one. The plugin (../plugin.ts) runs it in the level's world stage.
 */
import * as THREE from 'three';
import { BuildStages, macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { pathRampDescs } from '@wildshard/engine/physics/paths';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES, BRIDGE, BOAT_MOOR } from '../world/sites';
import manifest from '../discovery.generated';
import { Ocean, loadOcean } from './Ocean';
import { Pier } from './Pier';
import { Boat } from './Boat';
import { placeShoreBoulders, SHORE_PERCHES } from './Boulders';
import { hut as hutModel, lookout as lookoutModel, bakedSite } from '../runtime/models/fixedSites';
import { Wreck } from './Wreck';
import { placeShrine, type Shrine } from '../runtime/world/Shrine';
import { placeIslandBushes } from './Bushes';
import { gullFlock } from '../runtime/world/Gulls';
import type { AmbientFlockDraw } from '@wildshard/sdk/looks/ambientFlock';
import { buildTrailside } from './Trailside';
import { placeRopeBridge } from './RopeBridge';
import { buildSeabed, type Seabed } from './Seabed';
import { placeIslandPalms, type PalmSpec } from './Palms';
import { Cove } from './Cove';
import { GroundCover } from './GroundCover';
import type { BlenderIsland } from './BlenderIsland';
import { ENTRY_FOOTPRINTS, LOWERED_SEA, SHORE_INNER_FACE, type DryRect } from './sea';
import { ENTRY_LANDINGS, type EntryLanding } from '../data/entryLandings';
import { onDeck } from './entryDeck';
import { entryDeck } from '../runtime/models/entryDeck';
import { modelContext } from '@wildshard/engine/models/model';
import { place, placeModelSite, type ModelSite } from '@wildshard/engine/models/place';

/** What the world build hands the rest of the level (today's `dressing` handle in main.ts, plus the deck and the cove). */
export interface DriftwoodWorld {
  ocean: Ocean | null; pier: Pier | null; jetties: Pier[]; boat: Boat | null; rocks: Awaited<ReturnType<typeof placeShoreBoulders>> | null;
  hut: ModelSite | null; lookout: ModelSite | null; wreck: Wreck | null; shrine: Shrine | null; bushes: Awaited<ReturnType<typeof placeIslandBushes>> | null;
  gulls: AmbientFlockDraw | null; trailside: ReturnType<typeof buildTrailside> | null; bridge: ReturnType<typeof placeRopeBridge> | null; seabed: Seabed | null;
  palmSpecs: PalmSpec[]; cove: Cove | null; palms: Awaited<ReturnType<typeof placeIslandPalms>> | null; cover: GroundCover | null;
  bridgeDeck: RopeChain | null; blenderIsland: BlenderIsland | null;
}

/** SF46 (G164, shipped by G172): how the world is built with the whole island lowered (the terrain and everything on it
 *  follow the manifest's dropped field, ./sea.ts): the sea at road level, each pier and jetty starting past its entry's
 *  asphalt socket with a ramp up from the socket's road height (their sites: generators/pierSites.ts). */
export interface DriftwoodLowered {
  readonly level: number;
  /** the declared sea row's dry sockets (the swim body's clip, ./sea.ts); the ocean's draw clips each whole deck (G170) */
  readonly dry: readonly DryRect[];
  /** how far inside a confining grid cell's edge the sea stops (G149: the shore revetment's inner face) */
  readonly edgeInset: number;
  /** G164: the shardfile's declared entry landings (world/sea.ts), installed exactly as declared; G170: each is the inner
   *  end of an asphalt road deck (./entryDeck.ts) that carries the socket on over it, and a pier / jetty ramps up from it */
  readonly landings: readonly EntryLanding[];
}
/** G164's lowered world: the sea at road level */
export const G164_LOWERED: DriftwoodLowered = { level: LOWERED_SEA, dry: ENTRY_FOOTPRINTS, edgeInset: SHORE_INNER_FACE, landings: ENTRY_LANDINGS };

/** The handle off Driftwood: nothing built (main.ts's readers keep their `?.` until S4.2–S4.4 move them). */
export function noDriftwoodWorld(): DriftwoodWorld {
  return { ocean: null, pier: null, jetties: [], boat: null, rocks: null, hut: null, lookout: null, wreck: null, shrine: null,
    bushes: null, gulls: null, trailside: null, bridge: null, seabed: null, palmSpecs: [], cove: null, palms: null, cover: null,
    bridgeDeck: null, blenderIsland: null };
}

/** main.ts:366-467's Driftwood builders, lowered as one by G164 (`sea` is the lowered sea at road level). */
export async function buildDriftwoodWorld(world: World, viewer: () => THREE.Vector3, progress?: StepProgress): Promise<DriftwoodWorld> {
  const lowered = G164_LOWERED, fixed = driftwoodRows('custom/fixedLayouts');
  if (fixed.entryDecks.some(({ rect }) => rect.minX >= rect.maxX || rect.minZ >= rect.maxZ)) throw new Error('Entry deck requires a positive footprint');
  const { game, sky, player, registry } = world;
  const [{ cutTerrain }, { normalAt, TRAILS }, , islandCover, coverCells] = await Promise.all([import('@wildshard/engine/physics/terrain'), import('@wildshard/engine/world/Heightfield'), loadFixedGeometry(undefined, game.registrationScope),loadIslandCover(),readDriftwoodBlob(`world/cover/cells/${TIER}.bin`)]); // the deferred world code (cut, the live baked heightfield)
  islandCover.wear(world.terrain.mesh.geometry, 0); // E156: the ground wears the cover (its baked bytes, world/islandCover.ts)
  const sea = { level: lowered.level };
  // the built things' legacy boxes, for the ocean's foam rings (every one registers itself: models through
  // src/engine/models/place.ts, the world's welds — the trail, the cove — as world pieces, E315)
  const statics: Collider[] = [];
  const slice = slicer(30, progress);
  const total = 16 + JETTIES.length;
  const stages = new BuildStages({ slice, total, parent: game.scene, collect: statics });
  progress?.set(0, total, 'Preparing world builders'); // between the builders below: a task ends once it has run ~30 ms (the pier … cove were one 0.3–0.5 s task)
  // G170: the ocean is clipped out under each whole road deck (the socket and its landing), not only the socket
  const deckRows = lowered.landings.map(({ edge }) => {
    const row = fixed.entryDecks.find(deck => deck.edge === edge);
    if (row === undefined) throw new Error('Missing admitted entry deck');
    return row;
  }), decks = deckRows.map(({ rect }) => rect);
  const ocean = new Ocean(sky).build(await loadOcean(), sea.level, decks, lowered.edgeInset);
  game.scene.add(ocean.group);
  // the south entry road is a wooden pier over the water; the player spawns on its deck
  // E315 M1: the pier model (../runtime/models/pier.ts) placed through src/engine/models/place.ts, which registers piece `pier`
  // SF46: it starts past the entry socket and ramps up from road height (Jake's SF72 flare; generators/pierSites.ts)
  const pier = new Pier(sky, 0).place(registry, 'pier');
  // G170: the four asphalt road decks over the water (./entryDeck.ts): the platform's socket floor carried on over the
  // declared entry landings (the shardfile's socket-landing proof, installed exactly as declared); each ramp rises from one
  registry.add({ id: 'entry-landings', name: 'Entry landings', category: 'props', file: 'src/shards/driftwood-isle/world/sea.ts', surface: 'stone',
    colliders: lowered.landings.map(({ box }) => ({ ...box })), solidFloor: true,
    floor: (x, z) => (lowered.landings.some(({ box }) => Math.abs(x - box.x) <= box.hx && Math.abs(z - box.z) <= box.hz) ? 0 : undefined) });
  place(entryDeck, deckRows.map(({ placement }) => placement), { ctx: modelContext(sky), draw: 'merged', registry,
    piece: { id: 'entry-decks', floor: (x, z) => (onDeck(decks, x, z) ? 0 : undefined), solidFloor: true } });
  statics.push(...deckRows.map(({ slab }) => slab));
  statics.push(...pier.colliders);
  const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
  // the little sailboat you arrived in, moored alongside the pier by the spawn (E308: half way down); you can drop into it
  // E315 M1: the sailboat model (../models/boat.ts) placed through src/engine/models/place.ts, which registers
  // piece `boat`: it rides the swell, its colliders (in the boat's own frame) follow it on a kinematic body (P4)
  // SF46 (G164): lowered with everything else, it stays moored by the pier
  const boat = new Boat(sky, { x: BOAT_MOOR.x, z: BOAT_MOOR.z, heading: 0, waterY: sea.level, moored: true }).place(registry);
  statics.push(...boat.colliders);
  if (boat.ropes) game.scene.add(boat.ropes);
  await stages.next('Pier and boat');
  // faceted shore boulders along the beach
  // E306 M0b: a model (../models/shoreBoulder.ts) placed through src/engine/models/place.ts, which registers piece `rocks`
  const rocks = await stages.build('Shore boulders', () => placeShoreBoulders(sky, registry, slice.due), { values: value => value.colliders });
  // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
  const hut = await stages.build('Hut', () => { const s = bakedSite('hut', { site: HUT }); return placeModelSite(hutModel, s.origin, s.layout, { ctx: modelContext(sky), registry, piece: { id: 'hut' } }); }, { values: value => value.colliders });
  // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
  const lookoutSite = { site: LOOKOUT, zipTo: { x: Cove.forIsland().cave.x, z: Cove.forIsland().cave.z } };
  const lookout = await stages.build('Lookout', () => { const s = bakedSite('lookout', lookoutSite); return placeModelSite(lookoutModel, s.origin, s.layout, { ctx: modelContext(sky), registry, piece: { id: 'lookout' } }); }, { values: value => value.colliders });
  // E315 M1: the shipwreck model (../runtime/models/fixedSites.ts) with the cove's cargo, drift logs and reef
  // rocks, placed drawnInto the wreck site's meshes (piece `wreck`: the site's colliders; the Wreck cove set)
  const wreck = await stages.build('Wreck', () => new Wreck(sky, WRECK).place(registry), { objects: value => [value.group], values: value => value.colliders });
  // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
  const shrine = await stages.build('Shrine', () => placeShrine(sky, SHRINE, registry), { values: value => value.colliders });
  // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
  const jetties: Pier[] = [];
  for (const [i] of JETTIES.entries()) {
    const jetty = new Pier(sky, i + 1).place(registry, `jetty-${i}`); statics.push(...jetty.colliders); jetties.push(jetty); await stages.next(`Jetty ${i + 1}`);
  }
  await slice();
  if (fixed.foliage.seed !== manifest.seed) throw new Error('Foliage placements require their authored seed');
  const foliage = fixed.foliage.tiers[game.tier];
  const bushes = await stages.build('Bushes', () => placeIslandBushes(sky, foliage.bushes, registry, slice.due), { objects: value => [value.mesh] });
  // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
  const gulls = await stages.build('Gulls', () => gullFlock([
      ...pier.posts.map((p) => new THREE.Vector3(p.x, pier.deckY + 1.02, p.z)),
      ...pier.bollards.map((p) => new THREE.Vector3(p.x, pier.deckY + 1.41, p.z)),
      new THREE.Vector3(-4.2, sea.level + 0.78, -CHUNK_HALF + 6 - 3.0), new THREE.Vector3(-4.2, sea.level + 0.7, -CHUNK_HALF + 6 + 3.0),
      ...SHORE_PERCHES.map((p) => new THREE.Vector3().fromArray(p)),
      ...driftwoodRows('custom/fixedLayouts').gullPerches,
  ]), { objects: value => [value.group] });
  // sand paths between the POIs: plank steps up the crag, rope fences, signposts
  const trailside = buildTrailside(sky);
  // E315 M1: its fence posts, signposts and plank steps are models placed drawnInto the trail's weld (pieces `trail-*`, their
  // colliders with them); the trail's own piece keeps its steps' and stairs' treads
  statics.push(...trailside.colliders); trailside.place(registry);
  await stages.next('Trailside');
  // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
  const bridge = await stages.build('Rope bridge', () => placeRopeBridge(sky, BRIDGE, registry), { values: value => value.colliders });
  // coral, kelp, starfish and a fish school on the lagoon shelf (what you dive for)
  const seabed = await stages.build('Seabed', () => buildSeabed(sky), { objects: value => [value.mesh, value.fish] });
  // coconut palms: where they stand (the palm itself is a model, placed below — one draw call, fronds sway in update)
  const palmSpecs = [...foliage.palms.specs];
  await stages.next('Palm placement');
  // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
  // E315 M1: the cove is world (piece `cove`); its reef rocks are the reef-rock model
  const cove = new Cove(sky).place(registry);
  statics.push(...cove.colliders);
  cutTerrain(world.physics, cove.terrainCuts()); // the drawn terrain pokes up through the sea cave: the physics ground doesn't
  await stages.next('Cove');
  const palms = await placeIslandPalms(sky, foliage.palms, registry, slice.due);
  game.scene.add(palms.mesh); // The registry borrows the compacted batch and its native boxes.
  statics.push(...palms.colliders);
  // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
  const cover = new GroundCover(sky, { cells: coverCells }).build(); // its plants baked per cell (generators/coverCells.ts)
  game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, viewer()), 'shard.driftwood.cover');
  ocean.foamAround(statics); // foam rings around every pile, rock and hull standing in the sea (Ocean W2)
  await stages.next('Palms and ground cover');
  await macrotask();
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  // SF30 activation stays held until SF46 parity: keep the legacy model's live terrain, widths and owners exactly.
  const bridgeDeck = new RopeChain(world.physics, bridge.chainSpec());
  game.onFixed('post', () => { bridgeDeck.capture(); }, 'shard.driftwood.bridge.capture');
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — after the decks register,
  // so none where a deck carries the path (a board there pokes up through the bridge's planks); `ground.paths: 'plugin'`
  registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground',
    colliders: pathRampDescs(TRAILS, heightAt, (x, z) => normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) });
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52; the only island since E136): it sits on the procedural cove.
  // The island and tier cover file are required boot content. Let the level loader dispose and
  // report a failed world stage; never substitute procedural scenery for damaged assets.
  await slice(stages.completed + 1, total, 'Bridge physics and paths');
  const blenderIsland = await import('./BlenderIsland').then(async ({ BlenderIsland: B }) => {
    const island = await B.install({
      scene: game.scene, sky, registry, terrain: world.terrain.mesh, palms: palms.mesh, palmSpecs,
      replace: [bushes.mesh], cover: cover.group, islandCover,
    });
    game.onUpdate(() => { island.update(sky); }, 'shard.driftwood.blenderIsland');
    return island;
  });
  await slice(total, total, 'Baked island');
  return { ocean, pier, jetties, boat, rocks, hut, lookout, wreck, shrine, bushes, gulls, trailside, bridge, seabed, palmSpecs, cove, palms, cover, bridgeDeck, blenderIsland };
}

const built = new WeakMap<object, DriftwoodWorld>();
/** The plugin hands its world to the staged shell (keyed by the build's `ShardRuntime`). */
export function keepDriftwoodWorld(runtime: object, world: DriftwoodWorld): void { built.set(runtime, world); }
/** main.ts's readers until S4.2–S4.4 move them into the plugin: Driftwood's world, or nothing built off Driftwood. */
export function driftwoodWorld(runtime: object): DriftwoodWorld { return built.get(runtime) ?? noDriftwoodWorld(); }
