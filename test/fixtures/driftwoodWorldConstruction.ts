import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { WorldAssembly } from '@wildshard/game/shardfile/worldAssembly';
import { entryOwner } from '@wildshard/game/shardfile/entryOwners';
import type { Scope } from '@wildshard/engine/app/scope';
import { driftwoodRows, driftwoodProduct } from '../../src/shards/driftwood-isle/runtime/boot/rows';
import { TIER } from '@wildshard/engine/core/tier';
import { loadFixedGeometry, fixedDrawLibrary } from '../../src/shards/driftwood-isle/runtime/boot/blobAssets';
/**
 * Driftwood Isle's world build (E357 S4.1, 08 §4 `level.world`, §6.1 step 2): the ~15 builders `main.ts`'s `edge` step
 * ran behind `isOcean ?`, in the same order with the same arguments and a `slice()` between them (the 30 ms task
 * budget), then the rope bridge's jointed deck, the island's walkway ramps and the Blender spawn cove over the procedural
 * one. The plugin (../plugin.ts) runs it in the level's world stage.
 */
import type * as THREE from 'three';
import { sites } from '../../src/shards/driftwood-isle/models/catalogue';
import { macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import manifest from '../../src/shards/driftwood-isle/discovery.generated';
import type { BakedTiles } from '@wildshard/game/shardfile/bakedTiles';
import { sharedModelContext } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';

/** The mooring lines' look: a graph on every tier (its vertex lift has no classic form), lent before the world builds. */
export const MOOR_LOOK = 'driftwood-kit-moor';

/** main.ts:366-467's Driftwood builders, lowered as one by G164 (`sea` is the lowered sea at road level). */
export function buildDriftwoodWorld(...args: Parameters<typeof build>): Promise<void> { return build(...args); }
async function build(world: World, viewer: () => THREE.Vector3, progress: StepProgress | undefined, scenes: SceneHandles, baked: ReadonlyMap<string, BakedTiles>, scope: Scope) {
  // G164: the whole island lowered, the sea at road level; G170: each declared entry landing is the inner end of an asphalt
  // road deck (the catalogue's entryDeck, generators/entryDeckGeometry.ts) that carries the socket on over it, and a pier / jetty ramps up from it
  const fixed = driftwoodRows('custom/fixedLayouts');
  const { game, sky, player, registry } = world;
  // E156: the ground and the baked island wear the cover as the baked cove's declared wear (generators/bakedCove.ts)
  const [, coverCells] = await Promise.all([loadFixedGeometry(undefined, game.registrationScope), driftwoodProduct().file(`world/cover/cells/${TIER}.bin`)]);
  const slice = slicer(30, progress);
  const assembly = fixed.assembly, total = 18 + assembly.piers.length;
  let completed = 0;
  const complete = async (detail: string): Promise<void> => { await slice(++completed, total, detail); };
  progress?.set(0, total, 'Preparing world builders'); // between the builders below: a task ends once it has run ~30 ms (the pier … cove were one 0.3–0.5 s task)
  // the south entry road is a wooden pier over the water; the player spawns on its deck
  // E315 M1: the pier model (../runtime/models/pier.ts) placed through src/engine/models/place.ts, which registers piece `pier`
  // SF46: it starts past the entry socket and ramps up from road height (Jake's SF72 flare; generators/pierSites.ts)
  // G571: the typed world stages (generators/worldAssembly.ts) publish each owner as entry loans on the construction scope
  const stages = WorldAssembly.admit(driftwoodRows('custom/worldStages'), { scope, scenes, sites, context: sharedModelContext(sky, game), registry, slice: complete, product: driftwoodProduct(), draws: fixedDrawLibrary(), physics: world.physics, fixed: game, cover: { cells: coverCells, viewer, updates: game },
    entry: { root: game.scene, tier: game.tier, physics: world.physics, piece: (piece) => { registry.add(piece); } } });
  const only = (id: string): Placed => { const [placed] = entryOwner(scope, 'placed', id); if (placed === undefined) throw new Error(`Driftwood ${id} placed nothing`); return placed; };
  const firstPier = assembly.piers[0]; if (firstPier === undefined) throw new Error('Missing entry pier');
  await stages.next(firstPier.id);
  // G170: the declared entry landings and the four asphalt road decks over the water carrying them on; each ramp rises from one
  await stages.next('decks');
  const y = entryOwner(scope, 'floor', firstPier.id)(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
  // the little sailboat you arrived in, moored alongside the pier by the spawn (E308: half way down); you can drop into it
  // E315 M1: the sailboat model (../models/boat.ts) placed through src/engine/models/place.ts, which registers
  // piece `boat`: it rides the swell, its colliders (in the boat's own frame) follow it on a kinematic body (P4)
  // SF46 (G164): lowered with everything else, it stays moored by the pier
  // its mooring lines: one static mesh whose cleat ends rise with the hull's heave less each cleat's z times sin(pitch) (its look)
  await stages.next('boat');
  const boatPlaced = only('boat'), ropes = scenes.mesh('moorings.mesh');
  const boat = { placed: boatPlaced, group: boatPlaced.object, ropes, floorHeightAt: entryOwner(scope, 'floor', 'boat') };
  // faceted shore boulders along the beach
  // Keep the model's authored copy facts over the finished world draw.
  await stages.next('shore');
  const rocks = { placed: only('shore') };
  // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
  await stages.next('hut');
  // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
  await stages.next('lookout');
  // the shipwreck with the cove's cargo, drift logs and reef rocks: declared copies drawn into the wreck site's meshes
  // (piece `wreck`: the site's colliders and floors; the Wreck cove set)
  await stages.next('wreck');
  const wreck = { group: entryOwner(scope, 'object', 'wreck'), placed: entryOwner(scope, 'placed', 'wreck'), floorHeightAt: entryOwner(scope, 'floor', 'wreck') };
  // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
  await stages.next('shrine');
  const shrine = { group: entryOwner(scope, 'object', 'shrine'), placed: only('shrine'), anchors: entryOwner(scope, 'site', 'shrine'),
    floorHeightAt: entryOwner(scope, 'floor', 'shrine') };
  // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
  for (const row of assembly.piers.slice(1)) await stages.next(row.id);
  await slice();
  if (fixed.foliage.seed !== manifest.seed) throw new Error('Foliage placements require their authored seed');
  await stages.next('bushes');
  const bushes = { placed: only('bushes'), mesh: entryOwner(scope, 'object', 'bushes') };
  // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
  await stages.next('driftwood.gulls');
  const gulls = entryOwner(scope, 'ambient-draw', 'driftwood.gulls');
  // sand paths between the POIs: plank steps up the crag, rope fences, signposts
  await stages.next('trail');
  const trailside = { mesh: entryOwner(scope, 'object', 'trail'), placed: entryOwner(scope, 'placed', 'trail') };
  // its fence posts, signposts and plank steps are the entry's placements drawn into the trail's weld (pieces `trail-*`, their
  // colliders with them); the trail's own piece keeps its steps' and stairs' treads
  // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
  await stages.next('bridge');
  const bridge = entryOwner(scope, 'rope-deck', 'bridge');
  // coral, kelp and starfish on the lagoon shelf (what you dive for); its fish school is page life (generators/fishDraw.ts)
  await stages.next('seabed');
  const seabed = { mesh: entryOwner(scope, 'object', 'seabed') };
  // coconut palms: where they stand (the palm itself is a model, placed below — one draw call, fronds sway in update)
  await complete('Palm placement');
  // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
  // E315 M1: the cove is world (piece `cove`); its reef rocks are the reef-rock model
  await stages.next('cove'); // its cascade, its piece (rock walls, treads and floors) and its reef rocks (generators/worldEntry.ts)
  const cove = { group: entryOwner(scope, 'object', 'cove'), placed: entryOwner(scope, 'placed', 'cove') };
  await stages.next('palms'); // The registry borrows the compacted batch and its native boxes.
  const palms = { placed: only('palms'), mesh: entryOwner(scope, 'object', 'palms') };
  // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
  await stages.next('cover');
  const cover = { group: entryOwner(scope, 'object', 'driftwood.cover'), placed: entryOwner(scope, 'placed', 'cover') };
  await macrotask();
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  // SF30 activation stays held until SF46 parity: keep the legacy model's live terrain, widths and owners exactly.
  await stages.next('bridge.deck');
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52), drawn by the client plan's baked tiles (world.baked, G532 (4)):
  // (its declared wear dresses its ground and cover looks there); the monkeys climb its palms
  const island = baked.get('cove'); if (island === undefined) throw new Error('Missing baked cove');
  await stages.next('smallRocks'); // E315 M1: the small-rock model's declared copies, merged into the rocks scene's small weld
  const smallRocks = entryOwner(scope, 'object', 'smallRocks');
  await slice(total, total, 'Baked island');
  gpuOnlyTrees([...assembly.piers.map(row => entryOwner(scope, 'object', row.id)), boat.group, boat.ropes, rocks.placed.object, entryOwner(scope, 'object', 'hut'), entryOwner(scope, 'object', 'lookout'),
    wreck.group, shrine.group, bushes.mesh, gulls.group, trailside.mesh, bridge.placed.object, seabed.mesh, cove.group, palms.mesh, cover.group, island.group, smallRocks], 'driftwood.world', ['position']);
  // the sea is the client plan's `world.water` row (O7): its feature draws and ticks it
}
