import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { WorldAssembly } from '@wildshard/game/shardfile/worldAssembly';
import { entryOwner, publishEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import type { Scope } from '@wildshard/engine/app/scope';
import { driftwoodRows, driftwoodProduct } from '../runtime/boot/rows';
import { loadVertexWear } from '@wildshard/game/looks/vertexWear';
import { TIER } from '@wildshard/engine/core/tier';
import { loadFixedGeometry, fixedDraw, fixedGeometryGroups } from '../runtime/boot/blobAssets';
/**
 * Driftwood Isle's world build (E357 S4.1, 08 §4 `level.world`, §6.1 step 2): the ~15 builders `main.ts`'s `edge` step
 * ran behind `isOcean ?`, in the same order with the same arguments and a `slice()` between them (the 30 ms task
 * budget), then the rope bridge's jointed deck, the island's walkway ramps and the Blender spawn cove over the procedural
 * one. The plugin (../plugin.ts) runs it in the level's world stage.
 */
import type * as THREE from 'three';
import { sites } from '../models/catalogue';
import wreckBake from '../data/wreckBake.json' with { type: 'json' };
import { macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import manifest from '../discovery.generated';
import * as v from 'valibot';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import { createBuildingCloud } from '@wildshard/game/shardfile/buildingCloud';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { hasLentLook, lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { updateWind } from '@wildshard/engine/world/wind';
import { createAmbientFlock } from '@wildshard/game/ambient/ambientFlock';
import { placeRopeBridge } from './RopeBridge';
import type { CoverComposition } from '../runtime/productSections.generated.d.ts';
import { followToonLook } from '@wildshard/game/looks/toonLook';
import { createStreamedCover } from '@wildshard/game/looks/streamedCover';
import authoredCover from '../data/groundCover.json' with { type: 'json' };
import type { BakedTiles } from '@wildshard/game/shardfile/bakedTiles';
import { sharedModelContext } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';

/** The mooring lines' look: a graph on every tier (its vertex lift has no classic form), lent before the world builds. */
export const MOOR_LOOK = 'driftwood-kit-moor';

/** What the world build hands the rest of the level: each part it built. */
export type DriftwoodWorld = Awaited<ReturnType<typeof build>>;

/** main.ts:366-467's Driftwood builders, lowered as one by G164 (`sea` is the lowered sea at road level). */
export function buildDriftwoodWorld(...args: Parameters<typeof build>): Promise<DriftwoodWorld> { return build(...args); }
async function build(world: World, viewer: () => THREE.Vector3, progress: StepProgress | undefined, scenes: SceneHandles, baked: ReadonlyMap<string, BakedTiles>, scope: Scope) {
  // G164: the whole island lowered, the sea at road level; G170: each declared entry landing is the inner end of an asphalt
  // road deck (the catalogue's entryDeck, generators/entryDeckGeometry.ts) that carries the socket on over it, and a pier / jetty ramps up from it
  const fixed = driftwoodRows('custom/fixedLayouts');
  const { game, sky, player, registry } = world;
  const [{ cutTerrain }, , islandCover, coverCells] = await Promise.all([import('@wildshard/engine/physics/terrain'), loadFixedGeometry(undefined, game.registrationScope),loadVertexWear(driftwoodProduct(), fixed.coverFiles[TIER]),driftwoodProduct().file(`world/cover/cells/${TIER}.bin`)]); // the deferred world code (cut, the live baked heightfield)
  islandCover.wear(world.terrain.mesh.geometry, 0); // E156: the ground wears the cover (its baked bytes, generators/islandCover.ts)
  const coverMap = islandCover.texture; if (coverMap === null) throw new Error('The island cover carries its ground map');
  const slice = slicer(30, progress);
  const assembly = fixed.assembly, total = 18 + assembly.piers.length;
  let completed = 0;
  const complete = async (detail: string): Promise<void> => { await slice(++completed, total, detail); };
  const stage = async <T>(detail: string, work: () => T | Promise<T>): Promise<T> => {
    const value = await work();
    await complete(detail);
    return value;
  };
  progress?.set(0, total, 'Preparing world builders'); // between the builders below: a task ends once it has run ~30 ms (the pier … cove were one 0.3–0.5 s task)
  // the south entry road is a wooden pier over the water; the player spawns on its deck
  // E315 M1: the pier model (../runtime/models/pier.ts) placed through src/engine/models/place.ts, which registers piece `pier`
  // SF46: it starts past the entry socket and ramps up from road height (Jake's SF72 flare; generators/pierSites.ts)
  // G571: the typed world stages (generators/worldAssembly.ts) publish each owner as entry loans on the construction scope
  const stages = WorldAssembly.admit(driftwoodRows('custom/worldStages'), { scope, scenes, sites, context: sharedModelContext(sky, game), registry, slice: complete,
    entry: { root: game.scene, tier: game.tier, piece: (piece) => { registry.add(piece); } } });
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
  const boatPlaced = await scenes.place('harbour.boat'), ropes = scenes.mesh('moorings.mesh'), [bowZ, sternZ] = fixed.boat.cleats, lift: [number, number] = [0, 0];
  const boat = { placed: boatPlaced, group: boatPlaced.object, ropes, floorHeightAt: (x: number, z: number) => scenes.floorAt('harbour.boat', x, z),
    refreshPose: () => { const heave = boatPlaced.object.position.y - fixed.boat.spec.waterY, pitch = Math.sin(boatPlaced.object.rotation.x);
      lift[0] = heave - bowZ * pitch; lift[1] = heave - sternZ * pitch; setLentParam(MOOR_LOOK, 'moor', lift); } };
  game.scene.add(ropes);
  await complete('Boat');
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
  const wreck = { group: entryOwner(scope, 'object', 'wreck'), placed: entryOwner(scope, 'placed', 'wreck'), anchors: structuredClone(wreckBake.anchors), holdBounds: { ...wreckBake.holdBounds }, floorHeightAt: entryOwner(scope, 'floor', 'wreck') };
  // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
  const shrine = await stage('Shrine', async () => {
    const ctx = sharedModelContext(sky, game), { baseY, terrace } = fixed.shrine.world;
    const placed = sites.site('shrine', 'world', ctx, registry);
    const resources = scenes, graph = driftwoodRows('custom/fixedLayouts').nativeView.FIREFLY_LOOK, lit = hasLentLook(graph);
    resources.publish('shrine.root', placed.group);
    placed.group.add(createBuildingCloud(resources, { geometry: resources.lend(fixedDraw('shrineFireflies').copy()), material: lit ? resources.lend(lentLook(graph)) : null,
      seeds: false, name: 'shrine-fireflies', at: { point: 'shrine.root', offset: [0, baseY, 0] }, parent: 'shrine.root', center: [0, terrace - baseY, 0], radius: 18, order: 4, visible: lit }));
    const data = v.parse(v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema, initialDusk: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) }), JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await driftwoodProduct().file('world/building-life.json'))));
    const life = new LivingBuildings(resources, data.look); life.add(data.life); life.setDusk(data.initialDusk); life.update(0);
    return { ...placed, update: life.update.bind(life), setDusk: life.setDusk.bind(life) };
  });
  // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
  for (const row of assembly.piers.slice(1)) await stages.next(row.id);
  await slice();
  if (fixed.foliage.seed !== manifest.seed) throw new Error('Foliage placements require their authored seed');
  const foliage = fixed.foliage.tiers[game.tier];
  await stages.next('bushes');
  const bushes = { placed: only('bushes'), mesh: entryOwner(scope, 'object', 'bushes') };
  // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
  const gulls = await stage('Gulls', () => {
    const flock = createAmbientFlock(driftwoodRows('custom/gullFlock'), { name: fixed.nativeView.GULL_GRAPH_LOOK, geometry: fixedDraw('gull').copy(), material: lentLook(fixed.nativeView.GULL_GRAPH_LOOK).clone(), castShadow: true }, fixed.gullPerches);
    game.scene.add(flock.group);
    return flock;
  });
  // sand paths between the POIs: plank steps up the crag, rope fences, signposts
  await stages.next('trail');
  const trailside = { mesh: entryOwner(scope, 'object', 'trail'), placed: entryOwner(scope, 'placed', 'trail') };
  // its fence posts, signposts and plank steps are the entry's placements drawn into the trail's weld (pieces `trail-*`, their
  // colliders with them); the trail's own piece keeps its steps' and stairs' treads
  // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
  const bridge = await stage('Rope bridge', () => placeRopeBridge(sky, assembly.bridge, registry));
  // coral, kelp and starfish on the lagoon shelf (what you dive for); its fish school is page life (generators/fishDraw.ts)
  const seabed = await stage('Seabed', () => {
    const mesh = scenes.mesh('reef.mesh'), update = followToonLook(driftwoodProduct(), fixed.nativeView.REEF_LOOK);
    game.scene.add(mesh);
    return { mesh, tick: () => { update(); } };
  });
  // coconut palms: where they stand (the palm itself is a model, placed below — one draw call, fronds sway in update)
  const palmSpecs = [...foliage.palms.specs];
  await complete('Palm placement');
  // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
  // E315 M1: the cove is world (piece `cove`); its reef rocks are the reef-rock model
  const coveRows = driftwoodRows('custom/fixedLayouts').cove, coveView = coveRows.composition;
  const coveSpec = structuredClone(coveRows.spec);
  const cove = { group: scenes.group(coveView.root), placed: [] as readonly Placed[], crabSites: coveSpec.crabSites,
    anchors: structuredClone(coveRows.native.anchors), update: followToonLook(driftwoodProduct(), coveView.look) };
  cove.group.add(scenes.group(coveView.cascade));
  await stages.next('cove'); // its piece (generators/worldEntry.ts): rock walls, treads and floors, then its reef rocks
  cove.placed = entryOwner(scope, 'placed', 'cove');
  cutTerrain(world.physics, structuredClone(coveRows.native.cuts)); // the drawn terrain pokes up through the sea cave: the physics ground doesn't
  await stages.next('palms'); // The registry borrows the compacted batch and its native boxes.
  const palms = { placed: only('palms'), mesh: entryOwner(scope, 'object', 'palms'), update: updateWind };
  // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
  const coverComposition = await driftwoodProduct().json<CoverComposition>('world/cover-composition.json');
  const coverPlaced = await scenes.place(coverComposition.placement);
  for (const [kind, slot] of Object.entries(fixedGeometryGroups().cover)) scenes.publish(kind, fixedDraw(slot).copy());
  const cover = Object.assign(createStreamedCover(scenes, authoredCover.GROUND_COVER, coverCells), { placed: [coverPlaced] });
  cover.group.name = coverComposition.name;
  const coverLogs = scenes.mesh(coverComposition.mesh);
  Object.assign(coverLogs.userData, coverComposition.userData); cover.group.add(coverLogs);
  game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, viewer()), 'shard.driftwood.cover');
  await complete('Ground cover');
  await macrotask();
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  // SF30 activation stays held until SF46 parity: keep the legacy model's live terrain, widths and owners exactly.
  const bridgeDeck = new RopeChain(world.physics, bridge.chainSpec());
  game.onFixed('post', () => { bridgeDeck.capture(); }, 'shard.driftwood.bridge.capture');
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52), drawn by the client plan's baked tiles (world.baked, G532 (4)):
  // here its ground wears the cover it carries, its cover fades into the cover's ground map, the monkeys climb its palms
  await slice(completed + 1, total, 'Bridge physics and paths');
  const island = baked.get('cove'); if (island === undefined) throw new Error('Missing baked cove');
  const looks = fixed.nativeView.ISLAND_LOOKS, reach = fixed.nativeView.ISLAND_TIERS[TIER];
  island.tiles.forEach((tile, i) => { islandCover.wear(tile.geometry, i + 1); });
  for (const [id, c] of [[looks.cover, reach.cover], [looks.coverBig, reach.big]] as const) {
    setLentParam(id, 'fade', [c.near + c.grow, c.far, c.grow]); setLentParam(id, 'groundRect', [...islandCover.rect]); setLentTexture(id, 'groundMap', coverMap);
  }
  await stages.next('smallRocks'); // E315 M1: the small-rock model's declared copies, merged into the rocks scene's small weld
  const smallRocks = entryOwner(scope, 'object', 'smallRocks');
  palmSpecs.push(...fixed.foliage.islandPalms);
  await slice(total, total, 'Baked island');
  gpuOnlyTrees([...assembly.piers.map(row => entryOwner(scope, 'object', row.id)), boat.group, boat.ropes, rocks.placed.object, entryOwner(scope, 'object', 'hut'), entryOwner(scope, 'object', 'lookout'),
    wreck.group, shrine.group, bushes.mesh, gulls.group, trailside.mesh, bridge.placed.object, seabed.mesh, cove.group, palms.mesh, cover.group, island.group, smallRocks], 'driftwood.world', ['position']);
  // the sea is the client plan's `world.water` row (O7): its feature draws and ticks it
  publishEntryOwner(scope, 'placed', 'boat', [boat.placed]);
  publishEntryOwner(scope, 'placed', 'shrine', [shrine.placed]);
  publishEntryOwner(scope, 'placed', 'bridge', [bridge.placed]);
  publishEntryOwner(scope, 'placed', 'cover', cover.placed);
  return { boat, rocks, wreck, shrine, bushes, gulls, trailside, bridge, seabed, palmSpecs, cove, palms, cover, bridgeDeck };
}

const built = new WeakMap<object, DriftwoodWorld>();
/** The plugin hands its world to the staged shell (keyed by the build's `ShardRuntime`). */
export function keepDriftwoodWorld(runtime: object, world: DriftwoodWorld): void { built.set(runtime, world); }
/** The adventure's read of the world its plugin built. */
export function driftwoodWorld(runtime: object): DriftwoodWorld { const world = built.get(runtime); if (world === undefined) throw new Error('Driftwood world is not built'); return world; }
